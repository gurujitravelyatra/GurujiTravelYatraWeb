// Source: GTY Wireframe Prototype.dc.html, const metrics (inline array), line ~1111
//
// Field mapping: i→icon, n→value, l→label. Per Assumption A3, these numbers
// (10,000+ / 150+ / 500+ / 8+ / 98%) differ from product-spec's prose
// numbers and are used as-is because the export is what's actually wired to
// render, and product-spec itself flags these as destined to become
// admin-editable (i.e. neither set is "final").
import type { StatMetric } from '../types';

export const statMetrics: StatMetric[] = [
  { icon: '☺', value: '10,000+', label: 'Happy Travellers' },
  { icon: '◍', value: '150+', label: 'Destinations' },
  { icon: '☰', value: '500+', label: 'Group Tours' },
  { icon: '✷', value: '8+', label: 'Years of Experience' },
  { icon: '♥', value: '98%', label: 'Traveller Satisfaction' },
];
