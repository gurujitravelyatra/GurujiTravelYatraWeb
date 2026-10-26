import { z } from 'zod';

/**
 * CRM-migration Step 5: inlined here, narrowed to exactly the four tags this
 * schema's own `leadSubmissionSchema` can ever produce. Used to be imported
 * from `@/content/ports`'s wider `LeadSourceTag` (which also covered
 * `'Newsletter Signup'`, `'Contact Page'` and `'Service Enquiry – ${string}'`
 * — tags with no form behind them even before `src/content/**` was deleted).
 * `src/lib/newsletter-adapter.ts` needs none of this; it has exactly one
 * message now, not one per source tag.
 */
export type LeadSourceTag =
  | `Enquire Now – ${string}`
  | `Brochure Download – ${string}`
  | `Group Tour Reservation – ${string}`
  | 'Custom Trip Request';

/**
 * Server-side request contract for `POST /api/leads`.
 *
 * ## Derived from the frontend, not from the docs
 *
 * The previous attempt at this route was stopped because its payload contract
 * was reverse-engineered from `Documents/guruji-travel-yatra-website-CLAUDE.md`
 * and did not match what the modals actually build. Every field below is
 * therefore traced to a real line of client code:
 *
 * | Field            | Confirmed in                                              |
 * |------------------|-----------------------------------------------------------|
 * | `name`           | `LeadModal.runSubmit` / `lead-form-schema.ts`              |
 * | `mobile`         | idem — it is `mobile`, NOT `phone`                         |
 * | `email`          | idem                                                       |
 * | `travelDate`     | idem (`<input type="date">` → `YYYY-MM-DD`)                |
 * | `travellers`     | idem (coerced to `number`)                                 |
 * | `city`           | idem                                                       |
 * | `message`        | idem                                                       |
 * | `interestedIn`   | `LeadModal.runSubmit` → `context?.value` (a DISPLAY string) |
 * | `sourcePageUrl`  | `LeadModal.runSubmit` → `window.location.href`             |
 * | `utm`            | `LeadModal.extractUtm(window.location.search)`             |
 *
 * ## `source` is NOT accepted from the client
 *
 * `source`/`timestamp` are not fields any modal form sends, and would be
 * discarded even if one did — Zod objects strip unknown keys by default.
 * `source` is a routing/logging tag this server builds itself
 * (`buildSourceTag()`, below) from the structured context fields the modal
 * DOES send, precisely so a public, unauthenticated endpoint cannot be told
 * which tag to file a lead under. `timestamp` is likewise always this
 * server's own clock (`toLeadRecord`'s `receivedAt`), never the client's.
 *
 * ## Validation is strict on identity, permissive on everything else
 *
 * Nothing about a lead is persisted (see `BLOCKERS.md` §6) — a rejected
 * submission is a visitor permanently lost, not a row that can be repaired
 * later. So format rules exist only where the client already enforces the same
 * rule (name, mobile, email, URL) and would have blocked submission anyway.
 * Every other field gets a length cap and no shape assertion: a `travelDate`
 * this server does not recognise is still worth having in the log next to the
 * visitor's phone number. The caps are not cosmetic — this endpoint is
 * unauthenticated and its output goes to a log file, so unbounded strings and
 * unbounded arrays are a log-flooding vector.
 */

const MAX_NAME = 120;
const MAX_EMAIL = 254;
const MAX_SHORT_TEXT = 200;
const MAX_FREE_TEXT = 2000;
const MAX_URL = 2048;
/** `TripBuilder` clamps nights to 1..9 (`MIN_NIGHTS`/`MAX_NIGHTS`). */
const MIN_NIGHTS = 1;
const MAX_NIGHTS = 9;
const MAX_STOPS = 20;
/** A slug is a URL path segment — generous but not unbounded. */
const MAX_SLUG = 200;
/** Cloudflare Turnstile response tokens run long; this is a safety cap, not a real-world limit. */
const MAX_TURNSTILE_TOKEN = 4096;

/** Mirrors `lead-form-schema.ts` exactly — the client blocks anything else. */
const mobileRegex = /^[+]?[\d\s-]{10,15}$/;

