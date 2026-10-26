import type { LeadSubmissionInput } from '@/server/leads/lead-schema';
import { GTY_PHONE_DISPLAY } from '@/lib/gty-contact';

/**
 * The browser's side of `POST /api/leads`.
 *
 * ## Why the newsletter form does not use this
 *
 * This route's schema is a discriminated union on `formType`, accepting
 * only the four tags that have a real trigger (enquiry/brochure/group-tour-
 * reservation/custom-trip — all four now forward to the real CRM via
 * `POST /public/enquiries`, CRM-migration Step 3). A newsletter signup has
 * no `formType` to supply and no CRM `kind` to map onto (see
 * `src/lib/newsletter-adapter.ts`'s own header) — `Newsletter.tsx` calls
 * that module directly instead, never this one. Two submit paths is the
 * honest state of the system: one that genuinely reaches a CRM, one that
 * genuinely does not yet.
 *
 * ## Every failure is reported as something a visitor can act on
 *
 * `submitLeadRequest` never throws and never rejects. A lost lead is
 * unrecoverable — nothing is persisted client-side — so every outcome resolves
 * to either a success or an error carrying text safe to render, and the real
 * cause is left for the console.
 */

export interface LeadApiSuccess {
  status: 'success';
  leadId: string;
}

export interface LeadApiError {
  status: 'error';
  /** Always safe to render verbatim in the modal's banner. */
  message: string;
  /** Present only on a 400: `{ 'field.path': [messages] }` from `ApiFailure.fields`. */
  fields?: Record<string, string[]>;
}

export type LeadApiResult = LeadApiSuccess | LeadApiError;

export const LEAD_API_PATH = '/api/leads';

/**
 * Covers an offline device, DNS failure, or a response that is not JSON. All
 * of these are transient and retryable, so the copy asks for a retry first and
 * offers the phone number as the guaranteed way through.
 */
const NETWORK_ERROR_MESSAGE = `We couldn't reach us just now — please try again in a moment, or call ${GTY_PHONE_DISPLAY} and we'll take your details directly.`;

/** A 5xx, or a 2xx whose body is not the shape this route documents. */
const SERVER_ERROR_MESSAGE = `Something went wrong at our end — your details were not sent. Please try again, or call ${GTY_PHONE_DISPLAY}.`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Narrows `fields` defensively rather than trusting the body's shape. This is
 * parsed straight into `form.setError()` calls, so a malformed entry would
 * otherwise put a non-string where React renders a message.
 */
function readFieldErrors(body: unknown): Record<string, string[]> | undefined {
  if (!isRecord(body) || !isRecord(body.fields)) return undefined;

  const fields: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(body.fields)) {
    const messages = Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
    if (messages.length > 0) fields[key] = messages;
  }
  return Object.keys(fields).length > 0 ? fields : undefined;
}

function readErrorMessage(body: unknown, fallback: string): string {
  return isRecord(body) && typeof body.error === 'string' && body.error.trim() ? body.error : fallback;
}

export async function submitLeadRequest(request: LeadSubmissionInput): Promise<LeadApiResult> {
  let response: Response;
  try {
    response = await fetch(LEAD_API_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
  } catch (error) {
    console.error('[leads] POST /api/leads could not be reached:', error);
    return { status: 'error', message: NETWORK_ERROR_MESSAGE };
  }

  // Read the body BEFORE branching on `response.ok`: a 400 carries the
  // field-level detail that keeps the visitor from re-typing everything, and
  // that detail is only in the body.
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }

  if (!response.ok) {
    return {
      status: 'error',
      message: readErrorMessage(body, response.status >= 500 ? SERVER_ERROR_MESSAGE : NETWORK_ERROR_MESSAGE),
      fields: readFieldErrors(body),
    };
  }

  // A 200 is only treated as success if the envelope actually says a lead was
  // received. Telling a visitor "GTY has your details" off a body this code
  // could not parse would be the one failure mode worse than an error banner.
  const data = isRecord(body) ? body.data : undefined;
  if (isRecord(data) && data.received === true && typeof data.leadId === 'string') {
    return { status: 'success', leadId: data.leadId };
  }

  console.error('[leads] POST /api/leads returned an unrecognised success body:', body);
  return { status: 'error', message: SERVER_ERROR_MESSAGE };
}
