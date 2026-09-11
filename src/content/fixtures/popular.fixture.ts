// Source: GTY Wireframe Prototype.dc.html, const popular (inline array), line ~1112
//
// This is the real source for `ContentPort.getPopularDestinations()` — NOT
// `DESTS` (tech spec §4.4 cites `DESTS`, corrected per BLOCKERS.md §3). The
// export's own composition for these 5 cards is the `PackageCard` visual
// (price/duration/savings/heart), so this resolves to `Package[]`, not
// `Destination[]`, matching the `ContentPort` signature.
//
// SELECTION ONLY — this file owns NO tour data. It previously kept its own
// copies of 5 tours, 3 of which duplicated `packages.fixture.ts` records with
// conflicting price/duration/category values; `getAllPackages()` then had to
// arbitrarily pick a winner on slug collision. Now it declares only WHICH
// tours Home features and in WHAT ORDER, and resolves each one from the
// single source of truth. Adding a tour here that does not exist in
// `packages.fixture.ts` throws at import time rather than rendering a
// half-populated card.
import type { Package } from '../types';
import { requireTourBySlug } from './packages.fixture';
import { slugify } from '../slug';

/**
 * Home's "Popular Destinations" grid, in the export's own order. Listed by
 * display NAME, not by slug, so these can never drift from the canonical
 * record's slug — both sides run through the same `slugify()`.
 */
const POPULAR_TOUR_NAMES: string[] = [
  'Spiti Valley Bike Trip',
  'Leh Ladakh Group Trip from Delhi',
  'Do Dham Yatra',
  'Kashmir Family Escape',
  'Kashi Darshan',
];

export const popularPackages: Package[] = POPULAR_TOUR_NAMES.map((name) => requireTourBySlug(slugify(name)));
