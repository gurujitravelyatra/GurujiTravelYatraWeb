// Source: GTY Wireframe Prototype.dc.html, const PLACES, line ~940.
//
// All twelve entries transcribed verbatim. The export stores exactly two
// fields per place — `name` and `region` — and renders exactly those two plus
// a photo (lines 597-603, and the route rows at 621-627). No description,
// price, duration, "best season" or rating exists for a place anywhere in the
// export or the product spec, so none is invented here.
//
// The export builds its own place photos from a rotating `pool` of unrelated
// stock keys (`photoFor`, line ~1068) — i.e. the prototype does NOT have a
// real photo per place. `photoUrl` therefore carries the place name as an
// opaque key (Assumption A4), same convention as `Package.photoUrl`, and
// renders as a token-coloured `PhotoPlaceholder`.
import { slugify } from '../slug';
import type { TripPlaceOption } from '../types';

const PLACES_FIXTURE: Array<{ name: string; region: string }> = [
  { name: 'Kedarnath', region: 'Uttarakhand' },
  { name: 'Badrinath', region: 'Uttarakhand' },
  { name: 'Rishikesh', region: 'Uttarakhand' },
  { name: 'Spiti Valley', region: 'Himachal Pradesh' },
  { name: 'Manali', region: 'Himachal Pradesh' },
  { name: 'Varanasi', region: 'Uttar Pradesh' },
  { name: 'Ayodhya', region: 'Uttar Pradesh' },
  { name: 'Rameshwaram', region: 'Tamil Nadu' },
  { name: 'Dwarka', region: 'Gujarat' },
  { name: 'Srinagar', region: 'Jammu & Kashmir' },
  { name: 'Leh', region: 'Ladakh' },
  { name: 'Kathmandu', region: 'Nepal' },
];

export const tripPlaceOptions: TripPlaceOption[] = PLACES_FIXTURE.map((place) => ({
  slug: slugify(place.name),
  name: place.name,
  region: place.region,
  photoUrl: place.name,
}));

/**
 * Travel-style options for the trip builder's step 3 — export line ~1158
 * (`['Budget','Comfort','Premium','Luxury']`), default `Comfort` (line ~1026).
 *
 * These are labels only. The export ALSO derives an estimated per-person cost
 * from them (`tripCost`, line ~1157: nights × 3200 / 5400 / 8600). Those
 * per-night rates appear in NO spec, price list or fixture — they are
 * prototype filler — so the quote they produce is a fabricated price and is
 * deliberately not reproduced. See `TripSummary` for what renders instead.
 */
export const travelStyles = ['Budget', 'Comfort', 'Premium', 'Luxury'] as const;

export type TravelStyle = (typeof travelStyles)[number];

export const defaultTravelStyle: TravelStyle = 'Comfort';
