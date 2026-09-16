import type { LeadSubmissionRecord } from './lead-schema';

/**
 * The lead safety net.
 *
 * ## Why this file is load-bearing
 *
 * `POST /api/leads` writes NOTHING to a database. `prisma/schema.prisma` holds
 * content only and says so in a comment at the top ("It holds NO LEADS"), and
 * that boundary was reaffirmed, not overridden, when this route was built — see
 * `BLOCKERS.md` §6. The CRM endpoint does not exist yet either
 * (`BLOCKERS.md` §1a), so `submitLeadToCrm` delivers nowhere.
 *
 * Which means: **a log line is the only trace a lead ever leaves.** There is no
 * table to query, no dead-letter queue, no retry. If someone has to follow up
 * with a visitor by hand, they will do it by reading these lines. So these logs
 * are written to be recovered from, not merely to be noticed.
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
 * Call when the CRM reported `logged-only` — i.e. it is not configured and no
 * delivery was attempted.
 *
 * CONCISE on purpose, unlike `logLeadDeliveryFailure` below. Until the CRM
 * endpoint exists this outcome happens on every single submission, so dumping
 * the full record here would mean two identical PII blocks per lead forever.
 * That is worse on both counts that matter: whoever greps these logs to follow
 * leads up by hand has to de-duplicate every hit, and the site spreads personal
 * data over more lines than it needs to. The `received` line immediately above
 * it already holds everything; this one only has to say "and it went nowhere",
 * with the `leadId` to join on.
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
 * Call when a real CRM call succeeds. Unreachable until the stub is replaced.
 * Concise for the same reason as `delivery-skipped`: on the happy path the CRM
 * holds the lead, so this server's log no longer has to be its only copy.
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
