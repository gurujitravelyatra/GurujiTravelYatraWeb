import type { LeadSubmissionInput } from '@/server/leads/lead-schema';

/** Shared by `LeadModal` and `InlineEnquiryForm` — reads `?utm_*=` off the current URL at submit time, never during render (no hydration mismatch, no forced-dynamic route). */
export function extractUtm(search: string): LeadSubmissionInput['utm'] {
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
