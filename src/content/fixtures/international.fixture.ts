// Source: GTY Wireframe Prototype.dc.html, const intl (inline array), line ~1127
//
// Six international destinations, name + photo only — the export renders
// nothing else for these (no region/category/tagline in the fixture data),
// so those fields are simply omitted rather than invented (they are
// optional on `Destination`, per BLOCKERS.md §3).
import type { Destination } from '../types';
import { slugify } from '../slug';

const INTERNATIONAL_NAMES = ['Maldives', 'Singapore', 'Thailand', 'Malaysia', 'Bali', 'Dubai'] as const;

export const internationalDestinations: Destination[] = INTERNATIONAL_NAMES.map((name) => ({
  slug: slugify(name),
  name,
  photoUrl: name, // opaque string key — see Assumption A4
}));
