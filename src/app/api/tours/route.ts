import type { NextRequest } from 'next/server';

import { contentAdapter } from '@/content/content-adapter';
import type { Package } from '@/content/types';

import { apiFailure, apiSuccess, firstValue, handleRoute } from '../_lib/json';
import { toTourJson } from '../_lib/serializers';

/**
 * `GET /api/tours` — the publicly listable tour catalogue.
 *
 * A THIN WRAPPER over `ContentPort`, containing no database access of its own.
 * It calls the same `contentAdapter.getAllTours()` the Server Components call,
 * which is what makes the `pricingUnverified` withholding gate apply here
 * automatically: the gate lives in the adapter
 * (`src/content/public-listing.ts#isPubliclyListable`), so a new consumer cannot
 * bypass it by forgetting to re-filter. Writing a `prisma.tour.findMany()` here
 * would have reintroduced exactly the variant-4 defect in
 * `memory/feedback_qg_unenforced-safety-flag.md` — a gate written against one
 * surface that silently does not cover a later-built sibling surface.
 *
 * ## Why `force-dynamic`
 *
 * Without it, a GET route handler with no request-specific input is a candidate
 * for evaluation at BUILD time — which would put this route into the pool of
 * things `next build` executes across its ~11 worker processes, each holding its
 * own Prisma client. That is the exact shape of the ~275-connection burst that
 * made the first build against the deployed database fail with `P1001`
 * (see the connection-limit note in `src/content/content-adapter.ts`). These
 * responses are cheap, indexed reads; serving them per-request costs far less
 * than prerendering them costs at build time.
 */
export const dynamic = 'force-dynamic';

/**
 * Filters mirror `/tour-packages` — SAME param names (`category`, `destination`)
 * and the same derived valid-value sets, so a link can carry its query string
 * from the page to the API unchanged.
 *
 * ONE DELIBERATE DIFFERENCE, and it is a difference in response, not in
 * vocabulary: the page falls back to "All" for an unrecognised value, because
 * its documented goal is to avoid "rendering an empty catalogue that looks
 * broken" to a human visitor. That reasoning does not transfer to a machine
 * consumer — silently returning all 22 tours to a caller who asked for
 * `?category=Honeymoon` is a wrong answer dressed as a right one. So an
 * unrecognised value is a 400 naming the values that do exist.
 *
 * Both valid-value sets are DERIVED from the returned tours rather than
 * hardcoded, exactly as `getCategoryChips`/`getDestinationOptions` derive them
 * (BLOCKERS.md Decision C): a filter value that matches zero journeys must not
 * be advertised as valid, and this stays correct by itself when the ERP adapter
 * replaces the database.
 */
function validValues(tours: Package[], key: 'category' | 'destinationSlug'): string[] {
  return Array.from(new Set(tours.map((tour) => tour[key]))).sort();
}

export async function GET(request: NextRequest) {
  return handleRoute('GET /api/tours', async () => {
    const tours = await contentAdapter.getAllTours();
    const params = request.nextUrl.searchParams;

    const category = firstValue(params, 'category');
    const destination = firstValue(params, 'destination');

    let filtered = tours;

    if (category !== undefined) {
      const categories = validValues(tours, 'category');
      if (!categories.includes(category)) {
        return apiFailure(400, `Unknown category '${category}'.`, { category: categories });
      }
      filtered = filtered.filter((tour) => tour.category === category);
    }

    if (destination !== undefined) {
      const destinations = validValues(tours, 'destinationSlug');
      if (!destinations.includes(destination)) {
        return apiFailure(400, `Unknown destination '${destination}'.`, { destination: destinations });
      }
      filtered = filtered.filter((tour) => tour.destinationSlug === destination);
    }

    return apiSuccess(filtered.map(toTourJson));
  });
}
