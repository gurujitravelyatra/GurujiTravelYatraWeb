'use client';

import * as React from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, Loader2, Send, X } from 'lucide-react';

import { ModalShell } from './ModalShell';
import { Field, FIELD_INPUT_CLASS } from './Field';
import { extractUtm } from './extract-utm';
import type { ModalContext } from './modal-context';
import type { LeadDetails } from './lead-details';
import { buildLeadRequest } from './build-lead-request';
import { submitLeadRequest } from '@/lib/leads/lead-api-client';
import { leadFormDefaultValues, leadFormSchema, type LeadFormValues } from './lead-form-schema';
import { PhoneField } from './PhoneField';
import { DateField } from './DateField';
import { TurnstileWidget } from './TurnstileWidget';
import { GTY_PHONE_DISPLAY, GTY_PHONE_TEL } from '@/lib/gty-contact';
import { Button } from '@/components/ui/button';

/** The reference's `.form-row`: two fields side by side with a 14px gap from 781px up, stacked (same 14px gap) below. */
const FORM_ROW_CLASS = 'grid grid-cols-1 gap-3.5 enquiry:grid-cols-2';

/**
 * CRM-migration Step 3: the public half of the Turnstile key pair — see
 * `TurnstileWidget.tsx`'s own header for why this is safe as a build-time
 * `NEXT_PUBLIC_` value. UNSET IS A SUPPORTED MODE, like
 * `NEXT_PUBLIC_MEDIA_HOST`: the widget is not rendered at all, and the
 * "Please complete the verification challenge." message on
 * `turnstileToken` — which no input ever sets without the widget — is what
 * a visitor sees if they try to submit anyway. This is honest, not a bug:
 * `POST /public/enquiries` would reject an empty token regardless, so there
 * is no configuration in which omitting the key quietly lets a submission
 * through.
 */
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export type LeadModalVariant = 'enquiry' | 'brochure';

export interface LeadModalProps {
  variant: LeadModalVariant;
  open: boolean;
  /** Real page/package context only — see BLOCKERS.md Decision F. Omit entirely when there is none; never fall back to a fabricated default. */
  context?: ModalContext;
  /**
   * The `formType`-tagged payload context from the trigger. Optional because
   * `variant` + `context` already fully describe a plain enquiry or brochure
   * request; only the richer flows (group reservation, custom trip) need to say
   * more. See `detailsForVariant` for the fallback.
   */
  details?: LeadDetails;
  /**
   * `GET /public/site`'s `happyTravellersLabel` — the intro column's proof
   * pill. `null`/omitted hides the pill entirely rather than showing an
   * invented figure (see `layout.tsx` for where the real two call sites,
   * `EnquiryModal`/`BrochureModal`, get it from). Optional only so the
   * many existing unit tests that render `<LeadModal>` directly, without
   * a proof pill in scope at all, don't all have to pass it.
   */
  happyTravellersLabel?: string | null;
  onClose: () => void;
}

type Step = 'form' | 'done';

/**
 * All modal copy. Nothing here may assert a backend capability that does not
 * exist yet.
 *
 * CRM-migration Step 3: `POST /api/leads` now validates the submission,
 * writes it to the server log (the safety net — see `lead-log.ts`), maps it
 * onto `CrmEnquiryRequest` (`src/server/leads/crm-enquiry-mapper.ts`) and
 * calls the CRM's real `POST /public/enquiries` via `submitEnquiry()`
 * (`src/server/crm/client.ts`) — there genuinely is a CRM behind it now. A
 * CRM failure still never becomes the visitor's problem (the route still
 * returns 200 off the log line alone if the CRM call throws/rejects — see
 * `route.ts`'s own header), so the form step still may not claim guaranteed
 * delivery, just as before.
 *
 * New brief (2026-11-15): both variants now share ONE visible marketing
 * heading ("Tell us where your heart leads.", hardcoded in `FormStep` —
 * see that component), matching the reference popup, which is not
 * per-variant copy. `copy.title` still differs per variant and still
 * labels the dialog itself (the sr-only Radix `DialogTitle` `ModalShell`
 * renders) — an accessible name is still allowed to say more than a
 * marketing headline does.
 */
