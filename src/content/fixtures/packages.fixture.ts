// Source: GTY Wireframe Prototype.dc.html — const RAILS (line ~970) and the
// two `const popular` entries (line ~1112) that have no rail counterpart.
//
// SINGLE SOURCE OF TRUTH for every tour record on the site. `popular.fixture.ts`
// used to keep its own independent copies of 3 of these tours with conflicting
// price/duration/category values; it is now a selection-only view that looks
// records up from here by slug. Do NOT re-add tour data to any other fixture.
//
// Field mapping (tech spec §4.4 / §6.3): photos→photosCount, dur→durationLabel,
// sub→subtitle, save→savingsLabel, price→priceFrom, was→priceWas,
// dest→destinationSlug (kebab-cased via slugify), cat→category. `slug` is
// derived from `name`, never hand-typed, so it can never drift from the
// display name.
import type { DestinationCategory, Package, PackageRail } from '../types';
import { slugify } from '../slug';

interface TourFixtureItem {
  photos: number;
  name: string;
  dest: string;
  cat: DestinationCategory;
  dur: string;
  sub: string;
  save: string;
  price: string;
  was: string;
  /**
   * Set on the 3 tours that the design export transcribed TWICE (once in
   * `RAILS`, once in `popular`) with values that disagree. The consolidation
   * keeps the `RAILS` transcription — but neither transcription is confirmed
   * correct, so nothing here may be treated as launch-ready pricing.
   * See the `TODO(pricing-confirm)` comments on the affected records.
   */
  pricingUnverified?: boolean;
}

interface RailFixture {
  t: string;
  items: TourFixtureItem[];
}

