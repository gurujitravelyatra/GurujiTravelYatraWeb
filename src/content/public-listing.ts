import type { Package, PackageRail } from './types';
import { allTours, packageRails } from './fixtures/packages.fixture';
import { popularPackages } from './fixtures/popular.fixture';

/**
 * PUBLIC LISTING GATE.
 *
 * `Package.pricingUnverified` used to be documentation only: three tours
 * ("Do Dham Yatra", "Kashmir Family Escape", "Kashi Darshan") carried the flag
 * and nothing read it, so they rendered full "was ₹X / Save ₹Y" discount
 * badges on Home's Popular Destinations rail and in the Tour Packages
 * catalogue exactly like a confirmed tour. Quoting an unconfirmed price with a
 * fabricated saving is the most expensive kind of dishonest copy on the site.
 *
 * The flag is now ENFORCED here, at the content-query level, so there is one
 * place to reason about it rather than a per-component `if`:
 *
 *  - flagged records stay in `packages.fixture.ts` untouched, keeping the
 *    `TODO(pricing-confirm)` audit trail intact;
 *  - no public listing query returns them, so no card, rail, chip count or
 *    catalogue row can show their pricing;
 *  - `/tour-packages/[slug]` resolves off the same public set, so a flagged
 *    tour's direct URL 404s via `notFound()` rather than rendering a detail
 *    page with the same unconfirmed discount. 404 is the deliberate choice
 *    over a "pricing pending" detail page: the tours are unreachable from
 *    anywhere in the UI, so a bespoke half-page state would be dead code that
 *    still quotes an unconfirmed figure.
 *
 * Re-including a tour once its pricing is confirmed is a one-line fixture
 * edit: delete `pricingUnverified: true`. Nothing here needs to change.
 */
export function isPubliclyListable(pkg: Package): boolean {
  return pkg.pricingUnverified !== true;
}

/** Every tour the site may show publicly, each exactly once. */
export const publiclyListedTours: Package[] = allTours.filter(isPubliclyListable);

/** Home's "Popular Destinations" selection, minus anything not publicly listable. */
export const publiclyListedPopular: Package[] = popularPackages.filter(isPubliclyListable);

/**
 * The 4 Tour Packages rails, each narrowed to publicly-listable items. Rails
 * are kept even when narrowing empties them — `PackageRail` already renders a
 * defensive empty state, and dropping a whole rail would change the page's
 * structure based on a temporary data flag. (Today none empty: the 3 flagged
 * tours all sit in "Trending Tour Packages", which keeps 2 items.)
 */
export const publiclyListedRails: PackageRail[] = packageRails.map((rail) => ({
  ...rail,
  items: rail.items.filter(isPubliclyListable),
}));

/**
 * Tours that are rendered at `/tour-packages` specifically — i.e. the rails,
 * NOT the 2 popular-only tours (which belong to no rail and therefore appear
 * on Home only). Copy that points a visitor at the catalogue may only name
 * tours in THIS set; `tabs.fixture.ts`'s COPY FIDELITY RULE is tested against
 * it.
 */
export const toursRenderedOnCataloguePage: Package[] = publiclyListedRails.flatMap((rail) => rail.items);

export interface DestinationOption {
  slug: string;
  name: string;
}

/**
 * The destinations a visitor can actually filter to, DERIVED from the tours
 * passed in — same principle as `getCategoryChips`: an option that matches
 * zero journeys must not exist. (This is why the Malaysia card had to go:
 * `international.fixture.ts` named it, no tour backs it.)
 *
 * Sorted by name so the select order is stable and predictable rather than
 * rail-authoring order.
 */
export function getDestinationOptions(tours: Package[]): DestinationOption[] {
  const bySlug = new Map<string, DestinationOption>();
  for (const tour of tours) {
    if (!bySlug.has(tour.destinationSlug)) {
      bySlug.set(tour.destinationSlug, { slug: tour.destinationSlug, name: tour.destinationName });
    }
  }
  return Array.from(bySlug.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/** Parsed `₹42,500` → `42500`. Returns `undefined` for anything that is not a plain ₹ amount. */
function parseRupees(price: string): number | undefined {
  const digits = price.replace(/[^\d]/g, '');
  return digits.length > 0 ? Number(digits) : undefined;
}

export interface PriceRange {
  min: number;
  max: number;
  label: string; // e.g. "₹12,800 — ₹78,500"
}

/**
 * The real price bounds of a set of tours, formatted for display.
 *
 * The Tour Packages filter bar used to hard-code "₹15,000 — ₹75,000", which
 * matched no actual bound in the data (the true range is ₹12,800 — ₹78,500) and
 * silently excluded the cheapest and the most expensive journeys on the site.
 * Computing it means it can never drift from the catalogue again.
 */
export function getPriceRange(tours: Package[]): PriceRange | undefined {
  const amounts = tours
    .map((tour) => parseRupees(tour.priceFrom))
    .filter((amount): amount is number => amount !== undefined);

  if (amounts.length === 0) return undefined;

  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  return { min, max, label: `₹${min.toLocaleString('en-IN')} — ₹${max.toLocaleString('en-IN')}` };
}
