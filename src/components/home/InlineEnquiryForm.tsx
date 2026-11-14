'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, Send } from 'lucide-react';

import { buildLeadRequest } from '@/components/modals/build-lead-request';
import { extractUtm } from '@/components/modals/extract-utm';
import { Field } from '@/components/modals/Field';
import { leadFormDefaultValues, leadFormSchema, type LeadFormValues } from '@/components/modals/lead-form-schema';
import { PhoneField } from '@/components/modals/PhoneField';
import { TurnstileWidget } from '@/components/modals/TurnstileWidget';
import { Input } from '@/components/ui/input';
import { submitLeadRequest } from '@/lib/leads/lead-api-client';

export interface InlineEnquiryFormProps {
  /** `site.settings.happyTravellersLabel` from `GET /public/site` — `null`/`undefined` until the Owner sets one. */
  happyTravellersLabel?: string | null;
}

/**
 * New brief, Part 4A (2026-11-14) — the reference's inline enquiry card
 * (https://guruji-journeys--7abvfwv7.preview.emergentagent.com/,
 * section "enquire"), built on the home page rather than inside a modal.
 *
 * Submits through the EXACT same pipeline the modal uses
 * (`buildLeadRequest`/`submitLeadRequest`/`leadFormSchema`/
 * `POST /api/leads`) — no schema change anywhere. Two deliberate,
 * brief-sanctioned deviations from "the exact reference card":
 *
 * 1. The reference shows no consent checkbox at all, but
 *    `leadSubmissionSchema.consent` is a REQUIRED `z.literal(true)` the
 *    server will 400 without. Per the brief's own instruction ("if a
 *    required field is missing... use a sensible default and tell me"):
 *    `consent` defaults to `true` here (never exposed as a checkbox,
 *    unlike the modal, which keeps its explicit one) — submitting this
 *    form IS the opt-in, and the disclaimer line beneath the button
 *    ("No pressure, no spam...") is the notice of what that means.
 * 2. The proof pill's "4.9/5" rating and "joined us this month" are
 *    dropped — no CRM field backs either claim. Only `happyTravellersLabel`
 *    (a real CRM value) is shown, and the whole pill is omitted when the
 *    Owner has not set one.
 */
const JOURNEY_TYPES = ['Spiritual yatra', 'Group tour', 'Family holiday', 'Adventure', 'International', 'Custom trip'] as const;

type Step = 'form' | 'sending' | 'done';

/** Mirrors `LeadModal`'s own narrower list — a 400 naming one of these has a real input to attach to; anything else goes to the banner. */
const FORM_FIELD_NAMES = ['name', 'mobile', 'email', 'turnstileToken'] as const;

