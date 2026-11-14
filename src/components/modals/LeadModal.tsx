'use client';

import * as React from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, Loader2, Send, X } from 'lucide-react';

import { ModalShell } from './ModalShell';
import { Field } from './Field';
import { extractUtm } from './extract-utm';
import type { ModalContext } from './modal-context';
import type { LeadDetails } from './lead-details';
import { buildLeadRequest } from './build-lead-request';
import { submitLeadRequest } from '@/lib/leads/lead-api-client';
import { leadFormDefaultValues, leadFormSchema, type LeadFormValues } from './lead-form-schema';
import { PhoneField } from './PhoneField';
import { TurnstileWidget } from './TurnstileWidget';
import { GTY_PHONE_DISPLAY, GTY_PHONE_TEL } from '@/lib/gty-contact';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

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
export function LeadModal({ variant, open, context, details, onClose }: LeadModalProps) {
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
        // `leadFormSchema`'s resolver only lets `runSubmit` be called once
        // `consent` has validated to `true` — the cast documents that
        // guarantee rather than re-deriving it, since the form models
        // `consent` as a plain `boolean` so an unchecked box has a
        // representable default (see `lead-form-schema.ts`).
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
  form: UseFormReturn<LeadFormValues>;
  errorMessage: string | null;
  onDismissError: () => void;
  onSubmit: (event?: React.BaseSyntheticEvent) => void;
  onClose: () => void;
}

/**
 * New brief (2026-11-15), item 2 — the popup's layout now matches the
 * reference exactly: a plain white card (heading, intro, context chip),
 * then an INNER CREAM BOX holding every field. See `ModalShell.tsx` for
 * the outer card's own radius/border/shadow/width.
 */
