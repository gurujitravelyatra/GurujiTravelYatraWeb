/**
 * Content model types — tech spec §6.1, corrected per
 * documentation/technical-specification/BLOCKERS.md §3 ("Data-model defects
 * in the spec"). Do not add back `Honeymoon`/`Wildlife` categories without
 * re-checking that file: they were removed deliberately.
 *
 * `GroupTour` WAS removed in §3 on the grounds that `/group-tours` was a
 * Sprint 3-6 route with no `ContentPort` method behind it. That route now
 * exists (BLOCKERS.md Decision G2 — the user reversed Decision G after
 * hitting the 404s in manual testing), so the departure model is back as
 * `GroupDeparture` below, this time WITH a port method. §3's objection is
 * satisfied, not ignored.
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

/**
 * Publication state of a tour — mirrors the `TourStatus` enum in
 * `prisma/schema.prisma`. There is no `'ARCHIVED'` member: archiving is
 * `Package.archivedAt`, an independent fact (see the schema's note on why).
 */
export type TourStatus = 'DRAFT' | 'PUBLISHED';

export interface Package {
  slug: string;
  name: string;
  destinationSlug: string;
  /**
   * Display name of the destination, e.g. "Leh Ladakh" for `leh-ladakh`. The
   * fixture always had this (`dest`); only the slug was surfaced, so consumers
   * were de-slugifying (`destinationSlug.replace(/-/g,' ')`) and getting
   * "vaishnodevi" where the data says "Vaishnodevi". Needed as real text by
   * the destination filter's option labels.
   */
  destinationName: string;
  category: DestinationCategory;
  durationLabel: string; // e.g. "9 Days 8 Nights"
  subtitle: string; // e.g. "Shimla - Kaza - Chandratal"
  /**
   * The PLACEHOLDER key — an opaque token, not a fetchable address (Assumption
   * A4). Kept as the fallback now that `coverImageUrl` exists: a tour with no
   * uploaded cover still renders the token-coloured `PhotoPlaceholder`, which is
   * every one of the 22 fixture tours.
   */
  photoUrl: string;
  /**
   * The uploaded cover photo — a real Cloudinary https URL. Phase C.
   *
   * Optional because most tours do not have one, and absent rather than empty-
   * string for the same reason every other optional here is: `''` would be a
   * value that renders as a broken image, and `undefined` cannot be.
   *
   * `PhotoPlaceholder` takes this and `photoUrl` together and picks: a real
   * `<img>` when this is set, the token box when it is not. Consumers do not
   * branch themselves — that is what stops one surface rendering the upload and
   * another quietly ignoring it.
   */
  coverImageUrl?: string;
  /** Uploaded gallery photos in the admin's chosen order. Phase C. */
  galleryImageUrls?: string[];
  /**
   * The "N Photos" badge. Now derived from the gallery on every admin save (see
   * `toColumnData`), so for any tour edited since Phase C it is the real number
   * of uploaded photos rather than the design export's inherited figure.
   */
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
   *
   * ENFORCED, not merely documented: `src/content/public-listing.ts` excludes
   * every record carrying this flag from all public listing queries, so a
   * flagged tour cannot render a "was ₹X / Save ₹Y" badge anywhere. Clearing
   * the flag (with real figures) re-includes the tour automatically — nothing
   * else needs editing.
   */
  pricingUnverified?: boolean;
  /**
   * Publication state — the draft/published boundary the admin CMS writes.
   *
   * ## REQUIRED, and that is the whole design
   *
   * Every other safety-ish field on this type is optional (`pricingUnverified?`,
   * `isHot?`), and this one deliberately is not. An optional `status` would mean
   * `undefined` has to be interpreted, and the only interpretation that does not
   * break the 22 existing fixture tours is "undefined means published" — i.e.
   * DEFAULT-OPEN. A new adapter, a new fixture, a hand-built test object or a
   * mapper that forgot a line would then produce a publicly listable tour by
   * omission.
   *
   * Making it required inverts that: a record cannot exist without someone
   * having said what its status is, and `tsc` is what enforces it, at every
   * construction site, before any test runs. There are exactly three such sites
   * — `packages.fixture.ts` (checked-in content, always `'PUBLISHED'`),
   * `prisma-content-adapter.ts` (reads the column) and `PackageCard.test.tsx`.
   *
   * `memory/feedback_qg_unenforced-safety-flag.md` is five occurrences of a
   * safety field that existed and did nothing. The strongest available
   * enforcement for a sixth is a type error, not a test.
   */
  status: TourStatus;
  /**
   * ISO timestamp when the tour was archived; ABSENT for every live tour.
   *
   * Independent of `status` — an archived tour keeps the status it had when it
   * was pulled. Withheld from every public surface by the same
   * `isPubliclyListable()` gate, so the two facts compose rather than needing
   * separate checks at each call site.
   */
  archivedAt?: string;
}

export interface PackageRail {
  title: string;
  items: Package[];
}

export interface StatMetric {
  icon: string; // glyph key, resolved to a visual treatment in the component
  value: string; // e.g. "10,000+"
  label: string;
  /**
   * True while the figure is not confirmed by the business — same contract as
   * `Review.isPlaceholder`. The tech spec's own Assumption A3 records that the
   * design export (10,000+ / 150+ / 500+ / 8+ / 98%) and the product spec
   * (25,000+ / 10+ years) disagree and that NEITHER set is final, and
   * "98% Traveller Satisfaction" is exactly the kind of factual claim that
   * `Review` already refuses to fabricate without real review data.
   *
   * Consumers MUST visibly mark these (see `StatsBar`/`WhyGtyBand`) — a
   * placeholder figure may never be presented as settled fact.
   */
  isPlaceholder?: boolean;
}

