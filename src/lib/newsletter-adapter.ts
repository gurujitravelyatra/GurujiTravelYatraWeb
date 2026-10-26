import { GTY_PHONE_DISPLAY } from './gty-contact';

/**
 * The newsletter signup's submit path — `Newsletter.tsx`'s only caller.
 *
 * ## Relocated and narrowed in CRM-migration Step 5
 *
 * This used to be `NotImplementedLeadAdapter`, a general `LeadSubmissionPort`
 * implementation living under the now-deleted `src/content/adapters/` that
 * ALSO (per its own header) once backed the Enquiry/Brochure/Group-
 * Reservation/Custom-Trip forms before those moved to the real `POST
 * /api/leads` -> CRM pipeline in CRM-migration Step 3. By Step 5 it had
 * exactly one caller left — `Newsletter.tsx` — because the CRM's own
 * `POST /public/enquiries` contract (documentation/technical-specification/
 * public-website.md) has no `kind` for a newsletter signup at all: only
 * `ENQUIRY`, `BROCHURE_REQUEST`, `RESERVE_SEAT` and `CUSTOM_TRIP`. So the
 * honest "not connected yet" behaviour below is unchanged from before this
 * migration — only its home and its shape (narrowed to what Newsletter
 * actually sends: an email and nothing else) changed.
 *
 * Deliberately never calls `fetch`/`axios`/any network primitive, and never
 * invents a URL, payload shape, header, or API key — doing so would
 * fabricate a contract nobody has confirmed. If the CRM ever adds a
 * newsletter-signup endpoint, this is the one place to wire it.
 */

const SIMULATED_DELAY_MS = 900;

export interface NewsletterSubmission {
  email: string;
  sourcePageUrl: string;
}

export type NewsletterSubmissionResult =
  | { status: 'success'; confirmationMessage: string }
  | { status: 'error'; message: string };

export async function submitNewsletterSignup(submission: NewsletterSubmission): Promise<NewsletterSubmissionResult> {
  // Matches the export's own `setTimeout(...,900)` so the "Sending…" state is exercisable.
  await new Promise<void>((resolve) => setTimeout(resolve, SIMULATED_DELAY_MS));

  if (process.env.NODE_ENV !== 'production') {
    // Developer-facing detail only — never rendered to a visitor, and no PII.
    console.warn(
      '[newsletter-adapter] Newsletter signup is not connected to any backend.',
      'This is a documented integration boundary, not a bug.',
      { sourcePageUrl: submission.sourcePageUrl }
    );
  }

  return {
    status: 'error',
    message: `Newsletter signup isn't connected yet, so we couldn't save your email — call ${GTY_PHONE_DISPLAY} and we'll tell you about new journeys directly. (Placeholder copy — pending a real signup integration.)`,
  };
}
