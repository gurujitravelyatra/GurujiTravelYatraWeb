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

  it('resolves a tour whose pricing was previously unconfirmed (CRM-migration decision 1)', async () => {
    // "Do Dham Yatra" is one of three records the design export transcribed
    // twice with disagreeing prices. The website no longer withholds a tour
    // for an unconfirmed price — the CRM's own isLiveOnWebsite publish gate
    // is trusted fully instead — so these resolve like any other tour.
    await expect(getPackageBySlug('do-dham-yatra')).resolves.toEqual(expect.objectContaining({ name: 'Do Dham Yatra' }));
    await expect(getPackageBySlug('kashi-darshan')).resolves.toEqual(expect.objectContaining({ name: 'Kashi Darshan' }));
    await expect(getPackageBySlug('kashmir-family-escape')).resolves.toEqual(
      expect.objectContaining({ name: 'Kashmir Family Escape' })
    );
  });

  it('returns undefined for an unknown slug rather than throwing', async () => {
    await expect(getPackageBySlug('not-a-real-tour')).resolves.toBeUndefined();
  });

  it('returns undefined for an empty slug', async () => {
    await expect(getPackageBySlug('')).resolves.toBeUndefined();
  });
});
