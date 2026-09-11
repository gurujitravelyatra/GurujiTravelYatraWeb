'use client';

import * as React from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion, useReducedMotion } from 'framer-motion';

import { ModalShell } from './ModalShell';
import type { ModalContext } from './modal-context';
import { leadAdapter } from '@/content/adapters/not-implemented-lead-adapter';
import type { LeadPayload, LeadSourceTag, LeadSubmissionResult } from '@/content/ports';
import { leadFormDefaultValues, leadFormSchema, type LeadFormValues } from './lead-form-schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export type LeadModalVariant = 'enquiry' | 'brochure';

export interface LeadModalProps {
  variant: LeadModalVariant;
  open: boolean;
  /** Real page/package context only — see BLOCKERS.md Decision F. Omit entirely when there is none; never fall back to a fabricated default. */
  context?: ModalContext;
  onClose: () => void;
}

type Step = 'form' | 'sending' | 'done';

/**
 * All modal copy. Nothing here may assert a backend capability that does not
 * exist yet: the submit path is `NotImplementedLeadAdapter` (BLOCKERS.md §1a /
 * Decision A) — no server, no validation service, no rate limiter, no CRM
 * write. `sendingLabel` and `disclaimer` in particular are worded to describe
 * intent, never infrastructure.
 *
 * The disclaimers used to promise, BEFORE submit, that "our team will review
 * your enquiry and get back to you shortly" — on a path that cannot succeed,
 * since nothing is transmitted or stored. They now state only what is
 * genuinely true at that moment: what the details will be used for. The
 * post-submit step is the only place that describes what happens next, and it
 * is reached only on a success this adapter never returns.
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

function buildSourceTag(variant: LeadModalVariant, context?: ModalContext): LeadSourceTag {
  const suffix = context?.value ?? 'General enquiry';
  return variant === 'brochure' ? `Brochure Download – ${suffix}` : `Enquire Now – ${suffix}`;
}

function extractUtm(search: string): LeadPayload['utm'] {
  const params = new URLSearchParams(search);
  const utm = {
    source: params.get('utm_source') ?? undefined,
    medium: params.get('utm_medium') ?? undefined,
    campaign: params.get('utm_campaign') ?? undefined,
    content: params.get('utm_content') ?? undefined,
    term: params.get('utm_term') ?? undefined,
  };
  return Object.values(utm).some(Boolean) ? utm : undefined;
}

function buildDoneLine(
  variant: LeadModalVariant,
  context: ModalContext | undefined,
  result: Extract<LeadSubmissionResult, { status: 'success' }>
): string {
  if (result.confirmationMessage) return result.confirmationMessage;
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
export function LeadModal({ variant, open, context, onClose }: LeadModalProps) {
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

  const runSubmit = React.useCallback(
    async (values: LeadFormValues) => {
      setErrorMessage(null);
      setStep('sending');

      const payload: LeadPayload = {
        name: values.name,
        mobile: values.mobile,
        email: values.email || undefined,
        interestedIn: context?.value,
        travelDate: values.travelDate || undefined,
        travellers:
          values.travellers === '' || values.travellers === undefined ? undefined : Number(values.travellers),
        city: values.city || undefined,
        message: values.message || undefined,
        source: buildSourceTag(variant, context),
        // sourcePageUrl / utm are read ONLY here, inside the submit event
        // handler — never during render (no useSearchParams()), so no
        // hydration mismatch and no forced-dynamic route.
        sourcePageUrl: window.location.href,
        timestamp: new Date().toISOString(),
        utm: extractUtm(window.location.search),
      };

      const result = await leadAdapter.submitLead(payload);

      if (result.status === 'success') {
        setDoneLine(buildDoneLine(variant, context, result));
        setStep('done');
        return;
      }

      // Error path (BLOCKERS.md Decision B / tech spec §4.3): stay on the
      // form step, keep every entered value (no form.reset()), surface a
      // dismissible banner with "Try Again".
      setErrorMessage(result.message);
      setStep('form');
    },
    [context, variant]
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
    formState: { errors },
  } = form;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 border-b border-gty-border-6 p-4">
        <h2 className="text-18 font-extrabold leading-[1.15] text-gty-ink">{copy.title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-16 text-gty-subtle transition-colors duration-gty-fast ease-gty hover:text-gty-primary"
        >
          ×
        </button>
      </div>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-[10px] p-4">
        <p className="text-11 leading-relaxed text-gty-subtle">{copy.description}</p>

        {context && (
          <div className="rounded-16 border border-gty-border bg-gty-surface-3 p-[10px] text-11">
            <span className="text-10 font-bold uppercase tracking-label text-gty-subtle">{copy.ctxLabel}</span>
            <br />
            <b className="text-gty-ink">{context.value}</b>{' '}
            <span className="text-gty-subtle">· pre-filled from this page</span>
          </div>
        )}

        {errorMessage && (
          <div
            role="alert"
            className="flex flex-col gap-2 rounded-16 border border-gty-red-300 bg-gty-red-100 p-[10px] text-11-5 text-gty-primary-deep"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="leading-relaxed">{errorMessage}</p>
              <button
                type="button"
                onClick={onDismissError}
                aria-label="Dismiss"
                className="shrink-0 text-14 leading-none text-gty-primary-deep"
              >
                ×
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

        <Field label="Mobile Number *" htmlFor="lead-mobile" error={errors.mobile?.message}>
          <Input id="lead-mobile" type="tel" autoComplete="tel" aria-invalid={!!errors.mobile} {...register('mobile')} />
        </Field>

        <Field label="Email" htmlFor="lead-email" error={errors.email?.message}>
          <Input id="lead-email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register('email')} />
        </Field>

        <div className="flex gap-[10px]">
          <Field label="Travel Date" htmlFor="lead-travel-date" error={errors.travelDate?.message} className="flex-1">
            <Input id="lead-travel-date" type="date" {...register('travelDate')} />
          </Field>
          <Field label="Travellers" htmlFor="lead-travellers" error={errors.travellers?.message} className="flex-1">
            <Input id="lead-travellers" type="number" min={1} inputMode="numeric" {...register('travellers')} />
          </Field>
        </div>

        <Field label="City" htmlFor="lead-city" error={errors.city?.message}>
          <Input id="lead-city" autoComplete="address-level2" {...register('city')} />
        </Field>

        <Field label="Optional message" htmlFor="lead-message" error={errors.message?.message}>
          <Textarea id="lead-message" rows={3} {...register('message')} />
        </Field>

        <Button type="submit" variant="primary" className="justify-center">
          {copy.cta} <span aria-hidden="true">→</span>
        </Button>
        <p className="text-9 leading-relaxed text-gty-faint-2">{copy.disclaimer}</p>
      </form>
    </div>
  );
}

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}

function Field({ label, htmlFor, error, className, children }: FieldProps) {
  const errorId = `${htmlFor}-error`;
  return (
    <div className={cn('flex flex-col gap-[6px]', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
            'aria-describedby': error ? errorId : undefined,
          })
        : children}
      {error && (
        <p id={errorId} role="alert" className="text-11 text-gty-primary">
          {error}
        </p>
      )}
    </div>
  );
}

function SendingStep({ label, shouldReduceMotion }: { label: string; shouldReduceMotion: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 px-gx py-11">
      <p className="text-10 font-bold uppercase tracking-label text-gty-subtle">Sending…</p>
      <div className="h-2 w-[200px] rounded-16 border-[1.5px] border-dashed border-gty-border-8 bg-gty-surface-3">
        <motion.div
          className="h-full rounded-16 bg-gty-primary"
          initial={{ width: shouldReduceMotion ? '60%' : '10%' }}
          animate={{ width: '60%' }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
        />
      </div>
      <p className="text-11 text-gty-subtle">{label}</p>
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
    <div className="flex flex-col items-start gap-3 p-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-16 border border-gty-primary text-20 text-gty-primary">
        ✓
      </div>
      <h2 className="text-24 font-extrabold leading-[1.1] text-gty-ink">
        Your journey
        <br />
        starts here.
      </h2>
      <p className="text-12 text-gty-subtle">{doneLine}</p>
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
        <Button variant="default" className="justify-center" onClick={onClose}>
          Keep Exploring <span aria-hidden="true">→</span>
        </Button>
      </div>
      <div className="w-full rounded-16 border-[1.5px] border-dashed border-gty-border-8 p-[10px] text-11-5 leading-relaxed text-gty-subtle">
        GTY has your details — our team will call you within business hours.
      </div>
    </div>
  );
}