const COPY: Record<LeadModalVariant, { title: string; description: string; cta: string; ctxLabel: string }> = {
  enquiry: {
    title: 'Talk to GTY',
    description: "Share a few details and our trip designers will shape the rest around you.",
    cta: 'Send my enquiry',
    ctxLabel: 'Enquiring about',
  },
  brochure: {
    title: 'Get Your Complete Travel Brochure',
    description: 'Get the complete itinerary, inclusions, pricing and travel information.',
    cta: 'Get my brochure',
    ctxLabel: 'Brochure for',
  },
};

/** Inert stub for the brochure done-step's download button — see TODO(brochure-unlock) below. */
function noop() {}

/**
 * The `formType` a plain Enquiry/Brochure trigger implies.
 *
 * `pageName`/`packageName` come from the context chip because that IS the page
 * context — the same string the visitor is looking at while they type. There is
 * deliberately no fallback when context is absent (the Navbar's persistent
 * "Enquire Now" has none): the server supplies `'General enquiry'` itself, and
 * two independent fallbacks would eventually disagree.
 *
 * The source tag is no longer built here at all. It is derived server-side from
 * these fields, so a public endpoint cannot be told which CRM bucket to file a
 * lead under.
 */
function detailsForVariant(variant: LeadModalVariant, context?: ModalContext): LeadDetails {
  return variant === 'brochure'
    ? { formType: 'brochure', packageName: context?.value, tourSlug: context?.tourSlug }
    : { formType: 'enquiry', pageName: context?.value, tourSlug: context?.tourSlug };
}

/**
 * The inputs the visitor can actually see and fix. A 400 naming any of these
 * is shown inline on the field itself (the same `Field error` slot client-side
 * Zod already uses); a 400 naming anything else — `sourcePageUrl`, `batchDate`,
 * `stops.0.nights`, `utm.source` — has no input to attach to and is appended to
 * the banner instead, because a validation message with nowhere to render is
 * how a form becomes un-submittable with no explanation.
 */
const FORM_FIELD_NAMES = [
  'name',
  'mobile',
  'email',
  'travelDate',
  'travellers',
  'city',
  'message',
  'consent',
  'turnstileToken',
] as const;

function isFormFieldName(key: string): key is (typeof FORM_FIELD_NAMES)[number] {
  return (FORM_FIELD_NAMES as readonly string[]).includes(key);
}

/** The first word of whatever the visitor typed as their name — "there" for the pathological empty-after-trim case `leadFormSchema.min(2)` already should have blocked. */
function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] || 'there';
}

/**
 * The route's success body carries no visitor-facing copy — only `leadId`,
 * `source` and `receivedAt` — so the confirmation panel's copy is composed
 * here from context the client already has, rather than from a server
 * string that does not exist.
 *
 * New brief (2026-11-15), item 4: a named, personal confirmation
 * ("Thank you, <first name>!") for an enquiry; the brochure variant keeps
 * its own distinct line ("Your brochure is ready.") since the CTA beneath
 * it differs too (a download, not "keep browsing").
 */
function buildDoneCopy(variant: LeadModalVariant, name: string): { heading: string; body: string } {
  if (variant === 'brochure') {
    return { heading: 'Thank you!', body: 'Your brochure is ready.' };
  }
  return {
    heading: `Thank you, ${firstNameOf(name)}!`,
    body: 'Your enquiry has been submitted. Team Guruji will contact you very soon.',
  };
}

/** The toast's own one-line copy — a lighter-weight, auto-dismissing echo of the confirmation panel, per the new brief's item 4. */
function toastCopy(variant: LeadModalVariant): string {
  return variant === 'brochure' ? 'Brochure request submitted' : 'Enquiry submitted';
}

/**
 * The shared Enquiry/Brochure form + step machine (tech spec §4.3). Both
 * `EnquiryModal` and `BrochureModal` are thin wrappers around this.
 */
