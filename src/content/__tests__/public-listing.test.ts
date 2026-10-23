import { FixtureContentAdapter } from '../adapters/fixture-content-adapter';
import { allTours } from '../fixtures/packages.fixture';
import { popularPackages } from '../fixtures/popular.fixture';
import { internationalDestinations } from '../fixtures/international.fixture';
import { getAllPackages, getPackageBySlug } from '../get-all-packages';
import {
  getDestinationOptions,
  getPriceRange,
  isPubliclyListable,
  publiclyListedRails,
  toursRenderedOnCataloguePage,
} from '../public-listing';

/**
 * The FIXTURE adapter specifically, constructed here rather than imported as the
 * site-wide singleton. This suite is about the public-listing gate's behaviour,
 * which is a property of the content itself — not of which adapter
 * `src/content/content-adapter.ts` happens to compose. (`PrismaContentAdapter`
 * applies the same `isPubliclyListable` predicate; it is covered separately.)
 */
const contentAdapter = new FixtureContentAdapter();

/**
 * CRM-migration decision 1 — the `pricingUnverified` WITHHOLD gate is REMOVED.
 *
 * These three tours still carry `pricingUnverified: true` in the fixture
 * (the design export transcribed them twice with disagreeing prices), but
 * `publicWithholdReason()` no longer reads that flag: the CRM's own
 * `isLiveOnWebsite` publish gate (today's stand-in: `status`/`archivedAt`) is
 * trusted fully instead of the website second-guessing a published price.
 * This suite now asserts the INVERSE of what it used to — these tours are
 * ordinary, fully-listed records.
 */
const PREVIOUSLY_WITHHELD_TOURS = ['Do Dham Yatra', 'Kashi Darshan', 'Kashmir Family Escape'];

describe('public listing gate', () => {
  it('still holds the flagged records in the fixture, flag and all', () => {
    // The flag itself is untouched — no fixture edit, no migration — only the
    // GATE stopped reading it. Deleting the flag would be a separate, later
    // cleanup once nothing admin-side reads it either.
    const flagged = allTours.filter((tour) => tour.pricingUnverified).map((tour) => tour.name);
    expect(flagged.sort()).toEqual(PREVIOUSLY_WITHHELD_TOURS);
  });

  it('no longer withholds a pricingUnverified record from any public listing query', async () => {
    const [tours, popular, rails] = await Promise.all([
      contentAdapter.getAllTours(),
      contentAdapter.getPopularDestinations(),
      contentAdapter.getPackageRails(),
    ]);

    const everythingListed = [...tours, ...popular, ...rails.flatMap((rail) => rail.items), ...(await getAllPackages())];
    const listedNames = new Set(everythingListed.map((pkg) => pkg.name));

    expect(everythingListed.length).toBeGreaterThan(0);
    for (const pkg of everythingListed) {
      // The predicate's own `isPubliclyListable` never disagrees with the
      // fact that the tour is actually present in every listing query.
      expect(isPubliclyListable(pkg)).toBe(true);
    }
    for (const name of PREVIOUSLY_WITHHELD_TOURS) {
      expect(listedNames.has(name)).toBe(true);
    }
  });

  it('resolves /tour-packages/[slug] for a tour whose pricing was previously unconfirmed', async () => {
    for (const slug of ['do-dham-yatra', 'kashi-darshan', 'kashmir-family-escape']) {
      await expect(getPackageBySlug(slug)).resolves.toBeDefined();
    }
  });

  it('includes those slugs in generateStaticParams()', async () => {
    const slugs = (await getAllPackages()).map((pkg) => pkg.slug);

    expect(slugs).toContain('do-dham-yatra');
    expect(slugs).toContain('kashi-darshan');
    expect(slugs).toContain('kashmir-family-escape');
  });

  it('serves every tour in the fixture — the gate no longer withholds any of them', async () => {
    const tours = await contentAdapter.getAllTours();

    expect(tours).toHaveLength(allTours.length);
    expect(tours).toHaveLength(22);
  });

  it('serves the full Popular rail, not a narrowed one', async () => {
    const popular = await contentAdapter.getPopularDestinations();

    expect(popular).toHaveLength(5);
    expect(popularPackages).toHaveLength(5);
  });

  it('keeps all 4 rails at full strength — nothing is narrowed any more', async () => {
    const rails = await contentAdapter.getPackageRails();

    expect(rails).toHaveLength(4);
    expect(rails[0].title).toBe('Trending Tour Packages');
    expect(rails[0].items).toHaveLength(5);
    for (const rail of rails.slice(1)) {
      expect(rail.items).toHaveLength(5);
    }
  });

  it('a pricingUnverified record is listable — the flag no longer gates visibility', () => {
    const tour = allTours.find((item) => item.name === 'Do Dham Yatra');
    expect(tour).toBeDefined();
    expect(tour!.pricingUnverified).toBe(true);
    expect(isPubliclyListable(tour!)).toBe(true);
  });
});

