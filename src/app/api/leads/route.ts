import type { NextRequest } from 'next/server';

import { submitLeadToCrm } from '@/server/crm-client';
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
 * A THIN WRAPPER, same shape as `GET /api/tours`: validation lives in
 * `src/server/leads/lead-schema.ts`, the safety-net log in `lead-log.ts`, the
 * CRM hand-off in `crm-client.ts`. This file owns only the order those three
 * happen in — which is the part that actually protects the visitor.
 *
 * ## What this route does NOT do
 *
 * **It does not persist anything.** No Prisma model is touched and none was
 * added; `prisma/schema.prisma` still says "It holds NO LEADS" and that is
 * still true. The user chose log-only over local persistence to keep the "no
 * lead data of its own" boundary from CLAUDE.md §6 intact — recorded as a
 * resolution in `BLOCKERS.md` §6. Consequence: the `console.info` in
 * `logLeadReceived` is the ONLY record of a lead that will ever exist.
 *
 * **It does not deduplicate.** Every submission is accepted, including a repeat
 * from the same mobile number a minute later (CLAUDE.md §5.5 — merging is the
 * CRM's job, since it owns the Customer/Lead tables). A second submission is
 * correct behaviour on this end, not a bug to suppress.
 *
 * ## Ordering: log first, then attempt delivery
 *
 * `logLeadReceived` runs BEFORE `submitLeadToCrm`, and that is not stylistic.
 * If it ran after, then a CRM call that hangs until the platform kills the
 * request, or that crashes the process, would take the only copy of the lead
 * with it. Logging first means the lead survives anything that happens next.
 *
 * ## A downstream failure is never the visitor's problem
 *
 * If `submitLeadToCrm` throws, rejects, or reports non-delivery, the visitor
 * still gets a 200. Their data is already recorded, so asking them to re-type
 * it would lose a lead in order to report a fault they cannot act on
 * (CLAUDE.md §5.4). The failure is loud where it can be acted on — in the logs
 * — and silent where it cannot be.
 *
 * The one thing the 200 body avoids is over-claiming: it says `received: true`,
 * never that the CRM stored anything. Today it never has.
 */

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

    // The safety net. Everything below this line may fail without losing data.
    logLeadReceived(record);

    try {
      const outcome = await submitLeadToCrm(record);
      if (outcome.status === 'delivered') {
        logLeadDelivered(record, outcome.reference);
      } else {
        // Expected, not exceptional: `logged-only` is what the stub returns on
        // every submission until the CRM endpoint exists. Logged concisely so
        // the steady state does not bury the genuine failures below.
        logLeadDeliverySkipped(record, outcome.reason);
      }
    } catch (error) {
      logLeadDeliveryFailure(record, error);
    }

    return apiSuccess({
      received: true,
      leadId: record.leadId,
      source: record.source,
      receivedAt: record.receivedAt,
    });
  });
}
