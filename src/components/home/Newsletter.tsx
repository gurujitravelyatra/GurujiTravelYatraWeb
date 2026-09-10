'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { leadAdapter } from '@/content/adapters/not-implemented-lead-adapter';
import type { LeadPayload } from '@/content/ports';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const newsletterSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address.'),
});

type NewsletterValues = z.infer<typeof newsletterSchema>;

type SubmitState = { status: 'idle' | 'sending' } | { status: 'success'; message: string } | { status: 'error'; message: string };

/**
 * [TOKENS] — no design reference exists for this section (tech spec §4.4
 * row 13); flagged for design QA before merge (Open Question Q1). Unlike
 * Recent Trips/Instagram, this section IS real functionality per the tech
 * spec: submits through `LeadSubmissionPort` with `source: 'Newsletter
 * Signup'` and only `{ email }` populated — everything else in
 * `LeadPayload` stays undefined, matching §6.2/§4.4.
 */
export function Newsletter() {
  const [state, setState] = useState<SubmitState>({ status: 'idle' });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NewsletterValues>({ resolver: zodResolver(newsletterSchema), defaultValues: { email: '' } });

  const onSubmit = async (values: NewsletterValues) => {
    setState({ status: 'sending' });

    const payload: LeadPayload = {
      email: values.email,
      source: 'Newsletter Signup',
      sourcePageUrl: window.location.href,
      timestamp: new Date().toISOString(),
    };

    const result = await leadAdapter.submitLead(payload);
    if (result.status === 'success') {
      setState({ status: 'success', message: result.confirmationMessage });
    } else {
      setState({ status: 'error', message: result.message });
    }
  };

  return (
    <section
      data-testid="section-13-newsletter"
      className="flex flex-col items-center gap-4 border-t border-gty-border-6 bg-gty-primary px-gx py-[34px] text-center"
    >
      {/* [TOKENS] no design reference — flag for design QA */}
      <h2 className="text-24 font-extrabold tracking-tightest text-gty-white">Let&#39;s Travel Together</h2>
      <p className="max-w-[420px] text-13-5 text-gty-white/90">
        Get curated journeys and early departure dates straight to your inbox.
      </p>

      {state.status === 'success' ? (
        <p role="status" className="text-13-5 font-bold text-gty-white">
          {state.message}
        </p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex w-full max-w-[440px] flex-col gap-2 760:flex-row">
          <div className="flex-1 text-left">
            <label htmlFor="newsletter-email" className="sr-only">
              Email address
            </label>
            <Input
              id="newsletter-email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'newsletter-email-error' : undefined}
              className="bg-gty-white"
              {...register('email')}
            />
            {errors.email && (
              <p id="newsletter-email-error" role="alert" className="mt-1 text-11 text-gty-white">
                {errors.email.message}
              </p>
            )}
          </div>
          <Button type="submit" variant="default" disabled={state.status === 'sending'} className="justify-center bg-gty-white">
            {state.status === 'sending' ? 'Sending…' : 'Subscribe Now'} <span aria-hidden="true">→</span>
          </Button>
        </form>
      )}

      {state.status === 'error' && (
        <p role="alert" className="max-w-[420px] text-11-5 text-gty-white/90">
          {state.message}
        </p>
      )}
    </section>
  );
}
