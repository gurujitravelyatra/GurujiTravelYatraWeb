import { getAllPackages, getPackageBySlug } from '../get-all-packages';
import { allTours, packageRails } from '../fixtures/packages.fixture';
import { popularPackages } from '../fixtures/popular.fixture';

/**
 * `getAllPackages()` backs `generateStaticParams()` for
 * `/tour-packages/[slug]`, so a slug missing from it is a 404 on a link the
 * site itself renders. It previously merged two overlapping lists and let one
 * win on collision; it is now a pass-through over the single source of truth.
 */
describe('getAllPackages', () => {
  it('resolves every canonical tour record', async () => {
    await expect(getAllPackages()).resolves.toEqual(allTours);
  });

  it('returns no duplicate slugs', async () => {
    const slugs = (await getAllPackages()).map((pkg) => pkg.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('covers every slug a PackageCard links to site-wide', async () => {
    const served = new Set((await getAllPackages()).map((pkg) => pkg.slug));
    const linked = [...popularPackages, ...packageRails.flatMap((rail) => rail.items)];

    // Includes the 2 popular-only tours that belong to no rail — restricting
    // this to the 20 rail slugs would 404 them.
    expect(linked.length).toBeGreaterThan(0);
    for (const pkg of linked) {
      expect(served.has(pkg.slug)).toBe(true);
    }
  });

  it('serves one consistent record per slug — Home and the detail page can never disagree', async () => {
    const all = await getAllPackages();

    for (const pkg of popularPackages) {
      // The exact object the Home card renders is the one the detail page
      // resolves, so duration/price/category cannot drift between them.
      await expect(getPackageBySlug(pkg.slug)).resolves.toBe(pkg);
    }
    for (const pkg of packageRails.flatMap((rail) => rail.items)) {
      expect(all).toContain(pkg);
    }
  });
});

describe('getPackageBySlug', () => {
  it('resolves a rail tour by slug', async () => {
    const pkg = await getPackageBySlug('explore-ladakh');
    expect(pkg).toEqual(expect.objectContaining({ name: 'Explore Ladakh', durationLabel: '7 Days 6 Nights' }));
  });

  it('resolves a popular-only tour by slug (no rail contains it)', async () => {
    const pkg = await getPackageBySlug('spiti-valley-bike-trip');
    expect(pkg).toEqual(expect.objectContaining({ name: 'Spiti Valley Bike Trip' }));
  });

  it('resolves the same single record for a tour that used to be defined twice', async () => {
    const pkg = await getPackageBySlug('do-dham-yatra');

    expect(pkg).toBeDefined();
    expect(pkg?.name).toBe('Do Dham Yatra');
    // Flagged, not silently resolved to one of the two conflicting guesses.
    expect(pkg?.pricingUnverified).toBe(true);
  });

  it('returns undefined for an unknown slug rather than throwing', async () => {
    await expect(getPackageBySlug('not-a-real-tour')).resolves.toBeUndefined();
  });

  it('returns undefined for an empty slug', async () => {
    await expect(getPackageBySlug('')).resolves.toBeUndefined();
  });
});
