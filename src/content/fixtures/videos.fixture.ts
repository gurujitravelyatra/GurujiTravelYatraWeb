// Source: GTY Wireframe Prototype.dc.html, const VIDEOS, line ~1000
//
// Field mapping: t→title, w→whenLabel, k→thumbnailKey (opaque string key,
// see Assumption A4 — resolved to a token-coloured placeholder surface by
// the component, never a real photo URL).
//
// `whenLabel` NO LONGER CARRIES A DATE. The export hardcoded captions like
// "Departed 06 Oct 2026 · 42 travellers" — a fixed calendar date plus a
// traveller count, neither of which has any source: no departure record, no
// booking data, no trip archive exists. Two of the four were also still in
// the future, so the site read "Departed <a date that hasn't happened>", and
// all four would read as stale the moment those dates passed. Per BLOCKERS.md
// Decision H (never fabricate realistic-looking content), they are replaced
// with an obvious, date-free placeholder rather than a guessed real date.
//
// TODO(real-trip-films): replace `whenLabel` with a real departure date +
// traveller count — ideally derived from the departure record once the ERP
// adapter exists, not re-hardcoded — before this section ships publicly.
import type { FeaturedVideo } from '../types';

/** Deliberately asserts nothing. See TODO(real-trip-films) above. */
const PLACEHOLDER_WHEN = 'Trip details pending';

export const featuredVideos: FeaturedVideo[] = [
  { title: 'Spiti Valley Circuit', whenLabel: PLACEHOLDER_WHEN, thumbnailKey: 'Spiti_Valley' },
  { title: 'Leh Ladakh Group Trip', whenLabel: PLACEHOLDER_WHEN, thumbnailKey: 'Leh' },
  { title: 'Kedarnath Do Dham Yatra', whenLabel: PLACEHOLDER_WHEN, thumbnailKey: 'Kedarnath_Temple' },
  { title: 'Kashmir Family Escape', whenLabel: PLACEHOLDER_WHEN, thumbnailKey: 'Kashmir_Valley' },
];
