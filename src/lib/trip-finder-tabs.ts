// Source: GTY Wireframe Prototype.dc.html, const TABS, line ~927
//
// Powers the Trip Finder bar's tab row (Home page hero). Static UI copy,
// not CRM-fetched content — relocated out of the now-deleted `src/content/`
// tree in CRM-migration Step 5 (admin-CMS/DB-layer removal) since it never
// depended on the database or fixture content layer to begin with, only on
// a type (`DestinationCategory`) that lived alongside it.
//
// COPY FIDELITY RULE (enforced by
// `src/components/home/__tests__/TripFinderBar.test.tsx`):
// a hint may only state something the code and the CRM's own tour data can
// actually back. Specifically it may NOT:
//   - promise departure dates or seat availability as something THIS BAR
//     offers — the CRM does carry real seat/date data now (`PackageCard`'s
//     "N seats left"), but this bar's own three fields are still decorative
//     (see `TripFinderBar.tsx`'s own comment) and must not claim otherwise.
//   - name a place a visitor cannot reach from this bar's CTA.
//   - describe a "trip builder" / multi-question wizard. The Custom Trip tab
//     has no separate flow — the bar's single "Explore Now" CTA is a static
//     `<Link href="/tour-packages">` for every tab.
// The three tabs whose theme maps onto a real CRM category (`Spiritual`,
// `Family`, `Adventure`) may point at that category via `?category=`.
// `Group Tour` and `Custom Trip` have no matching CRM category, so they
// make no filter claim and keep the plain `/tour-packages` link.
import type { CrmCategory } from '@/server/crm/types';

export interface TripFinderTab {
  name: string;
  hint: string;
  /**
   * The catalogue category this tab deep-links to, via
   * `/tour-packages?category=<category>`.
   *
   * OMITTED, NOT GUESSED, when the tab's theme has no matching CRM category:
   * "Group Tour" and "Custom Trip" describe how a trip is arranged, not a
   * destination category, so those tabs keep the plain `/tour-packages`
   * link rather than pointing at a category that does not exist.
   */
  category?: CrmCategory;
}

export const tripFinderTabs: TripFinderTab[] = [
  {
    name: 'Spiritual Yatra',
    hint: 'Vaishno Devi, Rameshwaram and Tirupati yatras — filter by Spiritual on Tour Packages.',
    category: 'Spiritual',
  },
  {
    name: 'Group Tour',
    hint: 'Journeys that travel as one group — browse Tour Packages and tell us your group size.',
  },
  {
    name: 'Family Holiday',
    hint: 'Family-paced trips: Manali, Kerala and Ooty — filter by Family on Tour Packages.',
    category: 'Family',
  },
  {
    name: 'Adventure',
    hint: 'Spiti Valley, Leh Ladakh and Rishikesh routes — filter by Adventure on Tour Packages.',
    category: 'Adventure',
  },
  {
    name: 'Custom Trip',
    hint: 'Tell us what you have in mind and our team will shape the itinerary around you.',
  },
];
