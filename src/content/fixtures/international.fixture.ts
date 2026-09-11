// Source: GTY Wireframe Prototype.dc.html, const intl (inline array), line ~1127
//
// Name + photo only — the export renders nothing else for these (no
// region/category/tagline in the fixture data), so those fields are simply
// omitted rather than invented (they are optional on `Destination`, per
// BLOCKERS.md §3).
//
// MALAYSIA REMOVED. The export lists six names; only five of them have a tour.
// `packages.fixture.ts` has no Malaysia record, so the Malaysia card led to a
// catalogue with zero matching journeys — the same "don't feature what you
// can't back with real data" rule that already removed the Honeymoon and
// Wildlife filter chips (BLOCKERS.md Decision C). Restore it here the moment a
// real Malaysia tour exists; the "international destinations" suite in
// `src/content/__tests__/public-listing.test.ts` fails if a name here has no
// matching publicly-listable tour, so this cannot drift.
import type { Destination } from '../types';
import { slugify } from '../slug';

const INTERNATIONAL_NAMES = ['Maldives', 'Singapore', 'Thailand', 'Bali', 'Dubai'] as const;

export const internationalDestinations: Destination[] = INTERNATIONAL_NAMES.map((name) => ({
  slug: slugify(name),
  name,
  photoUrl: name, // opaque string key — see Assumption A4
}));
