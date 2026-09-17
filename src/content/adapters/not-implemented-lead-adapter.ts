import type { LeadPayload, LeadSourceTag, LeadSubmissionPort, LeadSubmissionResult } from '../ports';
import { GTY_PHONE_DISPLAY } from '@/lib/gty-contact';

/** Matches the export's own `setTimeout(...,900)` so the "Sending…" modal step is exercisable. */
const SIMULATED_DELAY_MS = 900;

/**
 * BLOCKERS.md Decision B — deliberately written as unfinished-looking
 * placeholder text (not polished marketing copy) so it can never be mistaken
 * for shippable copy, while still being genuinely actionable (the phone number
 * is the real one).
 *
 * PARAMETERISED BY SOURCE. There is one adapter behind several very different
 * forms, and it used to answer all of them with the enquiry wording: someone
 * who typed an email into the newsletter box was told "Online enquiry
 * submission isn't connected yet — please call…", which describes neither what
 * they did nor anything they would want to do about it. The failure is the
 * same; the sentence describing it must match the form the visitor used.
 */
function visitorSafeMessage(source: LeadSourceTag): string {
  const pending = '(Placeholder copy — pending ERP integration.)';

  if (source === 'Newsletter Signup') {
    return `Newsletter signup isn't connected yet, so we couldn't save your email — call ${GTY_PHONE_DISPLAY} and we'll tell you about new journeys directly. ${pending}`;
  }
  if (source.startsWith('Brochure Download')) {
    return `Brochure requests aren't connected yet — please call ${GTY_PHONE_DISPLAY} and we'll send it across. ${pending}`;
  }
  return `Online enquiry submission isn't connected yet — please call ${GTY_PHONE_DISPLAY}. ${pending}`;
}

/**
 * `LeadSubmissionPort` implementation for this sprint — tech spec §6.2,
 * BLOCKERS.md §1a / Decision A.
 *
 * ## SCOPE NARROWED 2026-09-17 — this is now the NEWSLETTER's path only
 *
 * The Enquiry, Brochure, Group Tour Reservation and Custom Trip forms no longer
 * come through here. They POST to `/api/leads` via
 * `src/lib/leads/lead-api-client.ts` (BLOCKERS.md item 0).
 *
 * `Newsletter.tsx` is the one remaining caller, and deliberately so: it submits
 * `source: 'Newsletter Signup'`, which is a valid `LeadSourceTag` but has NO
 * member in the route's `formType` union — the server accepts only the four
 * tags with a real, built trigger. Repointing the newsletter at the route would
 * make it 400 on a `formType` it has no way to supply, so it keeps the honest
 * "not connected yet" answer until that contract exists.
 *
 * Do not widen this back over the other four forms. The port's flat,
 * client-chosen-`source` shape is the contract the route deliberately does not
 * have.
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
      message: visitorSafeMessage(payload.source),
    };
  }
}

export const leadAdapter: LeadSubmissionPort = new NotImplementedLeadAdapter();
