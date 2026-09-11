import { contentAdapter } from './adapters/fixture-content-adapter';
import type { Package } from './types';

/**
 * Every `Package` a `PackageCard` can link to site-wide — Home's Popular
 * Destinations grid (tech spec §4.4 row 6) and the 4 Tour Packages rails
 * (§4.4 row "Four package rails"). Both render the same `<PackageCard>`, and
 * that component always links to `/tour-packages/{slug}` (BLOCKERS.md
 * Decision D), so every one of those slugs must resolve.
 *
 * BLOCKERS.md Decision D says the detail route is built "using the existing
 * 20 tours' data" — but its own problem framing counted "All 25 cards" as
 * needing a working destination. The 2 tours the export lists only under
 * `popular` ("Spiti Valley Bike Trip", "Leh Ladakh Group Trip from Delhi")
 * would silently 404 if the route covered just the 20 rail slugs, so they are
 * canonical records in `packages.fixture.ts` too. That fixture is the single
 * source of truth for all 22, which is what `getAllTours()` returns.
 *
 * This helper used to merge `getPopularDestinations()` with
 * `getPackageRails()` and let the rails version win on a slug collision —
 * three tours were defined twice, with conflicting price/duration/category
 * values, so the detail page silently contradicted the Home card for those
 * three. There is now exactly one record per tour and nothing to arbitrate.
 */
export async function getAllPackages(): Promise<Package[]> {
  return contentAdapter.getAllTours();
}

export async function getPackageBySlug(slug: string): Promise<Package | undefined> {
  const all = await getAllPackages();
  return all.find((item) => item.slug === slug);
}