/** `''` is what an untouched RHF text input submits; treat it as "not provided". */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Please keep this under ${max} characters.`)
    .optional()
    .transform((value) => (value === '' ? undefined : value));

/**
 * Fields every form type carries. Kept as a raw shape (not a `z.object`) so each
 * variant can spread it into its own object — `z.discriminatedUnion` requires
 * each member to be an object schema, so `.extend()` chains on a shared base
 * would work too, but spreading keeps each variant readable on its own.
 */
const commonFields = {
  name: z
    .string()
    .trim()
    .min(2, 'Please enter your full name.')
    .max(MAX_NAME, 'Please enter a shorter name.'),
  mobile: z
    .string()
    .trim()
    .min(1, 'Please enter your mobile number.')
    .regex(mobileRegex, 'Please enter a valid mobile number.'),
  email: z
    .union([z.literal(''), z.string().trim().max(MAX_EMAIL).email('Please enter a valid email address.')])
    .optional()
    .transform((value) => (value === '' ? undefined : value)),
  /**
   * Display string resolved from page context, e.g.
   * `"Spiti Valley Circuit · 9 Nights / 10 Days"` — never a slug, and never
   * re-asked of the visitor (CLAUDE.md §5.2).
   */
  interestedIn: optionalText(MAX_SHORT_TEXT),
  /** `YYYY-MM-DD` from `<input type="date">`. Not shape-validated — see header. */
  travelDate: optionalText(40),
  travellers: z.coerce.number().int().min(1, 'Enter at least 1 traveller.').max(99).optional(),
  city: optionalText(MAX_NAME),
  message: optionalText(MAX_FREE_TEXT),
  sourcePageUrl: z.string().trim().max(MAX_URL).url('A valid page URL is required.'),
  utm: z
    .object({
      source: optionalText(MAX_SHORT_TEXT),
      medium: optionalText(MAX_SHORT_TEXT),
      campaign: optionalText(MAX_SHORT_TEXT),
      content: optionalText(MAX_SHORT_TEXT),
      term: optionalText(MAX_SHORT_TEXT),
    })
    .optional(),
  /**
   * CRM-migration Step 3 — the three fields `POST /public/enquiries` itself
   * requires (documentation/technical-specification/public-website.md's
   * `POST /public/enquiries` §), collected by the modal alongside the
   * visitor's own fields rather than injected by the server, because only
   * the browser can solve a Turnstile challenge or know whether its hidden
   * honeypot input was filled.
   */
  consent: z.literal(true, { message: 'Please agree to be contacted to continue.' }),
  turnstileToken: z
    .string()
    .trim()
    .min(1, 'Please complete the verification challenge.')
    .max(MAX_TURNSTILE_TOKEN, 'Verification token is unexpectedly long — please retry.'),
  /**
   * Deliberately NOT constrained to be empty here. A bot that filled it in
   * is exactly the submission this field exists to catch — rejecting it at
   * THIS layer with a 400 would tip the bot off that something noticed;
   * forwarding it untouched lets the CRM's own honeypot check (contract
   * §`POST /public/enquiries`, step 2: "short-circuits to `{ok:true}` with
   * nothing checked or created") handle it the same way a real CRM caller
   * would see it.
   */
  honeypot: optionalText(MAX_SHORT_TEXT),
};

/**
 * `LeadModal.buildSourceTag` falls back to `'General enquiry'` when no page
 * context was passed, and that path is genuinely reachable: the Navbar's
 * persistent "Enquire Now" button calls `openEnquiry()` with no argument.
 * Rejecting a contextless enquiry would 404 the single most prominent CTA on
 * the site, so the server mirrors the client's fallback verbatim rather than
 * inventing a different one — two different tags for the same event would be
 * worse than one imperfect tag.
 */
export const NO_CONTEXT_FALLBACK = 'General enquiry';

/**
 * The four REACHABLE form types. `Contact Page` and `Service Enquiry` are in the
 * docs' source-tag table but `/contact-us` and `/our-services` do not exist yet,
 * so there is nothing that could send them; `Newsletter Signup` is in
 * `LeadSourceTag` but has no form either. Adding union members for flows with no
 * caller would be inventing a contract, so they are deliberately absent — see
 * the "pending" rows in CLAUDE.md §5.
 */
export const leadSubmissionSchema = z.discriminatedUnion('formType', [
  z.object({
    formType: z.literal('enquiry'),
    ...commonFields,
    /** Page/context label → `Enquire Now – [Page]`. */
    pageName: optionalText(MAX_SHORT_TEXT),
    /** CRM-migration Step 3 — `CrmEnquiryRequest.tourSlug`, when the trigger has a real tour behind it (the detail page); absent for page-level context (Navbar, Home, About Us). */
    tourSlug: optionalText(MAX_SLUG),
  }),
  z.object({
    formType: z.literal('brochure'),
    ...commonFields,
    /** → `Brochure Download – [Package Name]`. */
    packageName: optionalText(MAX_SHORT_TEXT),
    tourSlug: optionalText(MAX_SLUG),
  }),
  z.object({
    formType: z.literal('group-tour-reservation'),
    ...commonFields,
    tourSlug: optionalText(MAX_SLUG),
    /**
     * REQUIRED, unlike the other context fields. The tag is
     * `Group Tour Reservation – [Batch Date]`; without the date it degrades to
     * an unroutable `Group Tour Reservation – General enquiry`, and a
     * time-sensitive seat request that cannot be tied to a departure is the one
     * case where failing loudly beats filing a vague lead. `GroupDeparture`
     * carries this as `dateRangeLabel` (e.g. `"12 — 18 May 2026"`).
     */
    batchDate: z.string().trim().min(1, 'A departure date is required.').max(MAX_SHORT_TEXT),
    /** `GroupDeparture.name` — kept for the log; not part of the tag. */
    departureName: optionalText(MAX_SHORT_TEXT),
  }),
  z.object({
    formType: z.literal('custom-trip'),
    ...commonFields,
    /**
     * The "richer than other lead types" payload CLAUDE.md §5 promises. Every
     * field here is real `TripBuilder` state (`src/components/customize-tours/
     * TripBuilder.tsx`), not a guess from the docs:
     *   `trip` → stops, `travelStyle`, `travelMonth`, `adults`,
     *   `childrenCount`, `notes`.
     *
     * NOTE: the docs say this payload includes a "budget". There is no budget
     * input in `TripBuilder`; `travelStyle` (Budget/Comfort/Premium/Luxury) is
     * the only price-tier signal the builder collects, so that is what is
     * modelled. No numeric budget field was invented to satisfy the sentence.
     */
    stops: z
      .array(
        z.object({
          slug: z.string().trim().min(1).max(MAX_NAME),
          name: z.string().trim().min(1).max(MAX_NAME),
          region: optionalText(MAX_NAME),
          nights: z.coerce.number().int().min(MIN_NIGHTS).max(MAX_NIGHTS),
        })
      )
      .max(MAX_STOPS)
      /**
       * An EMPTY array is valid. `TripBuilder`'s "Get My Custom Quote" button is
       * not disabled on an empty trip — it opens the modal with the label
       * `'Custom trip'` — so "I want a custom trip but haven't picked anywhere
       * yet" is a real, and rather valuable, lead.
       */
      .default([]),
    travelStyle: z.enum(['Budget', 'Comfort', 'Premium', 'Luxury']).optional(),
    /** Free text: `TripBuilder` stores `''` and displays `'Any month'`. */
    travelMonth: optionalText(40),
    adults: z.coerce.number().int().min(1).max(50).optional(),
    childrenCount: z.coerce.number().int().min(0).max(50).optional(),
    /** `AdditionalPreferencesStep` notes — distinct from the modal's `message`. */
    notes: optionalText(MAX_FREE_TEXT),
  }),
]);

export type LeadSubmissionInput = z.infer<typeof leadSubmissionSchema>;
export type LeadFormType = LeadSubmissionInput['formType'];

/**
 * Builds this server's own internal routing/logging tag, from structured
 * context only. Returns the `LeadSourceTag` type declared at the top of this
 * file, so a tag shape that drifts from the documented format fails to
 * compile.
 *
 * Note this tag is NOT sent to the CRM (`CrmEnquiryRequest` has no `source`
 * field) — it exists purely for this server's own response body
 * (`POST /api/leads`'s `data.source`) and log lines (`lead-log.ts`); the
 * CRM-facing mapping is `crm-enquiry-mapper.ts`'s job.
 */
export function buildSourceTag(input: LeadSubmissionInput): LeadSourceTag {
  switch (input.formType) {
    case 'enquiry':
      return `Enquire Now – ${input.pageName ?? NO_CONTEXT_FALLBACK}`;
    case 'brochure':
      return `Brochure Download – ${input.packageName ?? NO_CONTEXT_FALLBACK}`;
    case 'group-tour-reservation':
      return `Group Tour Reservation – ${input.batchDate}`;
    case 'custom-trip':
      return 'Custom Trip Request';
  }
}

/**
 * What the server actually holds: the validated submission, the server-built
 * tag, a server clock reading, and a correlation id.
 *
 * `receivedAt` is stamped HERE and any client `timestamp` is ignored. The
 * client's clock is attacker-controlled on a public endpoint and wrong on a
 * surprising number of real devices; since this value is the only ordering
 * information a log reader will ever have for a lead, it has to come from the
 * machine writing the log.
 */
export interface LeadSubmissionRecord {
  leadId: string;
  receivedAt: string;
  source: LeadSourceTag;
  submission: LeadSubmissionInput;
}

export function toLeadRecord(input: LeadSubmissionInput): LeadSubmissionRecord {
  return {
    leadId: crypto.randomUUID(),
    receivedAt: new Date().toISOString(),
    source: buildSourceTag(input),
    submission: input,
  };
}

/**
 * Flattens Zod issues to `{ 'field.path': [messages] }` for `ApiFailure.fields`.
 *
 * Built from `error.issues` rather than `error.flatten()` because `flatten()`
 * only reports top-level keys: a bad `stops[0].nights` or `utm.source` would
 * vanish from `fieldErrors` entirely, and the modal would show a form-level
 * "something's wrong" with no indication of which input to fix — the exact
 * "don't make them re-type everything" failure CLAUDE.md §5.4 forbids.
 */
export function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : 'formType';
    (fields[key] ??= []).push(issue.message);
  }
  return fields;
}