export function LeadModal({
  variant,
  open,
  context,
  details,
  happyTravellersLabel = null,
  onClose,
}: LeadModalProps) {
  const copy = COPY[variant];
  const [step, setStep] = React.useState<Step>('form');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [doneCopy, setDoneCopy] = React.useState({ heading: '', body: '' });
  const [toastVisible, setToastVisible] = React.useState(false);
  const toastTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: leadFormDefaultValues,
  });

  // Reset the STEP machine (never the entered field values) each time the
  // modal transitions from closed to freshly open, so a previous session's
  // error/done/toast state can't leak into the next open. Adjusted during
  // render (React's recommended pattern for "reset state when a prop
  // changes") rather than in an effect, so there is no extra synchronous
  // setState inside a `useEffect` body.
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setStep('form');
      setErrorMessage(null);
      setToastVisible(false);
    }
  }

  const { setError } = form;

  const showToast = React.useCallback(() => {
    setToastVisible(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastVisible(false), 3200);
  }, []);

  const runSubmit = React.useCallback(
    async (values: LeadFormValues) => {
      setErrorMessage(null);

      const request = buildLeadRequest({
        details: details ?? detailsForVariant(variant, context),
        values: {
          name: values.name,
          mobile: values.mobile,
          email: values.email,
          travelDate: values.travelDate,
          travellers:
            values.travellers === '' || values.travellers === undefined ? undefined : Number(values.travellers),
          city: values.city,
          message: values.message,
        },
        // `consent` is implicit, not a checkbox the visitor ticks (item 4,
        // 2026-11-15) — `leadFormSchema`'s own default is `true` and
        // nothing in the UI ever sets it otherwise, so this is always a
        // real `true`, not a cast papering over an unconfirmed value.
        security: { consent: true, turnstileToken: values.turnstileToken, honeypot: values.honeypot },
        interestedIn: context?.value,
        // sourcePageUrl / utm are read ONLY here, inside the submit event
        // handler — never during render (no useSearchParams()), so no
        // hydration mismatch and no forced-dynamic route.
        sourcePageUrl: window.location.href,
        utm: extractUtm(window.location.search),
      });

      const result = await submitLeadRequest(request);

      if (result.status === 'success') {
        setDoneCopy(buildDoneCopy(variant, values.name));
        setStep('done');
        showToast();
        return;
      }

      // Error path (BLOCKERS.md Decision B / tech spec §4.3): stay on the
      // form step, keep every entered value (no form.reset()), surface a
      // dismissible banner with "Try Again".
      //
      // Field-level 400s are routed to the inputs themselves via RHF's
      // `setError`, which renders through the very same `Field`/`error` slot
      // the client-side Zod resolver already uses — so a server rule and a
      // client rule are indistinguishable to the visitor, and no second error
      // UI had to be invented. RHF clears these automatically on the next
      // submit, when the resolver rebuilds the error object from scratch.
      const unattached: string[] = [];
      for (const [key, messages] of Object.entries(result.fields ?? {})) {
        const [message] = messages;
        if (!message) continue;
        if (isFormFieldName(key)) {
          setError(key, { type: 'server', message });
        } else {
          unattached.push(message);
        }
      }

      setErrorMessage([result.message, ...unattached].join(' '));
      setStep('form');
    },
    [context, details, setError, showToast, variant]
  );

  return (
    <ModalShell
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={copy.title}
      description={copy.description}
      // New brief (2026-11-15), item 4: "also show a toast ...". There is
      // no toast system anywhere else on the site (no `sonner`/shadcn
      // `Toast`, confirmed before building this), so this is a small,
      // self-contained one rather than a new dependency. See
      // `ModalShell.tsx`'s own `toast` prop doc for why it has to be
      // rendered THROUGH that prop rather than as a sibling of
      // `<ModalShell>` here.
      toast={
        toastVisible && (
          <div
            role="status"
            aria-live="polite"
            className="fixed inset-x-0 bottom-6 z-[70] flex justify-center px-4"
          >
            <div className="flex items-center gap-2 rounded-full bg-stone-900 px-5 py-3 text-[13px] font-semibold text-white shadow-[0_20px_40px_-20px_rgba(0,0,0,0.5)]">
              <Check size={14} className="text-emerald-400" aria-hidden="true" />
              {toastCopy(variant)}
            </div>
          </div>
        )
      }
    >
      {step === 'form' && (
        <FormStep
          copy={copy}
          context={context}
          happyTravellersLabel={happyTravellersLabel}
          form={form}
          errorMessage={errorMessage}
          onDismissError={() => setErrorMessage(null)}
          // `react-hooks/refs` flags this: `runSubmit` closes over
          // `toastTimerRef` (via `showToast`), and the rule conservatively
          // treats any ref-closing function handed to another function
          // call made during render as a possible same-tick `.current`
          // read. `form.handleSubmit(fn)` only ever WRAPS `fn` here — it is
          // called later, from the browser's real submit event, never
          // synchronously during this render — which is exactly the
          // react-hook-form-recommended `onSubmit={form.handleSubmit(fn)}`
          // pattern already used unchanged elsewhere in this file (e.g.
          // `PhoneField`'s own `onChange`). The actual `toastTimerRef.current`
          // read/write happens only inside `showToast`, itself only ever
          // called from inside `runSubmit`'s event-handler body — never
          // during render.
          // eslint-disable-next-line react-hooks/refs
          onSubmit={form.handleSubmit(runSubmit)}
          onClose={onClose}
        />
      )}
      {step === 'done' && (
        <DoneStep variant={variant} heading={doneCopy.heading} body={doneCopy.body} onClose={onClose} />
      )}
    </ModalShell>
  );
}

