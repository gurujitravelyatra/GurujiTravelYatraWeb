import type { LeadSubmissionRecord } from './lead-schema';

/**
 * The lead safety net.
 *
 * ## Why this file is load-bearing
 *
 * `POST /api/leads` writes NOTHING to a database of its own. `prisma/
 * schema.prisma` holds site content only and says so in a comment at the top
 * ("It holds NO LEADS") — that boundary is unchanged. The CRM (`POST
 * /public/enquiries`) is the real system of record for a lead now
 * (CRM-migration Step 3), but a CRM call can still fail — misconfiguration,
 * rate limiting, a transient outage — and `route.ts` never lets that become
 * the visitor's problem. This log is what makes that safe: it is the one
 * place a lead that the CRM never received is still fully recoverable from.
 *
 * Which means: **this log line is the ONLY trace of a lead the CRM did not
 * end up storing.** There is no table to query for those, no dead-letter
 * queue, no retry. If someone has to follow up with such a visitor by hand,
 * they will do it by reading these lines. So these logs are written to be
 * recovered from, not merely to be noticed.
 *
 * ## Three rules that follow from that
 *
 * 1. **Log the whole record, never a summary.** The payload is serialised with
 *    a blanket `JSON.stringify` of the record rather than a hand-listed set of
 *    fields. A hand-written list is a second copy of the schema that silently
 *    goes stale: add `budget` to the form next sprint, forget to add it here,
 *    and the field is lost forever with no error anywhere. Serialising the
 *    whole object cannot drift.
 * 2. **One line per event.** Multi-line output interleaves with other requests
 *    under concurrency, and a half-interleaved lead is an unrecoverable one.
 *    One line also means `grep LEAD-SUBMISSION` is a complete extraction tool.
 * 3. **Log before attempting delivery, not after.** See `route.ts`.
 *
 * ## This deliberately logs PII
 *
 * Name, mobile, email and free text all go to stdout. That is the explicit
 * trade the user made (log-only over local persistence, `BLOCKERS.md` §6) and
 * it is the opposite of `NotImplementedLeadAdapter`, which logs only
 * non-identifying routing fields precisely to AVOID this. The consequence is
 * real and is recorded in `BLOCKERS.md` §6: wherever this app's stdout goes is
 * now a personal-data store and has to be access-controlled and retained like
 * one. Redacting would defeat the entire purpose of the log — an unreachable
 * lead is the same as a lost one.
 */

/** Single, stable grep token. Do not change without updating `BLOCKERS.md` §6. */
const MARKER = 'LEAD-SUBMISSION';

/**
 * `console.info` rather than `console.log`: in the standalone Node server these
 * both go to stdout, but `info` marks intent for any log shipper that filters
 * by level, and keeps these lines distinguishable from incidental `log` noise.
 */
function write(event: string, record: LeadSubmissionRecord, extra?: Record<string, unknown>): void {
  console.info(
    `[lead] ${MARKER} ${event} ${JSON.stringify({ event, ...record, ...extra })}`
  );
}

/**
 * Call the moment a submission has been validated — BEFORE any delivery
 * attempt. This is the line that guarantees the lead exists somewhere.
 */
export function logLeadReceived(record: LeadSubmissionRecord): void {
  write('received', record);
}

/**
 * Call when the CRM hand-off was deliberately NOT attempted or did not
 * result in a lead — `WEBSITE_API_KEY` unset, or a non-2xx the route treats
 * as "known, not actionable by the visitor" (`route.ts`'s own comment lists
 * which codes).
 *
 * CONCISE on purpose, unlike `logLeadDeliveryFailure` below. The `received`
 * line immediately above it already holds the full PII record; dumping it a
 * second time here would put two identical blocks in the log for every such
 * lead, which makes the log harder to recover leads from, not easier. This
 * one only has to say "and it went nowhere", with the `leadId` to join on.
 */
export function logLeadDeliverySkipped(record: LeadSubmissionRecord, reason: string): void {
  console.info(
    `[lead] ${MARKER} delivery-skipped ${JSON.stringify({
      event: 'delivery-skipped',
      leadId: record.leadId,
      receivedAt: record.receivedAt,
      source: record.source,
      reason,
    })}`
  );
}

/**
 * Call when the CRM hand-off threw or rejected — something unexpected, as
 * opposed to the known not-configured state above.
 *
 * Logs the FULL record, and here the duplication IS worth it. This path is
 * exceptional, so it is rare enough not to bloat the log; and it is the path
 * where the surrounding lines are least trustworthy, so a failure line has to
 * be self-sufficient. A line reading "lead 7f3a… failed" is useless to someone
 * grepping for failures who then finds no phone number next to it.
 */
export function logLeadDeliveryFailure(record: LeadSubmissionRecord, reason: unknown): void {
  const detail =
    reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason);
  write('delivery-failed', record, { deliveryFailure: detail });
}

/**
 * Call when `POST /public/enquiries` accepts the enquiry (always `{ok:
 * true}` — see `submitEnquiry()`'s own doc comment for why `reference` is
 * not a real CRM lead id). Concise for the same reason as
 * `delivery-skipped`: on the happy path the CRM holds the lead, so this
 * server's log no longer has to be its only copy.
 */
export function logLeadDelivered(record: LeadSubmissionRecord, reference: string): void {
  console.info(
    `[lead] ${MARKER} delivered ${JSON.stringify({
      event: 'delivered',
      leadId: record.leadId,
      receivedAt: record.receivedAt,
      source: record.source,
      crmReference: reference,
    })}`
  );
}
