// Source: GTY Wireframe Prototype.dc.html, const TABS, line ~927
//
// Powers the Trip Finder bar's tab row (Home page hero, [EXPORT] section —
// tech spec §4.4). Not part of `ContentPort`: local, static UI copy, not
// fetched content. Each tuple is [name, hint].
//
// COPY FIDELITY RULE (BLOCKERS.md Decision H — enforced by
// `src/components/home/__tests__/TripFinderBar.test.tsx`):
// a hint may only state something the code and the tour data can actually
// back. Specifically it may NOT:
//   - promise departure dates or seat availability. `Package.seatsLabel`
//     exists on the type but NO record in `packages.fixture.ts` sets it, and
//     there is no departure-date field at all.
//   - name a place that is not in `packages.fixture.ts` (the earlier copy
//     advertised Nepal, which has never been a GTY tour record).
//   - describe a "trip builder" / multi-question wizard. The Custom Trip tab
//     has no separate flow — the bar's single "Explore Now" CTA is a static
//     `<Link href="/tour-packages">` for every tab.
// The three tabs whose theme maps onto a category that genuinely renders a
// filter chip on /tour-packages (`Spiritual`, `Family`, `Adventure` — chips
// are derived, see `get-category-chips.ts`) may point at that chip. `Group
// Tour` and `Custom Trip` have no matching category, so they make no filter
// claim.
export interface TripFinderTab {
  name: string;
  hint: string;
}

export const tripFinderTabs: TripFinderTab[] = [
  {
    name: 'Spiritual Yatra',
    hint: 'Kedarnath, Badrinath, Varanasi and Rameshwaram yatras — filter by Spiritual on Tour Packages.',
  },
  {
    name: 'Group Tour',
    hint: 'Journeys that travel as a group, like the Leh Ladakh group trip from Delhi.',
  },
  {
    name: 'Family Holiday',
    hint: 'Family-paced trips: Kashmir, Manali, Kerala and Ooty — filter by Family on Tour Packages.',
  },
  {
    name: 'Adventure',
    hint: 'Spiti Valley, Leh Ladakh and Rishikesh routes — filter by Adventure on Tour Packages.',
  },
  {
    name: 'Custom Trip',
    hint: 'Tell us what you have in mind and our team will shape the itinerary around you.',
  },
];