interface FormStepProps {
  copy: (typeof COPY)[LeadModalVariant];
  context?: ModalContext;
  happyTravellersLabel: string | null;
  form: UseFormReturn<LeadFormValues>;
  errorMessage: string | null;
  onDismissError: () => void;
  onSubmit: (event?: React.BaseSyntheticEvent) => void;
  onClose: () => void;
}

/**
 * New brief (2026-11-15, "horizontal card") — the popup is now a genuine
 * horizontal `.enquiry-card`, not a narrow scrolling column: a two-column
 * CSS grid from 781px up (`IntroColumn` | the cream-box form), collapsing
 * to a single stacked column below that. See `ModalShell.tsx` for the
 * outer card's own radius/border/shadow/width/breakpoint.
 *
 * ## The height budget (desktop only)
 *
 * The brief requires the WHOLE card to fit under 92vh at four specific
 * desktop viewports, several of them short (600-700px tall), with NO
 * scrollbar anywhere — not a max-height-and-clip trick, the content
 * itself has to be short enough. Every vertical measurement below that
 * matters for that budget (outer card padding, the cream box's own
 * padding, the gap between field rows, each field's own height) is a
 * `clamp()` keyed partly to `vh`, so it shrinks on a SHORT viewport
 * without needing a separate "very short" breakpoint — confirmed against
 * real screenshots at 1920x1080/1440x700/1366x640/1280x600 (see
 * `scratch/capture-popup-wide.mjs` and `design-review/popup-wide/`), not
 * just computed by eye.
 */
