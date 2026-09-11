import { contentAdapter } from '../adapters/fixture-content-adapter';
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
 * C1 — the flag that did nothing.
 *
 * Three tours carry `pricingUnverified: true` because the design export
 * transcribed them twice with disagreeing prices. Nothing read the flag, so
 * they rendered full "was ₹X / Save ₹Y" discount badges exactly like a
 * confirmed tour — on three of the five cards in Home's Popular Destinations
 * rail. These tests assert the flag is now enforced at the query level, so no
 * listing anywhere can quote an unconfirmed price.
 */
const WITHHELD_TOURS = ['Do Dham Yatra', 'Kashi Darshan', 'Kashmir Family Escape'];

describe('public listing gate', () => {
  it('still holds the flagged records in the fixture — hidden, never deleted', () => {
    // Deleting them would lose the `TODO(pricing-confirm)` audit trail and make
    // re-including them a data-entry job rather than a one-line flag removal.
    const flagged = allTours.filter((tour) => tour.pricingUnverified).map((tour) => tour.name);
    expect(flagged.sort()).toEqual(WITHHELD_TOURS);
  });

  it('returns no pricingUnverified record from ANY public listing query', async () => {
    const [tours, popular, rails] = await Promise.all([
      contentAdapter.getAllTours(),
      contentAdapter.getPopularDestinations(),
      contentAdapter.getPackageRails(),
    ]);

    const everythingListed = [...tours, ...popular, ...rails.flatMap((rail) => rail.items), ...(await getAllPackages())];

    expect(everythingListed.length).toBeGreaterThan(0);
    for (const pkg of everythingListed) {
      expect(pkg.pricingUnverified).not.toBe(true);
      expect(isPubliclyListable(pkg)).toBe(true);
    }
  });

  it('names none of the withheld tours in any listing', async () => {
    const listedNames = new Set(
      [
        ...(await contentAdapter.getAllTours()),
        ...(await contentAdapter.getPopularDestinations()),
        ...(await contentAdapter.getPackageRails()).flatMap((rail) => rail.items),
      ].map((pkg) => pkg.name)
    );

    for (const name of WITHHELD_TOURS) {
      expect(listedNames.has(name)).toBe(false);
    }
  });

  it('withholds a discount badge by withholding the whole card — no listed tour quotes an unconfirmed saving', async () => {
    for (const pkg of await contentAdapter.getAllTours()) {
      // Every remaining "Save ₹X" on the site belongs to a confirmed record.
      if (pkg.savingsLabel !== undefined || pkg.priceWas !== undefined) {
        expect(pkg.pricingUnverified).toBeUndefined();
      }
    }
  });

  it('404s a direct /tour-packages/[slug] URL for a withheld tour (the documented choice over a "pricing pending" page)', async () => {
    // `getPackageBySlug` returning undefined is exactly what makes the route
    // call `notFound()`.
    for (const slug of ['do-dham-yatra', 'kashi-darshan', 'kashmir-family-escape']) {
      await expect(getPackageBySlug(slug)).resolves.toBeUndefined();
    }
  });

  it('keeps the withheld slugs out of generateStaticParams()', async () => {
    const slugs = (await getAllPackages()).map((pkg) => pkg.slug);

    expect(slugs).not.toContain('do-dham-yatra');
    expect(slugs).not.toContain('kashi-darshan');
    expect(slugs).not.toContain('kashmir-family-escape');
  });

  it('still serves every confirmed tour — the gate withholds exactly 3 records and nothing else', async () => {
    const tours = await contentAdapter.getAllTours();

    expect(tours).toHaveLength(allTours.length - WITHHELD_TOURS.length);
    expect(tours).toHaveLength(19);
  });

  it('narrows the Popular rail rather than back-filling it with substitutes', async () => {
    const popular = await contentAdapter.getPopularDestinations();

    // 3 of the export's 5 popular tours are withheld. The honest result is a
    // shorter rail, not two invented replacements.
    expect(popular).toHaveLength(2);
    expect(popular.map((pkg) => pkg.name)).toEqual([
      'Spiti Valley Bike Trip',
      'Leh Ladakh Group Trip from Delhi',
    ]);
    expect(popularPackages).toHaveLength(5);
  });

  it('keeps all 4 rails, narrowing the one that held the flagged tours', async () => {
    const rails = await contentAdapter.getPackageRails();

    expect(rails).toHaveLength(4);
    expect(rails[0].title).toBe('Trending Tour Packages');
    expect(rails[0].items).toHaveLength(2);
    for (const rail of rails.slice(1)) {
      expect(rail.items).toHaveLength(5);
    }
  });

  it('re-including a tour is a one-line flag removal, not a data migration', () => {
    const withheld = allTours.find((tour) => tour.name === 'Do Dham Yatra');
    expect(withheld).toBeDefined();

    // Same object, flag cleared → immediately listable. Nothing else to edit.
    expect(isPubliclyListable({ ...withheld!, pricingUnverified: undefined })).toBe(true);
    expect(isPubliclyListable(withheld!)).toBe(false);
  });
});

describe('getDestinationOptions', () => {
  it('offers only destinations that have at least one listed journey', () => {
    const options = getDestinationOptions(toursRenderedOnCataloguePage);

    for (const option of options) {
      expect(toursRenderedOnCataloguePage.some((tour) => tour.destinationSlug === option.slug)).toBe(true);
    }
  });

  it('drops destinations whose only journeys are withheld', () => {
    const slugs = getDestinationOptions(toursRenderedOnCataloguePage).map((option) => option.slug);

    // Kedarnath/Varanasi are reachable only through withheld tours.
    expect(slugs).not.toContain('kedarnath');
    expect(slugs).not.toContain('varanasi');
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
});
