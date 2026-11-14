'use client';

import * as React from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, Send, X } from 'lucide-react';

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

type Step = 'form' | 'sending' | 'done';

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
 * The disclaimers used to promise, BEFORE submit, that "our team will review
 * your enquiry and get back to you shortly", on a path that could not succeed.
 * They still state only what is genuinely true at that moment: what the details
 * will be used for. The post-submit step remains the only place that describes
 * what happens next.
 */
const COPY: Record<
  LeadModalVariant,
  { title: string; description: string; cta: string; ctxLabel: string; sendingLabel: string; disclaimer: string }
> = {
  enquiry: {
    title: 'Talk to GTY',
    description: "Tell us where you're headed and we'll shape the journey around you.",
    cta: 'Start Your Journey',
    ctxLabel: 'Enquiring about',
    sendingLabel: 'Submitting your enquiry…',
    disclaimer: "We'll only use these details to plan your journey with you.",
  },
  brochure: {
    title: 'Get Your Complete Travel Brochure',
    description: 'Get the complete itinerary, inclusions, pricing and travel information.',
    cta: 'Get My Brochure',
    ctxLabel: 'Brochure for',
    sendingLabel: 'Submitting your request…',
    disclaimer: "We'll only use these details to send you the brochure.",
  },
};

/** Inert stub for the Brochure done-step's unlock buttons — see TODO(brochure-unlock) below. */
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

/**
 * The route's success body carries no visitor-facing copy — only `leadId`,
 * `source` and `receivedAt` — so the confirmation sentence is composed here
 * from context the client already has, rather than from a server string that
 * does not exist.
 */
function buildDoneLine(variant: LeadModalVariant, context: ModalContext | undefined): string {
  if (context) {
    return variant === 'brochure'
      ? `Your ${context.value} brochure is ready.`
      : `We've got it — GTY will call you about ${context.value} within business hours.`;
  }
  return variant === 'brochure' ? 'Your brochure is ready.' : "We've got it — GTY will call you within business hours.";
}

/**
 * The shared Enquiry/Brochure form + step machine (tech spec §4.3). Both
 * `EnquiryModal` and `BrochureModal` are thin wrappers around this.
 */