/**
 * One cell of the "Why Travel With GTY?" band. Static site copy, not
 * `ContentPort` content — but it carries `isPlaceholder` for the same reason
 * `StatMetric` does: one of its titles quotes the canonical years-of-service
 * figure, and an unconfirmed figure must be marked wherever it renders.
 */
export interface WhyItem {
  icon: string;
  title: string;
  description: string;
  /** True when `title` quotes a figure that is not yet confirmed. */
  isPlaceholder?: boolean;
}

export interface FeaturedVideo {
  title: string;
  whenLabel: string;
  thumbnailKey: string;
}

/**
 * One fixed-departure group tour — product-spec §5.4, design export
 * `const GROUPS` (line ~934). This is the ONLY source of departure-specific
 * data in the project: `dateRangeLabel`, `seatsLabel`, `boardingPoints` and
 * `tourManagerLabel` appear in no other fixture, spec section or export
 * constant. Nothing here is derived from the tour catalogue.
 *
 * Deliberately NOT `extends Package`. The tech spec §6.1 drafted it that way,
 * but a departure carries no `priceWas`/`savingsLabel`/`photosCount` in the
 * export, and inheriting them would invite a component to render a
 * "Save ₹X" badge this data cannot support. The two models overlap by
 * coincidence of subject, not by contract.
 */
export interface GroupDeparture {
  slug: string;
  name: string;
  destinationName: string;
  category: DestinationCategory;
  photoUrl: string;
  /** e.g. "12 — 18 May 2026" — verbatim from the export. */
  dateRangeLabel: string;
  /** Month key the export's own chip filter groups by, e.g. "May". */
  month: string;
  /** e.g. "6N / 7D" — the departure's own duration string. */
  durationLabel: string;
  /** Full list, e.g. "Ahmedabad · Delhi". Components derive the "Ex X" short form. */
  boardingPoints: string;
  /** e.g. "Yes, GTY manager" | "Yes, 2 managers". */
  tourManagerLabel: string;
  /** e.g. "₹28,900" — pre-formatted, per-person twin-sharing. */
  priceFrom: string;
  /** e.g. "14 seats left" | "Sold out". */
  seatsLabel: string;
  /** True when `seatsLabel` reads "Sold out" — derived once, not re-parsed per component. */
  isSoldOut: boolean;
  /** Caveat-script accent the export overlays on the photo, e.g. "Faith\nBrings Us\nTogether". */
  scriptAccent: string;
  /**
   * True when this departure's `durationLabel` contradicts the same tour's
   * duration in the package catalogue (`packages.fixture.ts`). Same contract as
   * `Package.pricingUnverified` and `StatMetric.isPlaceholder`: the export
   * transcribed the tour twice with disagreeing values and neither is
   * authoritative, so consumers MUST visibly mark it rather than pick a winner
   * silently. Unlike `pricingUnverified` this does NOT withhold the record —
   * a departure's date and seat count are still real and useful, and hiding
   * half the departures would empty the page.
   */
  durationUnverified?: boolean;
  /**
   * True when this departure's `priceFrom` is the SAME unconfirmed figure that
   * `Package.pricingUnverified` withholds from the public catalogue for the
   * same tour.
   *
   * Why a second flag rather than reading `Package.pricingUnverified`: a
   * departure is not a `Package` (see the note above this interface — the two
   * models overlap by subject, not by contract), so the `public-listing.ts`
   * gate, which is written against `Package`, never saw these records. The
   * result was that "Do Dham Yatra" was suppressed on Home and
   * `/tour-packages` while `/group-tours` published the very same ₹28,900 as
   * its card's most prominent figure (BLOCKERS.md item 9).
   *
   * The treatment deliberately differs from `Package.pricingUnverified`, which
   * WITHHOLDS the record entirely. That gate exists because a fabricated
   * "was ₹X / Save ₹Y" discount badge was at stake; `GroupDepartureCard`
   * renders no such badge, so this is a standalone unconfirmed figure and gets
   * the marker + footnote treatment `StatMetric.isPlaceholder` and
   * `durationUnverified` already use. Clearing the flag (with a confirmed
   * price) removes the marker automatically — nothing else needs editing.
   */
  priceUnverified?: boolean;
}

/**
 * A place a visitor can add to a custom trip — design export `const PLACES`
 * (line ~940). Name + region only: that is all the export stores, and a
 * per-place description/price/duration would have to be invented.
 */
export interface TripPlaceOption {
  slug: string;
  name: string;
  region: string;
  photoUrl: string;
}

/**
 * One entry in the About Us "Our Journey" timeline — design export
 * `timeline` (line ~1182). `year`/`description` map to the export's `y`/`d`.
 *
 * Every entry is `isPlaceholder` for the same reason `StatMetric` is: the
 * milestones quote the same unconfirmed traveller/destination counts that
 * Assumption A3 records as contested ("10,000th traveller", "150+
 * destinations, 10,000+ travellers"), and "First Kedarnath yatra, 22
 * travellers / 2015" is a company-history claim nobody at GTY has confirmed.
 */
export interface AboutMilestone {
  year: string;
  description: string;
  isPlaceholder?: boolean;
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
