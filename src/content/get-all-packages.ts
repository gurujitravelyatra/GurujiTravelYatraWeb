import { contentAdapter } from './adapters/fixture-content-adapter';
import type { Package } from './types';

/**
 * Union of every `Package` a `PackageCard` can link to site-wide (Home's
 * Popular Destinations grid, tech spec §4.4 row 6, AND the 4 Tour Packages
 * rails, §4.4 row "Four package rails") — both render the same
 * `<PackageCard>`, and that component always links to
 * `/tour-packages/{slug}` (BLOCKERS.md Decision D).
 *
 * BLOCKERS.md Decision D says the detail route is built "using the existing
 * 20 tours' data" (the `packageRails` fixture) — but Decision D's own
 * problem framing counted "All 25 cards" (20 rail items + 5 popular items)
 * as needing a working destination. Restricting `generateStaticParams()` to
 * only the 20 rail slugs would silently 404 the 2 Popular-only packages
 * ("Spiti Valley Bike Trip", "Leh Ladakh Group Trip from Delhi") that don't
 * also appear in a rail. Serving the union is the only way every PackageCard
 * site-wide resolves — no data is invented, this only reuses the two
 * existing fixture arrays.
 *
 * Data-quality note (flagged, not a blocker): 3 names are transcribed in
 * BOTH `popular` and `RAILS` ("Do Dham Yatra", "Kashmir Family Escape",
 * "Kashi Darshan") with slightly different `sub`/`dur` wording between the
 * two export arrays, so they collide on the same `slugify()` output. On
 * collision this helper keeps the `packageRails` version — Decision D calls
 * the rails fixture "the existing 20 tours' data" for this route, so it is
 * treated as canonical for the detail page. See FRONTEND handoff notes.
 */
export async function getAllPackages(): Promise<Package[]> {
  const [popular, rails] = await Promise.all([
    contentAdapter.getPopularDestinations(),
    contentAdapter.getPackageRails(),
  ]);

  const bySlug = new Map<string, Package>();
  for (const item of popular) {
    bySlug.set(item.slug, item);
  }
  // Rails intentionally overwrite popular's version on a slug collision.
  for (const rail of rails) {
    for (const item of rail.items) {
      bySlug.set(item.slug, item);
    }
  }

  return Array.from(bySlug.values());
}

export async function getPackageBySlug(slug: string): Promise<Package | undefined> {
  const all = await getAllPackages();
  return all.find((item) => item.slug === slug);
}
