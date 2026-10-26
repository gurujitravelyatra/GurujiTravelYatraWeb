import { z } from 'zod';

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
    .regex(/^[+]?[\d\s-]{10,15}$/, 'Please enter a valid mobile number.'),
  email: z.union([z.literal(''), z.string().trim().email('Please enter a valid email address.')]).optional(),
  travelDate: z.string().optional(),
  travellers: z
    .union([z.literal(''), z.coerce.number().int().min(1, 'Enter at least 1 traveller.')])
    .optional(),
  city: z.string().trim().optional(),
  message: z.string().trim().optional(),
  /**
   * CRM-migration Step 3 — `POST /public/enquiries` requires all three
   * (documentation/technical-specification/public-website.md). `consent` is
   * a visible, required checkbox; `turnstileToken` is set by
   * `TurnstileWidget`'s `onVerify` callback via `form.setValue`, never typed
   * — it has no visible input of its own, so the empty-string default below
   * is what a submit attempt sees before the widget resolves, and the
   * message below is what the visitor sees for it. `honeypot` is a hidden
   * decoy input a real visitor's browser never touches.
   */
  // Modelled as `boolean` (not `z.literal(true)`) so an unchecked checkbox
  // is a representable, default-able form VALUE (`false`) rather than a
  // type error — the refinement is what actually enforces "must be true".
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
  consent: false,
  turnstileToken: '',
  honeypot: '',
};
