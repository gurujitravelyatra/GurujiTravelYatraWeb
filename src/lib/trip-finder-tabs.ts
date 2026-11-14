// Source: GTY Wireframe Prototype.dc.html, const TABS, line ~927
//
// Powers the Trip Finder bar's tab row (Home page hero). Static UI copy,
// not CRM-fetched content.
//
// Brief §B (2026-11-14): "Explore Now" used to be a single static
// `/tour-packages` link per tab (see this file's own git history) — it now
// POSTs `{ tab: key, destination, month, travellers }` to
// `/api/trip-finder` and navigates to whatever real URL comes back (see
// `resolveTripFinder`). The hints below describe that real behaviour, not
// the old static-link one, per this file's long-standing COPY FIDELITY
// RULE (enforced by `src/components/home/__tests__/TripFinderBar.test.tsx`):
// a hint may only state something the resolver can actually back.
export type { TripFinderTabKey } from '@/server/trip-finder/resolve';
import type { TripFinderTabKey } from '@/server/trip-finder/resolve';

export interface TripFinderTab {
  name: string;
  hint: string;
  /** The `POST /api/trip-finder` tab key this chip resolves against — see `resolveTripFinder`. */
  key: TripFinderTabKey;
}

export const tripFinderTabs: TripFinderTab[] = [
  {
    name: 'Spiritual Yatra',
    hint: "Tell us where, and we'll find matching Spiritual yatras — or help you plan one.",
    key: 'spiritual',
  },
  {
    name: 'Group Tour',
    hint: "We'll check our upcoming group departures for your destination and travel month.",
    key: 'group',
  },
  {
    name: 'Family Holiday',
    hint: "Tell us where, and we'll find matching family-paced trips — or help you plan one.",
    key: 'family',
  },
  {
    name: 'Adventure',
    hint: "Tell us where, and we'll find matching adventure routes — or help you plan one.",
    key: 'adventure',
  },
  {
    name: 'Custom Trip',
    hint: 'Tell us what you have in mind and our team will shape the itinerary around you.',
    key: 'custom',
  },
];
