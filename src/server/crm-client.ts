import type { LeadSubmissionRecord } from './leads/lead-schema';

/**
 * The CRM lead hand-off — the one place that will ever talk to the CRM.
 *
 * ## Current state: a stub that delivers nothing, and says so
 *
 * The CRM's lead-creation endpoint, payload schema and auth mechanism are all
 * still unconfirmed (`documentation/technical-specification/BLOCKERS.md` §1a,
 * `Documents/guruji-travel-yatra-website-CLAUDE.md` §10 and §12 — "do not guess
 * these contracts and build against assumptions"). So this makes no network
 * call, invents no URL, header or field mapping, and — importantly — never
 * reports that a lead was delivered.
 *
 * ## The outcome type is the whole design
 *
 * A stub that returned a bare `true`/`{ok:true}` would be a fabricated CRM
 * response: every caller and every log downstream would record a delivery that
 * did not happen, and the first real sign of trouble would be a customer
 * complaining that nobody called them back. `CrmSubmissionOutcome` makes that
 * unrepresentable — `'delivered'` requires a `reference` that only a real CRM
 * response can supply, so no stub can construct one.
 *
 * `'logged-only'` is therefore an honest success: the visitor's submission was
 * accepted and recorded (see `src/server/leads/lead-log.ts`), and nothing
 * claims more than that. The route treats it as a 200 for exactly that reason,
 * not because it pretends the CRM answered.
 */

export type CrmSubmissionOutcome =
  /** A real CRM accepted the lead and returned an identifier for it. */
  | { status: 'delivered'; reference: string }
  /** No delivery happened. The lead exists only in this server's logs. */
  | { status: 'logged-only'; reason: string };

/**
 * TODO: replace this stub with a real call to POST /api/public/leads once the
 * CRM provides the endpoint URL and API key (see
 * Documents/guruji-travel-yatra-website-CLAUDE.md section 10).
 *
 * The replacement is deliberately contained to the body of this function —
 * no other file changes. Concretely, it becomes roughly:
 *
 * ```ts
 * const endpoint = process.env.CRM_LEADS_ENDPOINT;
 * const apiKey = process.env.CRM_API_KEY;
 * if (!endpoint || !apiKey) return { status: 'logged-only', reason: 'CRM_NOT_CONFIGURED' };
 *
 * const response = await fetch(endpoint, {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
 *   body: JSON.stringify(record),
 *   signal: AbortSignal.timeout(CRM_TIMEOUT_MS),
 * });
 * if (!response.ok) throw new Error(`CRM responded ${response.status}`);
 * return { status: 'delivered', reference: (await response.json()).id };
 * ```
 *
 * Note what does NOT change when that lands: the route still logs the lead
 * before calling this, still returns 200 to the visitor if this throws, and
 * still never lets a CRM failure become the visitor's problem. The env var
 * names above are already reserved in `.env.example`; both being unset is the
 * supported default, not a misconfiguration, for as long as §1a is open.
 *
 * @param record The validated submission plus the server-built `source` tag,
 *   `receivedAt` and `leadId`. Passed whole so the future real implementation
 *   can map fields itself without this signature changing again.
 */
export async function submitLeadToCrm(record: LeadSubmissionRecord): Promise<CrmSubmissionOutcome> {
  /**
   * Correlation only — deliberately NOT another copy of the payload.
   *
   * The route has already written the full record via `logLeadReceived` before
   * calling this, and that line is the documented safety net. Re-dumping name,
   * mobile, email and free text here would put three identical PII blocks in
   * the log for every lead, which makes the log harder to recover leads from,
   * not easier. `leadId` joins this line to the complete one.
   */
  console.info(
    `[crm] LEAD-SUBMISSION crm-stub-no-delivery ${JSON.stringify({
      event: 'crm-stub-no-delivery',
      leadId: record.leadId,
      source: record.source,
    })}`
  );

  return {
    status: 'logged-only',
    reason: 'CRM_NOT_CONFIGURED: lead-creation endpoint is unconfirmed (BLOCKERS.md §1a).',
  };
}
