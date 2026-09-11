// Source: GTY Wireframe Prototype.dc.html, const TABS, line ~927
//
// Powers the Trip Finder bar's tab row (Home page hero, [EXPORT] section —
// tech spec §4.4). Not part of `ContentPort`: local, static UI copy, not
// fetched content.
//
// COPY FIDELITY RULE (BLOCKERS.md Decision H — enforced by
// `src/components/home/__tests__/TripFinderBar.test.tsx`):
// a hint may only state something the code and the tour data can actually
// back. Specifically it may NOT:
//   - promise departure dates or seat availability. `Package.seatsLabel`
//     exists on the type but NO record in `packages.fixture.ts` sets it, and
//     there is no departure-date field at all.
//   - name a place a visitor cannot reach from this bar's CTA. The test
//     checks names against `toursRenderedOnCataloguePage` — the tours actually
//     RENDERED at `/tour-packages`, which is where the CTA lands. That set is
//     narrower than `allTours` in two ways, and the hints used to ignore both:
//       * the 2 popular-only tours (incl. "Leh Ladakh Group Trip from Delhi",
//         which an earlier Group Tour hint named) belong to no rail and so
//         appear on Home only — never on the catalogue page;
//       * tours flagged `pricingUnverified` are withheld from every public
//         listing (`src/content/public-listing.ts`), which removed Kedarnath,
//         Badrinath, Varanasi and Kashmir from the catalogue — all four were
//         named by the previous hints.
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
    hint: 'Vaishno Devi, Rameshwaram and Tirupati yatras — filter by Spiritual on Tour Packages.',
  },
  {
    name: 'Group Tour',
    hint: 'Journeys that travel as one group — browse Tour Packages and tell us your group size.',
  },
  {
    name: 'Family Holiday',
    hint: 'Family-paced trips: Manali, Kerala and Ooty — filter by Family on Tour Packages.',
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
