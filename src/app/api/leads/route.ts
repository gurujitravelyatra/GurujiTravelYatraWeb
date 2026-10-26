import type { NextRequest } from 'next/server';

import { CrmApiError, submitEnquiry, WebsiteApiKeyNotConfiguredError } from '@/server/crm/client';
import { buildCrmEnquiryRequest } from '@/server/leads/crm-enquiry-mapper';
import {
  logLeadDelivered,
  logLeadDeliveryFailure,
  logLeadDeliverySkipped,
  logLeadReceived,
} from '@/server/leads/lead-log';
import { leadSubmissionSchema, toFieldErrors, toLeadRecord } from '@/server/leads/lead-schema';

import { apiFailure, apiSuccess, handleRoute } from '../_lib/json';

/**
 * `POST /api/leads` — the single write path for every lead this site creates.
 *
 * A THIN WRAPPER, same shape as the old `GET /api/tours` (now removed):
 * validation lives in `src/server/leads/lead-schema.ts`, the safety-net log
 * in `lead-log.ts`, the CRM request shape in `crm-enquiry-mapper.ts`, and
 * the actual CRM call in `@/server/crm/client`'s `submitEnquiry()`. This
 * file owns only the order those four happen in — which is the part that
 * actually protects the visitor.
 *
 * CRM-migration Step 3: this used to call `submitLeadToCrm` — a stub in the
 * now-deleted `src/server/crm-client.ts` that made no network call and
 * always reported `logged-only`, because the CRM's lead-creation contract
 * did not exist yet. It exists now (`POST /public/enquiries`, documentation/
 * technical-specification/public-website.md), so this route genuinely
 * delivers a lead rather than only logging one.
 *
 * ## What this route does NOT do
 *
 * **It does not persist anything of its own.** No Prisma model is touched;
 * the lead itself is created by the CRM, which is the system of record for
 * leads now, the same as it is for tours/places/site content.
 *
 * **It does not deduplicate.** That is the CRM's own job per the contract's
 * "Lead creation" section (an open lead for the same phone number gets a
 * `NOTE` activity instead of a second `Lead` row) — this route submits every
 * validated request exactly once and leaves the merge decision to the CRM.
 *
 * ## Ordering: log first, then attempt delivery
 *
 * `logLeadReceived` runs BEFORE `submitEnquiry`, and that is not stylistic.
 * If it ran after, then a CRM call that hangs until the platform kills the
 * request, or that crashes the process, would take the only copy of the lead
 * with it. Logging first means the lead survives anything that happens next.
 *
 * ## A downstream failure is never the visitor's problem
 *
 * If `submitEnquiry` throws, rejects, or the CRM is not configured
 * (`WebsiteApiKeyNotConfiguredError`, or a `CrmApiError` for `503
 * NOT_CONFIGURED`/`429 RATE_LIMITED`/a transient `5xx`), the visitor still
 * gets a 200. Their data is already recorded in this server's own log, so
 * asking them to re-type it would lose a lead in order to report a fault
 * they cannot act on. The ONE exception is `400 VALIDATION_FAILED` from a
 * REJECTED Turnstile token (the contract's own wording: "indistinguishable"
 * from a misconfigured secret, but the token itself can genuinely be stale
 * if a visitor left the tab open a long time) — that is surfaced as a 400
 * on `turnstileToken` so the visitor can actually fix it by retrying,
 * rather than being told their enquiry succeeded when the CRM never
 * created anything for it.
 *
 * The 200 body avoids over-claiming either way: it says `received: true`,
 * never that the CRM stored anything.
 */

/**
 * Shown for a CRM `400 VALIDATION_FAILED` — most likely a rejected/expired
 * Turnstile token (contract: "Protection, in order", step 3), but the CRM's
 * error envelope does not say which check failed, so this stays general
 * rather than naming a specific field it might be wrong about.
 */
const CRM_VALIDATION_MESSAGE = 'Some details could not be verified — please check the form and try again.';

/** Returned when the body is not JSON at all — before Zod is ever reached. */
const MALFORMED_BODY_MESSAGE = 'Expected a JSON request body.';

/** Field-level detail rides in `fields`, for inline display next to each input. */
const VALIDATION_MESSAGE = 'Some details need fixing before we can send this.';

export async function POST(request: NextRequest) {
  return handleRoute('POST /api/leads', async () => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      // A malformed body is a broken caller, not a broken visitor — there is no
      // salvageable lead here, so there is nothing to log and nothing to
      // recover. 400 with no `fields`: the form has no input to attach this to.
      return apiFailure(400, MALFORMED_BODY_MESSAGE);
    }

    const parsed = leadSubmissionSchema.safeParse(body);
    if (!parsed.success) {
      // Covers an unknown/missing `formType` too: `z.discriminatedUnion`
      // reports it as an issue on the `formType` path, so a wrong form type is
      // an ordinary 400 rather than a thrown `TypeError` from a switch that
      // fell through.
      return apiFailure(400, VALIDATION_MESSAGE, toFieldErrors(parsed.error));
    }

    const record = toLeadRecord(parsed.data);

    // A single-use, short-lived Cloudflare token adds nothing a human
    // reading this log to follow up on a lead would need, so it is
    // redacted from the log line — but the REAL record (with the real
    // token) is what gets sent to the CRM a few lines down.
    const recordForLog = { ...record, submission: { ...record.submission, turnstileToken: '[redacted]' } };

    // The safety net. Everything below this line may fail without losing data.
    logLeadReceived(recordForLog);

    try {
      const enquiry = buildCrmEnquiryRequest(record.submission, {
        consent: record.submission.consent,
        turnstileToken: record.submission.turnstileToken,
        honeypot: record.submission.honeypot,
      });
      await submitEnquiry(enquiry);
      // `CrmEnquiryResponse` is always `{ ok: true }` — the CRM returns no
      // lead id here (unlike the rest of this route's own `leadId`, which
      // is this SERVER's correlation id, not the CRM's). There is nothing
      // more specific to log than "accepted".
      logLeadDelivered(recordForLog, 'accepted');
    } catch (error) {
      // A rejected/expired Turnstile token is the one failure the visitor
      // can actually act on (retry the challenge) — everything else
      // (misconfiguration, rate limiting, a transient CRM outage) is not
      // theirs to fix, so it is logged and absorbed into the 200 below
      // exactly as a thrown/rejected delivery always has been on this route.
      if (error instanceof CrmApiError && error.statusCode === 400) {
        logLeadDeliveryFailure(recordForLog, error);
        return apiFailure(400, CRM_VALIDATION_MESSAGE);
      }

      if (error instanceof WebsiteApiKeyNotConfiguredError) {
        logLeadDeliverySkipped(recordForLog, 'WEBSITE_API_KEY not configured in this environment.');
      } else if (error instanceof CrmApiError) {
        logLeadDeliverySkipped(recordForLog, `CRM ${error.statusCode} ${error.code}: ${error.message}`);
      } else {
        logLeadDeliveryFailure(recordForLog, error);
      }
    }

    return apiSuccess({
      received: true,
      leadId: record.leadId,
      source: record.source,
      receivedAt: record.receivedAt,
    });
  });
}
