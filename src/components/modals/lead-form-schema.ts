import { z } from 'zod';

import { isValidLocalNumber, parsePhone } from '@/lib/calling-codes';

/**
 * Shared Zod schema for the Enquiry and Brochure forms — tech spec §4.3.
 * Both variants render the exact same 7-field set (BLOCKERS.md Open
 * Question 4, resolved against the export: one modal component, one field
 * set, only copy differs). Client-side validation only — real
 * sanitization/rate-limiting is the ERP's job once that adapter exists
 * (NFRs, CLAUDE.md §5.1/§11).
 */
export const leadFormSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your full name.'),
  mobile: z
    .string()
    .trim()
    .min(1, 'Please enter your mobile number.')
    .regex(/^[+]?[\d\s-]{10,15}$/, 'Please enter a valid mobile number.')
    // New brief (2026-11-15), item 3: "mobile valid for the selected
    // country; India = 10 digits starting 6-9" must actually BLOCK submit,
    // not just hint at it — `isValidLocalNumber` already existed
    // (`PhoneField`'s own "looks incomplete" aria-invalid hint) but was
    // never wired into the schema that gates `handleSubmit`. Reusing it
    // here, never duplicating its digit rules, keeps the two in sync.
    // Still never stricter than the unchanged server regex above it.
    .refine(
      (value) => {
        const { callingCode, localNumber } = parsePhone(value);
        return isValidLocalNumber(callingCode, localNumber);
      },
      { message: 'Please enter a valid mobile number.' }
    ),
  email: z.union([z.literal(''), z.string().trim().email('Please enter a valid email address.')]).optional(),
  travelDate: z.string().optional(),
  travellers: z
    .union([z.literal(''), z.coerce.number().int().min(1, 'Enter at least 1 traveller.').max(99, 'Enter at most 99 travellers.')])
    .optional(),
  city: z.string().trim().optional(),
  message: z.string().trim().optional(),
  /**
   * CRM-migration Step 3 — `POST /public/enquiries` requires all three
   * (documentation/technical-specification/public-website.md).
   * `turnstileToken` is set by `TurnstileWidget`'s `onVerify` callback via
   * `form.setValue`, never typed — it has no visible input of its own, so
   * the empty-string default below is what a submit attempt sees before
   * the widget resolves, and the message below is what the visitor sees
   * for it. `honeypot` is a hidden decoy input a real visitor's browser
   * never touches.
   *
   * New brief (2026-11-15, final corrections), item 4: `consent` is no
   * longer a visible checkbox the visitor has to tick — it is sent as
   * `true` implicitly on every submit (the disclosure moved to a note
   * line under the submit button instead). Defaults to `true` for exactly
   * that reason; nothing in the UI ever sets it to anything else anymore,
   * so the refinement below can never actually fail in practice, but it
   * stays (rather than simplifying to `z.literal(true)`) as a safety net —
   * if some future change ever threads a real value into this field
   * again, the check is still there to catch it.
   */
  consent: z.boolean().refine((value) => value === true, { message: 'Please agree to be contacted to continue.' }),
  turnstileToken: z.string().min(1, 'Please complete the verification challenge.'),
  honeypot: z.string().optional(),
});

export type LeadFormValues = z.infer<typeof leadFormSchema>;

export const leadFormDefaultValues: LeadFormValues = {
  name: '',
  mobile: '',
  email: '',
  travelDate: '',
  travellers: '',
  city: '',
  message: '',
  consent: true,
  turnstileToken: '',
  honeypot: '',
};
