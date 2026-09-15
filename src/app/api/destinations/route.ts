import { contentAdapter } from '@/content/content-adapter';

import { apiSuccess, handleRoute } from '../_lib/json';
import { toDestinationJson } from '../_lib/serializers';

export const dynamic = 'force-dynamic';

/**
 * `GET /api/destinations` — the International Destinations rail.
 *
 * ## Scope, stated precisely, because the route name over-promises
 *
 * `ContentPort` exposes exactly one destination query —
 * `getInternationalDestinations()` — so that is what this returns: the 5
 * destinations on Home's International rail, in their authored display order.
 * It is NOT every destination in the database.
 *
 * The alternative would be adding a `getAllDestinations()` method to
 * `ContentPort` to make the route match its own name. That was rejected:
 * `ContentPort` is the contract the ERP's content-read API will eventually have
 * to satisfy (BLOCKERS.md §1b), and widening it to suit a new local endpoint
 * makes the eventual `ErpContentAdapter` harder to write, for a capability
 * nobody has asked for. The port is deliberately not altered to accommodate the
 * interim database — that property is what keeps the migration a one-file
 * change.
 *
 * Note also that the destinations table intentionally has no Malaysia row: the
 * design export named it but no tour backs it, and an option matching zero
 * journeys must not exist (BLOCKERS.md Decision C). This endpoint inherits that
 * by reading through the port rather than the table.
 *
 * `region`, `category` and `tagline` are `null` for every record today — the
 * export renders only a name over a photo for these cards, so those fields were
 * never sourced. They are emitted as explicit nulls rather than invented.
 */
export async function GET() {
  return handleRoute('GET /api/destinations', async () => {
    const destinations = await contentAdapter.getInternationalDestinations();
    return apiSuccess(destinations.map(toDestinationJson));
  });
}
