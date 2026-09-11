/**
 * Content model types — tech spec §6.1, corrected per
 * documentation/technical-specification/BLOCKERS.md §3 ("Data-model defects
 * in the spec"). Do not add back `GroupTour` or `Honeymoon`/`Wildlife`
 * categories without re-checking that file: both were removed deliberately.
 */

/**
 * Every value here appears verbatim as a `cat:` value somewhere in the
 * design export's `RAILS` / `popular` fixtures (verified by grep against
 * `GTY Wireframe Prototype.dc.html`). `Honeymoon` and `Wildlife` were part of
 * the export's filter-chip list only — they match zero fixture records — and
 * are correctly excluded (BLOCKERS.md Decision C).
 *
 * `Mountains`, `Family Trip` and `Pilgrimage` currently match zero records in
 * `packages.fixture.ts`, so they produce no filter chip (chips are derived —
 * see `get-category-chips.ts`). `Family Trip`/`Pilgrimage` were the export's
 * `popular` categorisation of two tours its `RAILS` block categorised as
 * `Family`/`Spiritual`; the tour-data consolidation keeps one record per tour
 * and therefore one category, and those records are flagged
 * `pricingUnverified` precisely because the export contradicted itself. They
 * stay in the union because the export does use them and the ERP may too.
 */
export type DestinationCategory =
  | 'Spiritual'
  | 'Mountains'
  | 'Cultural'
  | 'Family'
  | 'Adventure'
  | 'International'
  | 'Beach'
  | 'Himalaya'
  | 'Family Trip'
  | 'Pilgrimage';

/**
 * The minimal card used only for the International Destinations rail (and,
 * later, the out-of-scope `/destinations` page). The export renders only a
 * name and a photo for these — `region`/`category`/`tagline` are therefore
 * optional rather than invented.
 */
export interface Destination {
  slug: string;
  name: string;
  region?: string;
  category?: DestinationCategory;
  tagline?: string;
  photoUrl: string;
  photosCount?: number;
}

export interface Package {
  slug: string;
  name: string;
  destinationSlug: string;
  category: DestinationCategory;
  durationLabel: string; // e.g. "9 Days 8 Nights"
  subtitle: string; // e.g. "Shimla - Kaza - Chandratal"
  photoUrl: string;
  photosCount: number;
  priceFrom: string; // pre-formatted, e.g. "₹42,500"
  priceWas?: string;
  savingsLabel?: string; // e.g. "5,200"
  seatsLabel?: string; // e.g. "08 seats left" | "Sold out" | "Seats open"
  isHot?: boolean;
  /**
   * True when this record's price/duration could not be confirmed — the design
   * export transcribed the same tour twice with disagreeing values and neither
   * is authoritative. Greppable alongside the `TODO(pricing-confirm)` comments
   * in `packages.fixture.ts`. Must be cleared (with real figures) before the
   * site quotes these prices publicly.
   */
  pricingUnverified?: boolean;
}

export interface PackageRail {
  title: string;
  items: Package[];
}

export interface StatMetric {
  icon: string; // glyph key, resolved to a visual treatment in the component
  value: string; // e.g. "10,000+"
  label: string;
}

export interface FeaturedVideo {
  title: string;
  whenLabel: string;
  thumbnailKey: string;
}

export interface Review {
  photoUrl: string;
  quote: string;
  travellerName: string;
  tripLabel: string;
  /**
   * OPTIONAL, and deliberately absent on placeholder entries. A star rating is
   * a factual claim about a real customer's satisfaction, so it may only be
   * present when it came from a real review — fabricating one (the previous
   * hardcoded `5` on every placeholder) violates BLOCKERS.md Decision H.
   * `ReviewCard` renders no stars at all when this is undefined.
   */
  ratingOutOf5?: number;
  /**
   * True for the obvious-placeholder testimonials seeded per BLOCKERS.md
   * Decision H (no real customer testimonial content exists yet). Consumers
   * must render these plainly — never styled to look like a real review.
   */
  isPlaceholder?: boolean;
}
