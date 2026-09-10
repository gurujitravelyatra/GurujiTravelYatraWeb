import type { LeadPayload, LeadSubmissionPort, LeadSubmissionResult } from '../ports';

/** Matches the export's own `setTimeout(...,900)` so the "Sending…" modal step is exercisable. */
const SIMULATED_DELAY_MS = 900;

/**
 * BLOCKERS.md Decision B — this exact copy, verbatim. Deliberately written
 * as an unfinished-looking placeholder (not polished marketing copy) so it
 * can never be mistaken for shippable text, while still being genuinely
 * actionable (the phone number is the real one from the design export).
 */
const VISITOR_SAFE_MESSAGE =
  "Online enquiry submission isn't connected yet — please call +91 90999 57658. (Placeholder copy — pending ERP integration.)";

/**
 * `LeadSubmissionPort` implementation for this sprint — tech spec §6.2,
 * BLOCKERS.md §1a / Decision A.
 *
 * This is the ONE well-named integration point for the eventual ERP lead
 * write. It intentionally never calls fetch/axios/XHR or any other network
 * primitive, and never invents a URL, payload shape, header, or API key —
 * doing so would fabricate a contract nobody has confirmed.
 *
 * TODO(ERP-LEAD-API): replace the body of `submitLead` with a real call once
 * the GTY ERP's lead-creation endpoint, payload schema and auth mechanism
 * are confirmed. See CLAUDE.md §10/§12 and
 * documentation/technical-specification/BLOCKERS.md §1a for the open
 * contract. Swapping this class for a real `ErpLeadAdapter` is the only
 * change required — no form/modal code should need to change.
 */
export class NotImplementedLeadAdapter implements LeadSubmissionPort {
  async submitLead(payload: LeadPayload): Promise<LeadSubmissionResult> {
    await new Promise<void>((resolve) => setTimeout(resolve, SIMULATED_DELAY_MS));

    if (process.env.NODE_ENV !== 'production') {
      // Developer-facing detail only — never rendered to a visitor. No PII
      // (name/mobile/email/message) is logged, only the non-identifying
      // routing fields.
      console.warn(
        '[NotImplementedLeadAdapter] Lead submission is not yet connected to the ERP API.',
        'This is a documented integration boundary — see CLAUDE.md §10/§12.',
        { source: payload.source, sourcePageUrl: payload.sourcePageUrl }
      );
    }

    return {
      status: 'error',
      retryable: true,
      message: VISITOR_SAFE_MESSAGE,
    };
  }
}

export const leadAdapter: LeadSubmissionPort = new NotImplementedLeadAdapter();
