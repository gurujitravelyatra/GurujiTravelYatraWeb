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
};
