// Source: GTY Wireframe Prototype.dc.html, const metrics (inline array), line ~1111
//
// Field mapping: i→icon, n→value, l→label.
//
// EVERY figure here is flagged `isPlaceholder` — none of them is confirmed:
//
//  - Assumption A3 in the tech spec records that the export (10,000+ / 150+ /
//    500+ / 8+ / 98%) and the product spec (25,000+ Happy Travellers, 10+
//    Years) state DIFFERENT numbers, and that the product spec itself says
//    these should become admin-editable — i.e. neither set is final.
//  - "98% Traveller Satisfaction" is a factual claim about real customers of
//    exactly the kind `Review.ratingOutOf5` already refuses to fabricate
//    without real review data (BLOCKERS.md Decision H). No review data exists.
//
// Rendering them unmarked presented an unsettled, self-contradicting number as
// settled fact. They are kept (the export is what's wired to render) but every
// consumer must visibly mark them — see `StatsBar` and `WhyGtyBand`.
//
// TODO(stats-confirm): replace with the business's real figures and drop the
// `isPlaceholder` flags. Greppable alongside `TODO(pricing-confirm)`.
import type { StatMetric } from '../types';

export const statMetrics: StatMetric[] = [
  { icon: '☺', value: '10,000+', label: 'Happy Travellers', isPlaceholder: true },
  { icon: '◍', value: '150+', label: 'Destinations', isPlaceholder: true },
  { icon: '☰', value: '500+', label: 'Group Tours', isPlaceholder: true },
  { icon: '✷', value: '8+', label: 'Years of Experience', isPlaceholder: true },
  { icon: '♥', value: '98%', label: 'Traveller Satisfaction', isPlaceholder: true },
];

/**
 * Lookup by label, for the few places that need ONE specific figure rather
 * than the whole bar (e.g. the "Why Travel With GTY?" band's years-of-service
 * claim, and the Hero's 3-card strip). Returning the canonical record — not a
 * re-typed literal — is what keeps a single source of truth for each number
 * AND carries its `isPlaceholder` flag along to the consumer.
 */
export function getStatByLabel(label: string): StatMetric | undefined {
  return statMetrics.find((stat) => stat.label === label);
}
