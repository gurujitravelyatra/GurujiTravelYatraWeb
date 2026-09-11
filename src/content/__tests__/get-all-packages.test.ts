import { getAllPackages, getPackageBySlug } from '../get-all-packages';
import { publiclyListedPopular, publiclyListedRails, publiclyListedTours } from '../public-listing';

/**
 * `getAllPackages()` backs `generateStaticParams()` for
 * `/tour-packages/[slug]`, so a slug missing from it is a 404 on a link the
 * site itself renders. It previously merged two overlapping lists and let one
 * win on collision; it is now a pass-through over the single source of truth,
 * narrowed to the publicly-listable set (see `public-listing.test.ts` — the
 * withheld tours are meant to 404).
 */
describe('getAllPackages', () => {
  it('resolves every publicly-listable tour record', async () => {
    await expect(getAllPackages()).resolves.toEqual(publiclyListedTours);
  });

  it('returns no duplicate slugs', async () => {
    const slugs = (await getAllPackages()).map((pkg) => pkg.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('covers every slug a PackageCard links to site-wide', async () => {
    const served = new Set((await getAllPackages()).map((pkg) => pkg.slug));
    const linked = [...publiclyListedPopular, ...publiclyListedRails.flatMap((rail) => rail.items)];

    // Includes the 2 popular-only tours that belong to no rail — restricting
    // this to the 20 rail slugs would 404 them.
    expect(linked.length).toBeGreaterThan(0);
    for (const pkg of linked) {
      expect(served.has(pkg.slug)).toBe(true);
    }
  });

  it('serves one consistent record per slug — Home and the detail page can never disagree', async () => {
    const all = await getAllPackages();

    for (const pkg of publiclyListedPopular) {
      // The exact object the Home card renders is the one the detail page
      // resolves, so duration/price/category cannot drift between them.
      await expect(getPackageBySlug(pkg.slug)).resolves.toBe(pkg);
    }
    for (const pkg of publiclyListedRails.flatMap((rail) => rail.items)) {
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

  it('404s a tour whose pricing is unconfirmed instead of quoting it on a detail page', async () => {
    // "Do Dham Yatra" is one of the three records the export transcribed twice
    // with disagreeing prices. It is withheld from every listing, so its direct
    // URL must not keep serving the same unconfirmed figures (C1).
    await expect(getPackageBySlug('do-dham-yatra')).resolves.toBeUndefined();
    await expect(getPackageBySlug('kashi-darshan')).resolves.toBeUndefined();
    await expect(getPackageBySlug('kashmir-family-escape')).resolves.toBeUndefined();
  });

  it('returns undefined for an unknown slug rather than throwing', async () => {
    await expect(getPackageBySlug('not-a-real-tour')).resolves.toBeUndefined();
  });

  it('returns undefined for an empty slug', async () => {
    await expect(getPackageBySlug('')).resolves.toBeUndefined();
  });
});
