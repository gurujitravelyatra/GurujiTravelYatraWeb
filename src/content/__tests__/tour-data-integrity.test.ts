import { allTours, getTourBySlug, packageRails, requireTourBySlug } from '../fixtures/packages.fixture';
import { popularPackages } from '../fixtures/popular.fixture';
import { slugify } from '../slug';

/**
 * Guards the consolidation that made `packages.fixture.ts` the single source
 * of truth for tour data.
 *
 * Before it, `popular.fixture.ts` kept its own copies of 3 tours ("Do Dham
 * Yatra", "Kashmir Family Escape", "Kashi Darshan") whose price/duration/
 * category/photo-count disagreed with the rails copies. Both fed
 * `PackageCard`s linking to the same `/tour-packages/{slug}`, so Home quoted
 * one duration and the detail page quoted another for the same tour, and
 * `getAllPackages()` papered over it by arbitrarily letting rails win.
 */
describe('tour data integrity', () => {
  it('contains no duplicate slugs across all tour data', () => {
    const slugs = allTours.map((tour) => tour.slug);
    const duplicates = slugs.filter((slug, index) => slugs.indexOf(slug) !== index);

    expect(duplicates).toEqual([]);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('holds exactly one record per tour — 20 rail tours + 2 popular-only tours', () => {
    expect(allTours).toHaveLength(22);
  });

  it('never lets two tour records share a slug with conflicting field values', () => {
    // The real defect was two records, same slug, different data. Group every
    // record the site can serve by slug and assert each group is a single
    // record — field-by-field, not just by count.
    const bySlug = new Map<string, typeof allTours>();
    for (const tour of [...allTours, ...popularPackages, ...packageRails.flatMap((rail) => rail.items)]) {
      bySlug.set(tour.slug, [...(bySlug.get(tour.slug) ?? []), tour]);
    }

    for (const [slug, records] of bySlug) {
      const distinct = new Set(records.map((record) => JSON.stringify(record)));
      expect({ slug, distinctVariants: distinct.size }).toEqual({ slug, distinctVariants: 1 });
    }
  });

  it('derives every rail item from the canonical record, by identity', () => {
    for (const rail of packageRails) {
      for (const item of rail.items) {
        expect(item).toBe(getTourBySlug(item.slug));
      }
    }
  });

  it('derives every popular item from the canonical record, by identity', () => {
    expect(popularPackages).toHaveLength(5);
    for (const item of popularPackages) {
      expect(item).toBe(getTourBySlug(item.slug));
    }
  });

  it('keeps the 2 popular-only tours addressable (they belong to no rail)', () => {
    const railSlugs = new Set(packageRails.flatMap((rail) => rail.items.map((item) => item.slug)));
    const popularOnly = popularPackages.filter((item) => !railSlugs.has(item.slug));

    expect(popularOnly.map((item) => item.name)).toEqual([
      'Spiti Valley Bike Trip',
      'Leh Ladakh Group Trip from Delhi',
    ]);
    for (const item of popularOnly) {
      expect(getTourBySlug(item.slug)).toBeDefined();
    }
  });

  it('derives every slug from the display name, never hand-typed', () => {
    for (const tour of allTours) {
      expect(tour.slug).toBe(slugify(tour.name));
    }
  });

  it('flags the 3 tours whose values the export transcribed inconsistently', () => {
    // These must stay flagged until someone confirms real figures — the fix
    // deliberately did NOT guess a winner or invent a third number.
    const unverified = allTours.filter((tour) => tour.pricingUnverified).map((tour) => tour.name);

    expect(unverified.sort()).toEqual(['Do Dham Yatra', 'Kashi Darshan', 'Kashmir Family Escape']);
  });

  it('leaves every other tour unflagged', () => {
    expect(allTours.filter((tour) => tour.pricingUnverified)).toHaveLength(3);
  });

  it('requireTourBySlug throws on an unknown slug instead of returning a half-populated card', () => {
    expect(() => requireTourBySlug('no-such-tour')).toThrow(/Unknown tour slug/);
  });

  it('every tour carries the fields a PackageCard renders', () => {
    for (const tour of allTours) {
      expect(tour.name.length).toBeGreaterThan(0);
      expect(tour.durationLabel.length).toBeGreaterThan(0);
      expect(tour.priceFrom).toMatch(/^₹[\d,]+$/);
      expect(tour.photosCount).toBeGreaterThan(0);
      expect(tour.destinationSlug).toBe(slugify(tour.destinationSlug));
    }
  });
});