export function LeadModal({ variant, open, context, details, onClose }: LeadModalProps) {
  const copy = COPY[variant];
  const [step, setStep] = React.useState<Step>('form');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [doneLine, setDoneLine] = React.useState('');
  const shouldReduceMotion = useReducedMotion();

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: leadFormDefaultValues,
  });

  // Reset the STEP machine (never the entered field values) each time the
  // modal transitions from closed to freshly open, so a previous session's
  // error/done state can't leak into the next open. Adjusted during render
  // (React's recommended pattern for "reset state when a prop changes")
  // rather than in an effect, so there is no extra synchronous setState
  // inside a `useEffect` body.
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setStep('form');
      setErrorMessage(null);
    }
  }

  const { setError } = form;

  const runSubmit = React.useCallback(
    async (values: LeadFormValues) => {
      setErrorMessage(null);
      setStep('sending');

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
        setDoneLine(buildDoneLine(variant, context));
        setStep('done');
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
    [context, details, setError, variant]
  );

  return (
    <ModalShell
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={copy.title}
      description={copy.description}
    >
      {step === 'form' && (
        <FormStep
          copy={copy}
          context={context}
          form={form}
          errorMessage={errorMessage}
          onDismissError={() => setErrorMessage(null)}
          onSubmit={form.handleSubmit(runSubmit)}
          onClose={onClose}
        />
      )}
      {step === 'sending' && <SendingStep label={copy.sendingLabel} shouldReduceMotion={!!shouldReduceMotion} />}
      {step === 'done' && <DoneStep variant={variant} doneLine={doneLine} onClose={onClose} />}
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

function FormStep({ copy, context, form, errorMessage, onDismissError, onSubmit, onClose }: FormStepProps) {
  const {
    register,
    setValue,
    control,
    formState: { errors },
  } = form;

  return (
    <div className="bg-[#fffaf7]">
      <div className="flex items-start justify-between gap-3 border-b border-[#eadfdb] p-6 pb-5">
        {/*
          Brief §E3 (2026-11-14): this form is one screen, not a numbered
          wizard — "sending"/"done" are submission OUTCOMES, not steps a
          visitor walks through — so the eyebrow a previous round added
          here ("The first step", implying more steps follow) is exactly
          the decorative step-count language the brief says to drop when
          there are no real steps.
        */}
        <div>
          <h2 className="font-redux-display text-2xl font-medium tracking-tight text-stone-900">{copy.title}</h2>
        </div>
        {/* Brief §13 ("ACCEPTANCE") requires every tap target >= 44px — `-m-[11px]` + `p-[11px]` keeps the visible 18px icon compact while the actual hit area is 44x44. */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-m-[11px] grid h-11 w-11 flex-none place-items-center rounded-full p-[11px] text-stone-400 transition-colors hover:bg-stone-100 hover:text-[#d92d32]"
        >
          <X size={18} />
        </button>
      </div>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-[14px] p-6 font-redux-sans">
        <p className="text-[13px] leading-relaxed text-redux-ink-mute">{copy.description}</p>

        {context && (
          <div className="rounded-2xl border border-[#eadfdb] bg-white p-3 text-[13px]">
            <span className="text-[10px] font-bold uppercase tracking-widest2 text-redux-ink-mute">{copy.ctxLabel}</span>
            <br />
            <b className="text-stone-900">{context.value}</b>{' '}
            <span className="text-redux-ink-mute">· pre-filled from this page</span>
          </div>
        )}

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
              <p className="leading-relaxed">{errorMessage}</p>
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

        {/* `.form-row` (brief §12) — phone + email side by side; both stay full-width fields on mobile via the Field/Input components' own responsive styling. */}
        <div className="grid grid-cols-2 gap-[14px]">
          <Field label="Mobile Number *" htmlFor="lead-mobile" error={errors.mobile?.message}>
            <PhoneField control={control} id="lead-mobile" aria-invalid={!!errors.mobile} />
          </Field>
          <Field label="Email" htmlFor="lead-email" error={errors.email?.message}>
            <Input id="lead-email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register('email')} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-[14px]">
          <Field label="Travel Date" htmlFor="lead-travel-date" error={errors.travelDate?.message}>
            <Input id="lead-travel-date" type="date" {...register('travelDate')} />
          </Field>
          <Field label="Travellers" htmlFor="lead-travellers" error={errors.travellers?.message}>
            <Input id="lead-travellers" type="number" min={1} inputMode="numeric" {...register('travellers')} />
          </Field>
        </div>

        <Field label="City" htmlFor="lead-city" error={errors.city?.message}>
          <Input id="lead-city" autoComplete="address-level2" {...register('city')} />
        </Field>

        <Field label="Optional message" htmlFor="lead-message" error={errors.message?.message}>
          <Textarea id="lead-message" rows={3} {...register('message')} />
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

        {/* Brief §12: "the Turnstile widget sits above the submit button, centered, inside the form card". */}
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

        <button
          type="submit"
          className="btn-shine mt-1.5 flex w-full items-center justify-center gap-2.5 rounded-full bg-[#d92d32] px-6 py-3.5 text-[15px] font-bold text-white shadow-[0_16px_30px_-16px_rgba(217,45,50,0.7)] transition-all duration-300 hover:-translate-y-0.5 hover:brightness-95"
        >
          {copy.cta}
          <Send size={16} aria-hidden="true" />
        </button>
        <p className="text-center text-[11px] leading-relaxed text-redux-ink-mute">{copy.disclaimer}</p>
      </form>
    </div>
  );
}

function SendingStep({ label, shouldReduceMotion }: { label: string; shouldReduceMotion: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 bg-[#fffaf7] px-gx py-11">
      <p className="text-[10px] font-bold uppercase tracking-widest2 text-redux-ink-mute">Sending…</p>
      <div className="h-2 w-[200px] rounded-full border border-[#eadfdb] bg-white">
        <motion.div
          className="h-full rounded-full bg-[#d92d32]"
          initial={{ width: shouldReduceMotion ? '60%' : '10%' }}
          animate={{ width: '60%' }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
        />
      </div>
      <p className="text-[13px] text-redux-ink-mute">{label}</p>
    </div>
  );
}

function DoneStep({
  variant,
  doneLine,
  onClose,
}: {
  variant: LeadModalVariant;
  doneLine: string;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-3 bg-[#fffaf7] p-6">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-[#d92d32]/10 text-[#d92d32]">
        <Check size={22} aria-hidden="true" />
      </div>
      <h2 className="font-redux-display text-2xl font-medium leading-[1.1] tracking-tight text-stone-900">
        Your journey
        <br />
        starts here.
      </h2>
      <p className="text-[13px] text-redux-ink-mute">{doneLine}</p>
      <div className="mt-[6px] flex w-full flex-col gap-2">
        {variant === 'brochure' && (
          <div className="flex flex-col gap-2">
            {/* TODO(brochure-unlock): no real PDF/file host exists yet (BLOCKERS.md Open Question 3) — these are inert UI stubs. */}
            <Button variant="primary" className="justify-center" onClick={noop}>
              View Brochure <span aria-hidden="true">→</span>
            </Button>
            <Button variant="default" className="justify-center" onClick={noop}>
              Download Brochure <span aria-hidden="true">↓</span>
            </Button>
            <div className="flex gap-2">
              <Button variant="default" className="flex-1 justify-center" onClick={noop}>
                Send to Email
              </Button>
              <Button variant="default" className="flex-1 justify-center" onClick={noop}>
                On WhatsApp
              </Button>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={onClose}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-stone-300 bg-white px-6 py-3 text-[15px] font-bold text-stone-900 transition-all duration-300 hover:-translate-y-0.5 hover:border-[#d92d32]/50 hover:text-[#d92d32]"
        >
          Keep Exploring <span aria-hidden="true">→</span>
        </button>
      </div>
      <div className="w-full rounded-2xl border border-[#eadfdb] bg-white p-3 text-[13px] leading-relaxed text-redux-ink-mute">
        GTY has your details — our team will call you within business hours.
      </div>
    </div>
  );
}