const RAILS_FIXTURE: RailFixture[] = [
  {
    t: 'Trending Tour Packages',
    items: [
      { photos: 11, name: 'Explore Ladakh', dest: 'Leh Ladakh', cat: 'Adventure', dur: '7 Days 6 Nights', sub: 'with Turtuk & Sham Valley', save: '4,000', price: '₹19,800', was: '₹23,800' },
      { photos: 14, name: 'Spiti Valley Circuit', dest: 'Spiti Valley', cat: 'Adventure', dur: '9 Days 8 Nights', sub: 'Shimla - Kaza - Chandratal', save: '5,200', price: '₹42,500', was: '₹47,700' },
      // TODO(pricing-confirm): value unverified, confirm before launch.
      // `dur`/`was`/`save` conflict with the export's `popular` transcription
      // ('7 Days 6 Nights' / '₹31,900' / '3,000'). Neither is confirmed.
      { photos: 8, name: 'Do Dham Yatra', dest: 'Kedarnath', cat: 'Spiritual', dur: '6 Days 5 Nights', sub: 'Kedarnath & Badrinath', save: '3,500', price: '₹28,900', was: '₹32,400', pricingUnverified: true },
      // TODO(pricing-confirm): value unverified, confirm before launch.
      // `price`/`dur` agree across both transcriptions, but `cat`/`photos`/`sub`
      // conflict with the export's `popular` entry ('Family Trip' / 14 /
      // '...- Sonmarg'), so this record as a whole is not confirmed.
      { photos: 11, name: 'Kashmir Family Escape', dest: 'Kashmir', cat: 'Family', dur: '6 Days 5 Nights', sub: 'Srinagar - Gulmarg - Pahalgam', save: '4,000', price: '₹34,200', was: '₹38,200', pricingUnverified: true },
      // TODO(pricing-confirm): value unverified, confirm before launch.
      // `price`/`dur` agree across both transcriptions, but `cat`/`photos`
      // conflict with the export's `popular` entry ('Pilgrimage' / 10).
      { photos: 14, name: 'Kashi Darshan', dest: 'Varanasi', cat: 'Spiritual', dur: '4 Days 3 Nights', sub: 'Varanasi - Sarnath - Prayagraj', save: '2,000', price: '₹16,400', was: '₹18,400', pricingUnverified: true },
    ],
  },
  {
    t: 'International Tour Packages',
    items: [
      { photos: 8, name: 'Maldives Escape', dest: 'Maldives', cat: 'International', dur: '5 Days 4 Nights', sub: 'Male - Maafushi - Water Villa', save: '8,000', price: '₹78,500', was: '₹86,500' },
      { photos: 11, name: 'Singapore Highlights', dest: 'Singapore', cat: 'International', dur: '6 Days 5 Nights', sub: 'with Sentosa & Universal Studios', save: '6,500', price: '₹64,900', was: '₹71,400' },
      { photos: 14, name: 'Thailand Discovery', dest: 'Thailand', cat: 'International', dur: '7 Days 6 Nights', sub: 'Bangkok - Pattaya - Phuket', save: '7,200', price: '₹58,400', was: '₹65,600' },
      { photos: 8, name: 'Bali Getaway', dest: 'Bali', cat: 'International', dur: '6 Days 5 Nights', sub: 'Ubud - Kuta - Nusa Penida', save: '6,000', price: '₹61,200', was: '₹67,200' },
      { photos: 11, name: 'Dubai City Break', dest: 'Dubai', cat: 'International', dur: '5 Days 4 Nights', sub: 'with Desert Safari & Burj Khalifa', save: '5,500', price: '₹54,800', was: '₹60,300' },
    ],
  },
  {
    t: 'North India Tour Packages',
    items: [
      { photos: 14, name: 'Manali Snow Trip', dest: 'Manali', cat: 'Family', dur: '5 Days 4 Nights', sub: 'Solang - Rohtang - Kasol', save: '3,000', price: '₹18,600', was: '₹21,600' },
      { photos: 8, name: 'Vaishno Devi Yatra', dest: 'Vaishnodevi', cat: 'Spiritual', dur: '4 Days 3 Nights', sub: 'Katra - Bhawan - Bhairon', save: '2,200', price: '₹14,900', was: '₹17,100' },
      { photos: 11, name: 'Golden Triangle', dest: 'Uttarakhand', cat: 'Cultural', dur: '6 Days 5 Nights', sub: 'Delhi - Agra - Jaipur', save: '3,800', price: '₹26,400', was: '₹30,200' },
      { photos: 14, name: 'Rishikesh Adventure', dest: 'Rishikesh', cat: 'Adventure', dur: '4 Days 3 Nights', sub: 'Rafting - Camping - Ganga Aarti', save: '2,400', price: '₹12,800', was: '₹15,200' },
      { photos: 8, name: 'Amritsar & Dharamshala', dest: 'Uttarakhand', cat: 'Cultural', dur: '6 Days 5 Nights', sub: 'Golden Temple - Wagah - McLeodganj', save: '3,200', price: '₹24,700', was: '₹27,900' },
    ],
  },
  {
    t: 'South India Tour Packages',
    items: [
      { photos: 11, name: 'Rameshwaram Darshan', dest: 'Rameshwaram', cat: 'Spiritual', dur: '5 Days 4 Nights', sub: 'Madurai - Rameshwaram - Kanyakumari', save: '2,800', price: '₹21,300', was: '₹24,100' },
      { photos: 14, name: 'Kerala Backwaters', dest: 'Kerala', cat: 'Family', dur: '6 Days 5 Nights', sub: 'Munnar - Alleppey - Kochi', save: '4,200', price: '₹31,500', was: '₹35,700' },
      { photos: 8, name: 'Ooty & Coorg', dest: 'Ooty', cat: 'Family', dur: '5 Days 4 Nights', sub: 'Ooty - Coonoor - Coorg', save: '3,100', price: '₹23,800', was: '₹26,900' },
      { photos: 11, name: 'Tirupati Balaji Yatra', dest: 'Tirupati', cat: 'Spiritual', dur: '4 Days 3 Nights', sub: 'Tirumala - Kanipakam - Srikalahasti', save: '2,000', price: '₹17,200', was: '₹19,200' },
      { photos: 14, name: 'Goa Beach Holiday', dest: 'Goa', cat: 'Beach', dur: '5 Days 4 Nights', sub: 'North Goa - South Goa - Dudhsagar', save: '3,400', price: '₹22,600', was: '₹26,000' },
    ],
  },
];

/**
 * Tours the export lists ONLY in `popular` — they belong to no rail, but a
 * `PackageCard` on Home still links to `/tour-packages/{slug}` for them
 * (BLOCKERS.md Decision D), so they are canonical records like any other.
 * Transcribed verbatim; neither collides with a rail slug.
 */