function FormStep({ copy, context, form, errorMessage, onDismissError, onSubmit, onClose }: FormStepProps) {
  const {
    register,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = form;

  return (
    <div className="relative bg-white p-5 font-redux-sans sm:p-7">
      {/* Brief §13 ("ACCEPTANCE") requires every tap target >= 44px — `-m-[11px]` + `p-[11px]` keeps the visible 18px icon compact while the actual hit area is 44x44. */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-3 top-3 -m-[11px] grid h-11 w-11 flex-none place-items-center rounded-full p-[11px] text-stone-400 transition-colors hover:bg-stone-100 hover:text-[#d92d32]"
      >
        <X size={18} />
      </button>

      <h2 className="max-w-[88%] font-redux-display text-[26px] font-medium leading-[1.15] tracking-tight text-stone-900 sm:text-[30px]">
        Tell us where
        <br />
        <em className="italic text-[#d92d32]">your heart leads.</em>
      </h2>
      <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-redux-ink-mute">{copy.description}</p>

      {context && (
        <div className="mt-4 rounded-2xl border border-[#eadfdb] bg-white p-3 text-[13px]">
          <span className="text-[10px] font-bold uppercase tracking-widest2 text-redux-ink-mute">{copy.ctxLabel}</span>
          <br />
          <b className="text-stone-900">{context.value}</b>{' '}
          <span className="text-redux-ink-mute">· pre-filled from this page</span>
        </div>
      )}

      {/* The cream box — `.enquiry-form` in the reference. */}
      <div className="mt-5 rounded-[22px] border border-[#eadfdb] bg-[#fffaf7] p-5 sm:p-7">
        <div className="mb-4 border-b border-[#eadfdb] pb-3">
          <h3 className="font-redux-display text-lg font-medium tracking-tight text-stone-900">Let&rsquo;s make it personal.</h3>
        </div>

        {/* `method`/`action` are belt-and-braces (item 3): the REAL guard is that `handleSubmit` always calls `preventDefault()` before anything else runs, on every submit attempt, valid or not. */}
        <form onSubmit={onSubmit} noValidate method="post" action="#" className="flex flex-col gap-[14px]">
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
              className="flex flex-col gap-2 rounded-2xl border border-[#d92d32]/30 bg-[#d92d32]/10 p-3 text-[13px] text-[#d92d32]"
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
                  className="-m-[14px] grid h-11 w-11 flex-none place-items-center p-[14px] text-[#d92d32]"
                >
                  <X size={16} />
                </button>
              </div>
              <Button type="submit" variant="default" size="sm" className="self-start">
                Try Again
              </Button>
            </div>
          )}

          <Field label="Name *" htmlFor="lead-name" error={errors.name?.message}>
            <Input id="lead-name" autoComplete="name" aria-invalid={!!errors.name} {...register('name')} />
          </Field>

          {/* Phone + email side by side; stacked on mobile (item 2). */}
          <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-2">
            <Field label="Mobile Number *" htmlFor="lead-mobile" error={errors.mobile?.message}>
              <PhoneField control={control} id="lead-mobile" aria-invalid={!!errors.mobile} />
            </Field>
            <Field label="Email" htmlFor="lead-email" error={errors.email?.message}>
              <Input id="lead-email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register('email')} />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-2">
            <Field label="Travel Date" htmlFor="lead-travel-date" error={errors.travelDate?.message}>
              <Input
                id="lead-travel-date"
                type="date"
                aria-invalid={!!errors.travelDate}
                {...register('travelDate')}
              />
            </Field>
            <Field label="Travellers" htmlFor="lead-travellers" error={errors.travellers?.message}>
              <Input
                id="lead-travellers"
                type="number"
                min={1}
                inputMode="numeric"
                aria-invalid={!!errors.travellers}
                {...register('travellers')}
              />
            </Field>
          </div>

          <Field label="City" htmlFor="lead-city" error={errors.city?.message}>
            <Input id="lead-city" autoComplete="address-level2" aria-invalid={!!errors.city} {...register('city')} />
          </Field>

          <Field label="Message" htmlFor="lead-message" error={errors.message?.message}>
            <Textarea id="lead-message" rows={3} aria-invalid={!!errors.message} {...register('message')} />
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

          <div className="flex flex-col gap-[6px]">
            <label htmlFor="lead-consent" className="flex items-start gap-[8px] text-[13px] leading-relaxed text-redux-ink-soft">
              <input
                id="lead-consent"
                type="checkbox"
                className="mt-[2px] accent-[#d92d32]"
                aria-invalid={!!errors.consent}
                aria-describedby={errors.consent ? 'lead-consent-error' : undefined}
                {...register('consent')}
              />
              <span>I agree to be contacted by Guruji Travel Yatra about this enquiry. *</span>
            </label>
            {errors.consent && (
              <p id="lead-consent-error" role="alert" className="text-xs text-[#d92d32]">
                {errors.consent.message}
              </p>
            )}
          </div>

          {/* Turnstile sits above the submit button, centered, inside the cream box. */}
          <div className="flex justify-center">
            {TURNSTILE_SITE_KEY ? (
              <TurnstileWidget
                siteKey={TURNSTILE_SITE_KEY}
                onVerify={(token) => setValue('turnstileToken', token, { shouldValidate: true })}
                onExpire={() => setValue('turnstileToken', '', { shouldValidate: true })}
              />
            ) : (
              // UNSET IS SUPPORTED (see the module-level comment on
              // `TURNSTILE_SITE_KEY`) — this is the honest state of the control,
              // not a loading flicker, so it says so rather than rendering
              // nothing with no explanation for why submit never succeeds.
              <p className="text-[11px] text-redux-ink-mute">Verification is not configured in this environment.</p>
            )}
          </div>
          {errors.turnstileToken && (
            <p role="alert" className="text-center text-xs text-[#d92d32]">
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
          */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-shine mt-1.5 flex w-full items-center justify-center gap-2.5 rounded-full bg-[#d92d32] px-6 py-3.5 text-[15px] font-bold text-white shadow-[0_16px_30px_-16px_rgba(217,45,50,0.7)] transition-all duration-300 hover:-translate-y-0.5 hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
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
          <p className="text-center text-[11px] leading-relaxed text-redux-ink-mute">
            No pressure, no spam, just thoughtful travel ideas.
          </p>
        </form>
      </div>
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
    <div className="flex flex-col items-center gap-3 bg-white p-7 text-center font-redux-sans sm:p-8">
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
  );
}