describe('getDestinationOptions', () => {
  it('offers only destinations that have at least one listed journey', () => {
    const options = getDestinationOptions(toursRenderedOnCataloguePage);

    for (const option of options) {
      expect(toursRenderedOnCataloguePage.some((tour) => tour.destinationSlug === option.slug)).toBe(true);
    }
  });

  it('includes destinations reachable only through a previously price-unconfirmed tour', () => {
    const slugs = getDestinationOptions(toursRenderedOnCataloguePage).map((option) => option.slug);

    // Kedarnath/Varanasi are reachable only through tours that used to carry
    // pricingUnverified; the gate no longer withholds them.
    expect(slugs).toContain('kedarnath');
    expect(slugs).toContain('varanasi');
  });

  it('de-duplicates destinations served by several tours', () => {
    const slugs = getDestinationOptions(toursRenderedOnCataloguePage).map((option) => option.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('returns nothing for no tours', () => {
    expect(getDestinationOptions([])).toEqual([]);
  });
});

/** M1 — every featured international destination must be backed by a real tour. */
describe('international destinations', () => {
  it('features no destination the catalogue cannot serve (the Malaysia regression)', () => {
    const listedSlugs = new Set(toursRenderedOnCataloguePage.map((tour) => tour.destinationSlug));

    for (const destination of internationalDestinations) {
      expect(listedSlugs.has(destination.slug)).toBe(true);
    }
  });

  it('no longer lists Malaysia, which had no tour at all', () => {
    expect(internationalDestinations.map((destination) => destination.name)).not.toContain('Malaysia');
    expect(internationalDestinations).toHaveLength(5);
  });
});

/** M6 — the price readout must be computed, so it cannot drift from the data. */
describe('getPriceRange', () => {
  it('reports the true bounds of the catalogue', () => {
    const range = getPriceRange(toursRenderedOnCataloguePage);

    // Unaffected by decision 1: the three previously-withheld tours
    // (₹16,400 / ₹28,900 / ₹34,200) all sit strictly between the catalogue's
    // real min and max, so including them does not move either bound.
    expect(range).toEqual({ min: 12800, max: 78500, label: '₹12,800 — ₹78,500' });
  });

  it('never reproduces the old hardcoded band', () => {
    expect(getPriceRange(toursRenderedOnCataloguePage)?.label).not.toBe('₹15,000 — ₹75,000');
  });

  it('tracks whatever set it is given, rather than a fixed constant', () => {
    const subset = publiclyListedRails[1].items; // International rail
    const range = getPriceRange(subset);

    expect(range?.min).toBe(54800);
    expect(range?.max).toBe(78500);
  });

  it('returns undefined rather than NaN bounds for an empty set', () => {
    expect(getPriceRange([])).toBeUndefined();
  });

  it('is not moved by a stored price that carries other text (2026-09-19 review, M6)', () => {
    // Stored rows predating the strict form rule are not rewritten, so the
    // reader must survive them. The old digit-strip read "₹42,500 per 2 pax"
    // as 4,25,002 and made it the catalogue maximum.
    const base = toursRenderedOnCataloguePage[0];
    const polluted = [
      { ...base, priceFrom: '₹20,000' },
      { ...base, priceFrom: '₹42,500 per 2 pax' },
      { ...base, priceFrom: 'On request' },
      { ...base, priceFrom: '₹30000' }, // ungrouped but unambiguous — still read
      { ...base, priceFrom: '₹ 1,20,000' }, // Indian grouping + stray space — still read
    ];

    expect(getPriceRange(polluted)).toEqual({ min: 20000, max: 120000, label: '₹20,000 — ₹1,20,000' });
  });
});
