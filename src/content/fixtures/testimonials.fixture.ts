// NO SOURCE DATA EXISTS for testimonials anywhere in the design export, the
// product spec, or CLAUDE.md — verified during the spec-time edge-case-
// adversary pass (see documentation/technical-specification/BLOCKERS.md,
// Decision H). Real customer quotes/names/ratings must NEVER be fabricated
// for a real travel brand, so these 3 entries are deliberately, obviously
// placeholder — never styled or worded to look like a real testimonial.
//
// TODO(real-testimonials): replace all 3 entries with real customer
// testimonials before this section ships publicly. Every entry here is
// greppable via `isPlaceholder: true`.
import type { Review } from '../types';

const PLACEHOLDER_QUOTE = 'Testimonial copy pending — do not ship without real customer quotes.';
const PLACEHOLDER_NAME = '[Traveller name pending]';
const PLACEHOLDER_TRIP = '[Trip pending]';

export const testimonials: Review[] = [
  {
    photoUrl: 'testimonial-placeholder-1',
    quote: PLACEHOLDER_QUOTE,
    travellerName: PLACEHOLDER_NAME,
    tripLabel: PLACEHOLDER_TRIP,
    ratingOutOf5: 5,
    isPlaceholder: true,
  },
  {
    photoUrl: 'testimonial-placeholder-2',
    quote: PLACEHOLDER_QUOTE,
    travellerName: PLACEHOLDER_NAME,
    tripLabel: PLACEHOLDER_TRIP,
    ratingOutOf5: 5,
    isPlaceholder: true,
  },
  {
    photoUrl: 'testimonial-placeholder-3',
    quote: PLACEHOLDER_QUOTE,
    travellerName: PLACEHOLDER_NAME,
    tripLabel: PLACEHOLDER_TRIP,
    ratingOutOf5: 5,
    isPlaceholder: true,
  },
];