function isFormFieldName(key: string): key is (typeof FORM_FIELD_NAMES)[number] {
  return (FORM_FIELD_NAMES as readonly string[]).includes(key);
}

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export function InlineEnquiryForm({ happyTravellersLabel }: InlineEnquiryFormProps) {
  const [step, setStep] = React.useState<Step>('form');
  const [journeyType, setJourneyType] = React.useState('');
  const [journeyTypeError, setJourneyTypeError] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const shouldReduceMotion = useReducedMotion();

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: { ...leadFormDefaultValues, consent: true },
  });
  const {
    register,
    setValue,
    control,
    setError,
    handleSubmit,
    formState: { errors },
  } = form;

  const runSubmit = React.useCallback(
    async (values: LeadFormValues) => {
      setErrorMessage(null);
      setStep('sending');

      const request = buildLeadRequest({
        details: { formType: 'enquiry', pageName: journeyType },
        values: { name: values.name, mobile: values.mobile, email: values.email },
        security: { consent: true, turnstileToken: values.turnstileToken, honeypot: values.honeypot },
        interestedIn: journeyType,
        sourcePageUrl: window.location.href,
        utm: extractUtm(window.location.search),
      });

      const result = await submitLeadRequest(request);

      if (result.status === 'success') {
        setStep('done');
        return;
      }

      const unattached: string[] = [];
      for (const [key, messages] of Object.entries(result.fields ?? {})) {
        const [message] = messages;
        if (!message) continue;
        if (isFormFieldName(key)) setError(key, { type: 'server', message });
        else unattached.push(message);
      }
      setErrorMessage([result.message, ...unattached].join(' '));
      setStep('form');
    },
    [journeyType, setError]
  );

  function onSubmit(event: React.BaseSyntheticEvent) {
    if (!journeyType) {
      setJourneyTypeError('Please select a journey type.');
      return;
    }
    setJourneyTypeError(null);
    void handleSubmit(runSubmit)(event);
  }

  return (
    <section className="bg-[#fffaf7] px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto grid max-w-[1180px] gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest2 text-[#d92d32]">The first step</span>
          <h2 className="mt-3 font-redux-display text-4xl font-medium leading-[1.1] tracking-tight text-stone-900 sm:text-5xl">
            Tell us where
            <br />
            <em className="italic text-[#d92d32]">your heart leads.</em>
          </h2>
          <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-redux-ink-mute">
            Share a few details and our trip designers will shape the rest around you.
          </p>

          {happyTravellersLabel && (
            <div className="mt-8 flex max-w-sm items-center gap-4 rounded-2xl border border-[#eadfdb] bg-white px-5 py-4 shadow-[0_20px_40px_-30px_rgba(217,45,50,0.4)]">
              <div className="flex -space-x-2" aria-hidden="true">
                {['bg-[#d92d32]', 'bg-[#e3b29a]', 'bg-stone-800'].map((bg, index) => (
                  <span key={index} className={`grid h-9 w-9 place-items-center rounded-full border-2 border-white text-xs font-bold text-white ${bg}`}>
                    {['R', 'A', 'S'][index]}
                  </span>
                ))}
                <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-[#eadfdb] text-xs font-bold text-[#d92d32]">
                  +
                </span>
              </div>
              <p className="text-[13px] font-bold text-stone-900">{happyTravellersLabel} happy travellers</p>
            </div>
          )}
        </div>

        <div className="rounded-[2rem] border border-[#eadfdb] bg-white p-6 shadow-[0_40px_80px_-40px_rgba(127,18,22,0.25)] sm:p-8">
          {step === 'form' && (
            <>
              <div className="border-b border-[#eadfdb] pb-4">
                <h3 className="font-redux-display text-xl font-medium tracking-tight text-stone-900">Let&rsquo;s make it personal.</h3>
              </div>
              <form onSubmit={onSubmit} noValidate className="mt-5 flex flex-col gap-[14px]">
                {errorMessage && (
                  <div
                    role="alert"
                    data-testid="inline-enquiry-error"
                    className="rounded-2xl border border-[#d92d32]/30 bg-[#d92d32]/10 p-3 text-[13px] text-[#d92d32]"
                  >
                    {errorMessage}
                  </div>
                )}

                <Field label="Your name" htmlFor="inline-enquiry-name" error={errors.name?.message}>
                  <Input id="inline-enquiry-name" placeholder="e.g. Arjun Mehta" autoComplete="name" aria-invalid={!!errors.name} {...register('name')} />
                </Field>

                <div className="grid grid-cols-2 gap-[14px]">
                  <Field label="Phone number" htmlFor="inline-enquiry-mobile" error={errors.mobile?.message}>
                    <PhoneField control={control} id="inline-enquiry-mobile" aria-invalid={!!errors.mobile} />
                  </Field>
                  <Field label="Email (optional)" htmlFor="inline-enquiry-email" error={errors.email?.message}>
                    <Input
                      id="inline-enquiry-email"
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                      aria-invalid={!!errors.email}
                      {...register('email')}
                    />
                  </Field>
                </div>

                <div className="flex flex-col gap-[7px]">
                  <label htmlFor="inline-enquiry-journey-type" className="text-[10px] font-bold uppercase tracking-[0.1em] text-redux-ink-mute">
                    What are you dreaming of?
                  </label>
                  <select
                    id="inline-enquiry-journey-type"
                    value={journeyType}
                    onChange={(event) => {
                      setJourneyType(event.target.value);
                      if (event.target.value) setJourneyTypeError(null);
                    }}
                    aria-invalid={!!journeyTypeError}
                    aria-describedby={journeyTypeError ? 'inline-enquiry-journey-type-error' : undefined}
                    className="rounded-[10px] border border-[#eadfdb] bg-white px-3 py-2.5 text-[13px] text-stone-900 focus-visible:border-[#d92d32] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#d92d32]/10"
                  >
                    <option value="">Select a journey type</option>
                    {JOURNEY_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  {journeyTypeError && (
                    <p id="inline-enquiry-journey-type-error" role="alert" className="text-xs text-[#d92d32]">
                      {journeyTypeError}
                    </p>
                  )}
                </div>

                {/* Honeypot — same decoy pattern as `LeadModal`'s own, see that file's comment for why it is forwarded untouched rather than validated empty here. */}
                <div aria-hidden="true" className="absolute left-[-9999px] top-auto h-0 w-0 overflow-hidden">
                  <label htmlFor="inline-enquiry-company">Company</label>
                  <input id="inline-enquiry-company" type="text" tabIndex={-1} autoComplete="off" {...register('honeypot')} />
                </div>

                <div className="flex justify-center">
                  {TURNSTILE_SITE_KEY ? (
                    <TurnstileWidget
                      siteKey={TURNSTILE_SITE_KEY}
                      onVerify={(token) => setValue('turnstileToken', token, { shouldValidate: true })}
                      onExpire={() => setValue('turnstileToken', '', { shouldValidate: true })}
                    />
                  ) : (
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
                  Send my enquiry
                  <Send size={16} aria-hidden="true" />
                </button>
                <p className="text-center text-[11px] leading-relaxed text-redux-ink-mute">No pressure, no spam — just thoughtful travel ideas.</p>
              </form>
            </>
          )}

          {step === 'sending' && (
            <div className="flex flex-col items-center gap-3 py-16">
              <p className="text-[10px] font-bold uppercase tracking-widest2 text-redux-ink-mute">Sending…</p>
              <div className="h-2 w-[200px] rounded-full border border-[#eadfdb] bg-white">
                <motion.div
                  className="h-full rounded-full bg-[#d92d32]"
                  initial={{ width: shouldReduceMotion ? '60%' : '10%' }}
                  animate={{ width: '60%' }}
                  transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
                />
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-[#d92d32]/10 text-[#d92d32]">
                <Check size={22} aria-hidden="true" />
              </div>
              <h3 className="font-redux-display text-2xl font-medium tracking-tight text-stone-900">We&rsquo;ve got it.</h3>
              <p className="max-w-xs text-[13px] text-redux-ink-mute">GTY will call you within business hours to start planning.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