const POPULAR_ONLY_FIXTURE: TourFixtureItem[] = [
  { photos: 12, name: 'Spiti Valley Bike Trip', dest: 'Spiti Valley', cat: 'Adventure', dur: '8 Days 7 Nights', sub: 'Delhi - Chitkul - Kaza - Chandratal - Manali', save: '4,000', price: '₹25,800', was: '₹29,800' },
  { photos: 14, name: 'Leh Ladakh Group Trip from Delhi', dest: 'Leh Ladakh', cat: 'Himalaya', dur: '10 Days 9 Nights', sub: 'with Umling La & Tso Moriri', save: '4,000', price: '₹33,800', was: '₹37,800' },
];

function toPackage(item: TourFixtureItem): Package {
  return {
    slug: slugify(item.name),
    name: item.name,
    // Opaque string key (Assumption A4) — no real photo files exist. Rendered
    // as a token-coloured placeholder surface by the card component, never a
    // fabricated URL.
    photoUrl: item.dest,
    destinationSlug: slugify(item.dest),
    destinationName: item.dest,
    category: item.cat,
    durationLabel: item.dur,
    subtitle: item.sub,
    photosCount: item.photos,
    priceFrom: item.price,
    priceWas: item.was,
    savingsLabel: item.save,
    pricingUnverified: item.pricingUnverified,
    /**
     * THE ONE PLACE the fixture catalogue's publication state is decided, and it
     * is a constant on purpose.
     *
     * Checked-in fixture content has no draft concept: these 22 tours were
     * transcribed from the design export, reviewed in a diff, and are the live
     * public catalogue. There is no editor, no save button and no half-finished
     * state for them to be in — the only honest status for a record that exists
     * in this file is `'PUBLISHED'`.
     *
     * Drafts are a DATABASE concept, introduced by the admin CMS, and they
     * arrive through `PrismaContentAdapter`, which reads the real column. This
     * constant is what makes the two paths comparable: `Package.status` is
     * required precisely so this line had to be written deliberately rather than
     * defaulted into existence by an omission somewhere.
     *
     * `archivedAt` is left absent for the same reason — nothing can archive a
     * fixture.
     */
    status: 'PUBLISHED',
  };
}

/**
 * Built once, keyed by slug. Construction throws on a duplicate slug so a
 * future re-introduction of conflicting copies fails loudly at import time
 * instead of silently letting one arbitrary source win (the exact defect this
 * consolidation removes). Also asserted by
 * `src/content/__tests__/tour-data-integrity.test.ts`.
 */
const toursBySlug: ReadonlyMap<string, Package> = (() => {
  const map = new Map<string, Package>();
  for (const item of [...RAILS_FIXTURE.flatMap((rail) => rail.items), ...POPULAR_ONLY_FIXTURE]) {
    const pkg = toPackage(item);
    const existing = map.get(pkg.slug);
    if (existing) {
      throw new Error(
        `Duplicate tour slug "${pkg.slug}" in packages.fixture.ts — tour data must be defined exactly once. ` +
          `Conflicting names: "${existing.name}" and "${pkg.name}".`
      );
    }
    map.set(pkg.slug, pkg);
  }
  return map;
})();

/** Every tour record on the site, defined exactly once. Rail order first, then popular-only. */
export const allTours: Package[] = Array.from(toursBySlug.values());

export function getTourBySlug(slug: string): Package | undefined {
  return toursBySlug.get(slug);
}

/** Slug lookup for callers that treat a miss as a data-integrity bug (e.g. the popular selection). */
export function requireTourBySlug(slug: string): Package {
  const tour = toursBySlug.get(slug);
  if (!tour) {
    throw new Error(`Unknown tour slug "${slug}" — no such record in packages.fixture.ts.`);
  }
  return tour;
}

/**
 * The 4 Tour Packages rails. A grouping VIEW over `allTours` — each item is
 * the same object instance held in `toursBySlug`, never a second copy.
 */
export const packageRails: PackageRail[] = RAILS_FIXTURE.map((rail) => ({
  title: rail.t,
  items: rail.items.map((item) => requireTourBySlug(slugify(item.name))),
}));