function FormStep({
  copy,
  context,
  happyTravellersLabel,
  form,
  errorMessage,
  onDismissError,
  onSubmit,
  onClose,
}: FormStepProps) {
  const {
    register,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = form;

  return (
    // Reference match (2026-11-17): 64px card padding and a 70px column gap
    // from 781px up, 30px 20px below; vertical spacing via the `enquiry-*`
    // tokens (exact reference values on phones and on desktop screens
    // 900px+ tall, proportionally less on shorter desktops).
    <div className="relative bg-white px-5 py-enquiry-30 font-redux-sans enquiry:p-enquiry-64">
      {/* Brief §13 ("ACCEPTANCE") requires every tap target >= 44px — `-m-[11px]` + `p-[11px]` keeps the visible 18px icon compact while the actual hit area is 44x44. */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-3 top-3 -m-[11px] grid h-11 w-11 flex-none place-items-center rounded-full p-[11px] text-stone-400 transition-colors hover:bg-stone-100 hover:text-enquiry-red"
      >
        <X size={18} />
      </button>

      <div className="block enquiry:grid enquiry:grid-cols-[0.9fr_1.1fr] enquiry:gap-x-17.5">
        <IntroColumn copy={copy} context={context} happyTravellersLabel={happyTravellersLabel} />

        {/* The cream box — `.enquiry-form` in the reference. */}
        <div className="rounded-22 border border-enquiry-line bg-enquiry-cream px-4 py-5 enquiry:p-enquiry-30">
          {/* `.form-heading`: decided deviation — no "01 / 03" step counter, heading left-aligned. */}
          <div className="mb-enquiry-22 border-b border-enquiry-line pb-enquiry-17">
            <h3 className="font-redux-display text-20 font-medium leading-[30px] text-enquiry-ink">
              Let&rsquo;s make it personal.
            </h3>
          </div>

          {/* `method`/`action` are belt-and-braces (item 3): the REAL guard is that `handleSubmit` always calls `preventDefault()` before anything else runs, on every submit attempt, valid or not. */}
          <form onSubmit={onSubmit} noValidate method="post" action="#" className="block">
            {errorMessage && (
              <div
                role="alert"
                // The per-field messages below are `role="alert"` too (they have to
                // be — that is how a screen reader hears a validation failure), so
                // "the banner" is no longer addressable by role alone now that both
                // can be on screen at once. Tests target this id rather than
                // `getByRole('alert')`, which silently matched the only alert there
                // used to be.
                data-testid="lead-form-error"
                className="mb-enquiry-17 flex flex-col gap-2 rounded-2xl border border-enquiry-red/30 bg-enquiry-red/10 p-3 text-[13px] text-enquiry-red"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="leading-relaxed">
                    <p>{errorMessage}</p>
                    {/*
                      New brief (2026-11-15), item 4: a clear phone-number
                      fallback on every failure. Appended alongside — not in
                      place of — the specific server/network message above:
                      `LeadModal.server-errors.test.tsx` depends on that exact
                      message reaching the field it is about (a 400 on
                      `batchDate`/`sourcePageUrl`/etc. has nowhere inline to
                      render and would otherwise vanish with no explanation),
                      so a visitor always sees both what went wrong AND a way
                      to get help regardless.
                    */}
                    <p className="mt-1">
                      Please try again or call{' '}
                      <a href={`tel:${GTY_PHONE_TEL}`} className="font-semibold underline">
                        {GTY_PHONE_DISPLAY}
                      </a>
                      .
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onDismissError}
                    aria-label="Dismiss"
                    className="-m-[14px] grid h-11 w-11 flex-none place-items-center p-[14px] text-enquiry-red"
                  >
                    <X size={16} />
                  </button>
                </div>
                <Button type="submit" variant="default" size="sm" className="self-start">
                  Try Again
                </Button>
              </div>
            )}

            {/*
              New brief (2026-11-15, "horizontal card"): a compact 2-column
              field grid so the whole form fits the height budget — Name |
              City, Mobile | Email, Travel date | Travellers, then Message
              full-width. Single column (unchanged field order top-to-
              bottom) below 781px, where scrolling is allowed again.

              Reference match (2026-11-17): each pair is the reference's
              `.form-row` (two columns, 14px gap; one column below 781px),
              and every field keeps 17px below it, exactly as the
              reference's own label blocks do.
            */}
            <div className={FORM_ROW_CLASS} data-testid="lead-form-row">
              {/*
                New brief (2026-11-15, final corrections), item 6: audited
                against the real contract (`src/server/leads/lead-schema.ts`
                and the CRM's own documented `POST /public/enquiries`
                fields, `city`/`travelDate`/`travellers`/`email`/`message`
                are ALL optional end to end — `city` has no CRM field at
                all, it is folded into `message` text by
                `crm-enquiry-mapper.ts`). Name and Mobile Number are the
                only two fields either layer actually requires.
              */}
              <Field label="Name" required htmlFor="lead-name" error={errors.name?.message}>
                <input
                  id="lead-name"
                  autoComplete="name"
                  className={FIELD_INPUT_CLASS}
                  aria-invalid={!!errors.name}
                  {...register('name')}
                />
              </Field>
              <Field label="City" optional htmlFor="lead-city" error={errors.city?.message}>
                <input
                  id="lead-city"
                  autoComplete="address-level2"
                  className={FIELD_INPUT_CLASS}
                  aria-invalid={!!errors.city}
                  {...register('city')}
                />
              </Field>
            </div>

            <div className={FORM_ROW_CLASS} data-testid="lead-form-row">
              <Field label="Mobile Number" required htmlFor="lead-mobile" error={errors.mobile?.message}>
                <PhoneField control={control} id="lead-mobile" aria-invalid={!!errors.mobile} />
              </Field>
              <Field label="Email" optional htmlFor="lead-email" error={errors.email?.message}>
                <input
                  id="lead-email"
                  type="email"
                  autoComplete="email"
                  className={FIELD_INPUT_CLASS}
                  aria-invalid={!!errors.email}
                  {...register('email')}
                />
              </Field>
            </div>

            <div className={FORM_ROW_CLASS} data-testid="lead-form-row">
              {/* Item 8: wrapped in a `DateField` — a click anywhere on the box, not only the native calendar icon, opens the picker. */}
              <Field label="Travel Date" optional htmlFor="lead-travel-date" error={errors.travelDate?.message}>
                <DateField id="lead-travel-date" aria-invalid={!!errors.travelDate} {...register('travelDate')} />
              </Field>
              {/*
                Item 9: digits only. `type="text"` (not `"number"`) is
                deliberate — a `number` input lets the browser's own spinner
                and `e`/`+`/`-`/`.` keys through regardless of `pattern`,
                which is exactly what this is trying to rule out.
                `onChange` strips every non-digit as it is typed; `onPaste`
                replaces the field's value outright with the digits-only
                version of whatever was pasted (bypassing the native paste
                insertion entirely, so there is no cursor-position
                bookkeeping to get wrong); `onBlur` clamps to 1-99 — not
                onChange, so typing "1" then "0" to reach "10" is never
                fought by a premature clamp to "1".
              */}
              <Field label="Travellers" optional htmlFor="lead-travellers" error={errors.travellers?.message}>
                <input
                  id="lead-travellers"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="e.g. 4"
                  className={FIELD_INPUT_CLASS}
                  aria-invalid={!!errors.travellers}
                  {...register('travellers', {
                    // react-hook-form composes a custom `onChange`/`onBlur`
                    // passed in `register`'s OWN options with its internal
                    // handler — passing these as separate JSX props after
                    // the spread instead would silently overwrite (not
                    // compose with) RHF's own handler.
                    onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                      const digitsOnly = event.target.value.replace(/\D/g, '');
                      if (digitsOnly !== event.target.value) {
                        setValue('travellers', digitsOnly === '' ? '' : Number(digitsOnly), { shouldValidate: true });
                      }
                    },
                    onBlur: (event: React.FocusEvent<HTMLInputElement>) => {
                      const raw = event.target.value;
                      if (raw !== '') {
                        const clamped = Math.min(99, Math.max(1, Number.parseInt(raw, 10) || 1));
                        setValue('travellers', clamped, { shouldValidate: true });
                      }
                    },
                  })}
                  onPaste={(event) => {
                    event.preventDefault();
                    const digitsOnly = event.clipboardData.getData('text').replace(/\D/g, '');
                    setValue('travellers', digitsOnly === '' ? '' : Number(digitsOnly), { shouldValidate: true });
                  }}
                />
              </Field>
            </div>

            {/* No reference counterpart: the reference input look, two lines tall (ESTIMATED, spec §4). */}
            <Field label="Message" optional htmlFor="lead-message" error={errors.message?.message}>
              <textarea
                id="lead-message"
                rows={2}
                className={`${FIELD_INPUT_CLASS} resize-none`}
                aria-invalid={!!errors.message}
                {...register('message')}
              />
            </Field>

            {/*
              Honeypot: a decoy field a real visitor never sees (off-screen, not
              `display:none`/`hidden` — some bots skip those two specifically —
              and `tabIndex={-1}`/`aria-hidden` so it is unreachable by keyboard
              or a screen reader) or fills in. `name="company"` is a plausible-
              looking label for a scraping bot that fills every input it finds;
              a real visitor's browser autofill has no reason to touch it either,
              since it matches no real autofill token. `POST /api/leads` forwards
              whatever this holds to the CRM untouched — see
              `crm-enquiry-mapper.ts`'s own comment on why it is not validated to
              be empty HERE.
            */}
            <div aria-hidden="true" className="absolute left-[-9999px] top-auto h-0 w-0 overflow-hidden">
              <label htmlFor="lead-company">Company</label>
              <input id="lead-company" type="text" tabIndex={-1} autoComplete="off" {...register('honeypot')} />
            </div>

            {/*
              New brief (2026-11-15, final corrections), item 4: the
              checkbox is gone — `consent` is sent as `true` implicitly on
              every submit (`runSubmit`'s own `security: { consent: true,
              ... }`, unchanged — it was already hardcoded, never actually
              read from this checkbox's own state even before this edit).
              The disclosure the checkbox used to carry now lives in the
              note line under the submit button instead of a control the
              visitor has to act on.
            */}

            {/*
              New brief (2026-11-15, final corrections), item 5: no site
              key configured renders NOTHING here — not an explanatory
              placeholder. `POST /public/enquiries` still rejects an empty
              `turnstileToken` regardless (see the module-level comment on
              `TURNSTILE_SITE_KEY`), so omitting the explanation changes
              nothing about whether a submission can succeed, only what is
              shown in this slot while it cannot.
            */}
            {TURNSTILE_SITE_KEY && (
              <div className="flex justify-center">
                <TurnstileWidget
                  siteKey={TURNSTILE_SITE_KEY}
                  onVerify={(token) => setValue('turnstileToken', token, { shouldValidate: true })}
                  onExpire={() => setValue('turnstileToken', '', { shouldValidate: true })}
                />
              </div>
            )}
            {errors.turnstileToken && (
              <p role="alert" className="mb-enquiry-17 text-center text-xs text-enquiry-red">
                {errors.turnstileToken.message}
              </p>
            )}

            {/*
              New brief (2026-11-15), item 4: the spinner lives INSIDE the
              button (disabled while sending) — the form stays on screen, it
              does not get swapped out for a separate "sending" screen. That
              also means a double submit is simply impossible: the button is
              `disabled` for the whole in-flight window react-hook-form's own
              `formState.isSubmitting` already tracks.

              Reference match (2026-11-17): the reference's `.button-red`
              (13px bold, 15px 22px padding, pill, solid red shadow; hover
              darker red, bigger shadow, 3px lift, 0.25s ease). `transform`
              is set as a plain property, as the reference does, so the
              transition list matches it exactly.
            */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-enquiry-6 flex w-full items-center justify-center gap-2.5 rounded-enquiry-btn bg-enquiry-red px-5.5 py-enquiry-btn-y text-13 font-bold leading-[19.5px] text-white [box-shadow:var(--shadow-enquiry-btn)] transition-[transform,box-shadow,background-color] duration-250 ease-gty hover:bg-enquiry-red-dark hover:[box-shadow:var(--shadow-enquiry-btn-hover)] hover:[transform:translateY(-3px)] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-enquiry-red disabled:hover:[box-shadow:var(--shadow-enquiry-btn)] disabled:hover:[transform:none]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  Sending…
                </>
              ) : (
                <>
                  {copy.cta}
                  <Send size={16} aria-hidden="true" />
                </>
              )}
            </button>
            {/* The reference's `.form-note`. */}
            <p className="mt-enquiry-12 text-center text-10 leading-[15px] text-enquiry-note">
              No pressure, no spam, just thoughtful travel ideas.
            </p>
            {/* Item 4's replacement for the removed consent checkbox — the disclosure, not a control. Form-note look, 4px below it (ESTIMATED, no reference counterpart). */}
            <p className="mt-enquiry-4 text-center text-10 leading-[15px] text-enquiry-note">
              By sending, you agree to be contacted by Guruji Travel Yatra about this enquiry.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

interface IntroColumnProps {
  copy: (typeof COPY)[LeadModalVariant];
  context?: ModalContext;
  happyTravellersLabel: string | null;
}

/**
 * The left column of the horizontal card.
 *
 * New brief (2026-11-15, final corrections):
 *  - Item 2: a true 3-line heading (`Tell us where` / `your heart` /
 *    `leads.`), near-black first line, red italic last two, sized/spaced
 *    exactly as specified — but with every margin ALSO `vh`-clamped (the
 *    literal pixel value is the clamp's own upper bound, so a tall
 *    viewport renders pixel-identical to the spec) to protect the
 *    height-budget work `FormStep`'s own header explains: this heading is
 *    markedly taller than the previous 2-line one, and its `5vw`
 *    font-size does not shrink for a viewport that is short but WIDE
 *    (1440x700 etc.) the way a `vh`-based value would.
 *  - Item 3: linear order now — kicker, heading, intro, context chip,
 *    proof pill — no more `justify-between` pinning the pill to the
 *    column's bottom edge.
 *
 * Mobile (<781px): the kicker and proof pill are still dropped — "intro
 * compact: heading + one line, no proof pill" (brief, 2026-11-15 "wide"
 * round) — leaving the heading, the intro paragraph and the context chip.
 */
function IntroColumn({ copy, context, happyTravellersLabel }: IntroColumnProps) {
  return (
    // Below 781px the proof pill is hidden, so the reference pill's own 35px
    // bottom margin is kept here instead, before the form box (ESTIMATED).
    <div className="mb-8.75 leading-6 enquiry:mb-0">
      {/* `.section-kicker`: inline 11px, 0.28em, red, in the column's 24px line box as in the reference. Hidden below 781px (decided deviation). */}
      <span className="hidden text-11 font-bold uppercase leading-[1.5] tracking-enquiry-kicker text-enquiry-red enquiry:inline">
        The first step
      </span>
      {/* Forced 3 lines at every width (decided deviation; the reference wraps to 2 lines at 768). */}
      <h2 className="mt-enquiry-18 mb-enquiry-22 font-redux-display text-enquiry-display font-medium tracking-enquiry-display text-enquiry-ink">
        Tell us where
        <br />
        <em className="italic text-enquiry-red">
          your heart
          <br />
          leads.
        </em>
      </h2>
      <p className="max-w-[360px] text-15 leading-[1.7] text-enquiry-muted">{copy.description}</p>

      {/* No reference counterpart: the proof-pill look (ESTIMATED, spec §4). */}
      {context && (
        <div className="mt-enquiry-22 rounded-18 border border-enquiry-blush-line bg-enquiry-blush p-3.5 text-12 leading-[18px]">
          <span className="text-10 font-bold uppercase tracking-widest2 text-enquiry-muted">{copy.ctxLabel}</span>
          <br />
          <b className="text-enquiry-ink">{context.value}</b>{' '}
          <span className="text-enquiry-muted">· pre-filled from this page</span>
        </div>
      )}

      {/*
        The reference's `.proof-pill`. Real `happyTravellersLabel` only — no
        "joined us this month" line, no star rating (decided deviation 7),
        and no pill at all once the CRM has not set a figure. Hidden below
        781px (decided deviation 4).
      */}
      {happyTravellersLabel && (
        <div className="mt-enquiry-45 hidden items-center gap-3.25 rounded-18 border border-enquiry-blush-line bg-enquiry-blush p-3.5 enquiry:flex">
          <div className="flex pl-1.75" aria-hidden="true">
            {(
              [
                ['R', 'bg-enquiry-red text-white'],
                ['A', 'bg-enquiry-avatar-2 text-white'],
                ['S', 'bg-enquiry-avatar-3 text-white'],
                ['+', 'bg-white text-enquiry-red'],
              ] as const
            ).map(([letter, colours]) => (
              <span
                key={letter}
                className={`-ml-1.75 grid size-7.75 place-items-center rounded-[50%] border-2 border-enquiry-blush text-10 font-bold leading-[15px] ${colours}`}
              >
                {letter}
              </span>
            ))}
          </div>
          <p className="text-12 font-bold leading-[18px] text-enquiry-ink">{happyTravellersLabel} happy travellers</p>
        </div>
      )}
    </div>
  );
}

function DoneStep({
  variant,
  heading,
  body,
  onClose,
}: {
  variant: LeadModalVariant;
  heading: string;
  body: string;
  onClose: () => void;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    // New brief (2026-11-15, "horizontal card"): "the card switches to a
    // centred confirmation ... keeping the same card size" — same outer
    // padding scheme as `FormStep` (so the card's own overall size/padding
    // doesn't jump between steps), with its own content constrained to a
    // readable column width instead of stretching across the full
    // 1120px-wide desktop card.
    <div className="relative flex flex-col items-center gap-3 bg-white p-[clamp(16px,4vh,28px)] text-center font-redux-sans min-[781px]:p-[clamp(20px,4vh,48px)]">
      <div className="mx-auto flex w-full max-w-[480px] flex-col items-center gap-3">
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
          className="grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-emerald-600"
        >
          <Check size={26} aria-hidden="true" />
        </motion.div>
        <h2 className="font-redux-display text-2xl font-medium leading-[1.15] tracking-tight text-stone-900">{heading}</h2>
        <p className="max-w-sm text-[13px] leading-relaxed text-redux-ink-mute">{body}</p>
        <div className="mt-2 flex w-full flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            className="flex flex-1 items-center justify-center gap-2 rounded-full border border-stone-300 bg-white px-6 py-3 text-[15px] font-bold text-stone-900 transition-all duration-300 hover:-translate-y-0.5 hover:border-[#d92d32]/50 hover:text-[#d92d32]"
          >
            Close
          </button>
          {variant === 'brochure' ? (
            // TODO(brochure-unlock): no real PDF/file host exists yet
            // (BLOCKERS.md Open Question 3) — this stays an inert UI stub,
            // same as before this redesign; only the surrounding panel (and
            // the 3 now-removed sibling stub buttons it used to sit beside)
            // changed.
            <button
              type="button"
              onClick={noop}
              className="btn-shine flex flex-1 items-center justify-center gap-2 rounded-full bg-[#d92d32] px-6 py-3 text-[15px] font-bold text-white shadow-[0_16px_30px_-16px_rgba(217,45,50,0.7)] transition-all duration-300 hover:-translate-y-0.5 hover:brightness-95"
            >
              Download brochure <span aria-hidden="true">↓</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="btn-shine flex flex-1 items-center justify-center gap-2 rounded-full bg-[#d92d32] px-6 py-3 text-[15px] font-bold text-white shadow-[0_16px_30px_-16px_rgba(217,45,50,0.7)] transition-all duration-300 hover:-translate-y-0.5 hover:brightness-95"
            >
              Continue exploring <span aria-hidden="true">→</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
