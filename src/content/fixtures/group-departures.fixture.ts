// Source: GTY Wireframe Prototype.dc.html, const GROUPS, line ~934.
//
// Field mapping: name→name, dest→destinationName, dates→dateRangeLabel,
// month→month, board→boardingPoints, dur→durationLabel, mgr→tourManagerLabel,
// price→priceFrom, seats→seatsLabel, cat→category, script→scriptAccent.
//
// All four records are transcribed VERBATIM. Departure dates, seat counts,
// boarding points and tour-manager strings exist in no other source — not in
// the product spec, not in the package catalogue, not elsewhere in the export.
// Nothing here is derived, inferred or filled in.
//
// The export's `hot:` flag is deliberately NOT carried over: it drives no
// visual in the export's own group-tour card markup (lines 520-556), so
// importing it would create a field with no defined rendering.
//
// TODO(duration-confirm): two records carry `durationUnverified` because the
// export states a different duration for the same tour in `RAILS`
// (packages.fixture.ts) than it does here. Neither is authoritative:
//   - Do Dham Yatra ...... GROUPS "6N / 7D"  vs RAILS "6 Days 5 Nights"
//   - Spiti Valley Circuit GROUPS "9N / 10D" vs RAILS "9 Days 8 Nights"
// Greppable alongside `TODO(pricing-confirm)` and `TODO(stats-confirm)`.
// Resolve with the business's real itinerary lengths and drop the flags.
//
// TODO(pricing-confirm): "Do Dham Yatra" additionally carries `priceUnverified`
// because ITS PRICE IS THE SAME UNCONFIRMED ₹28,900 that `packages.fixture.ts`
// flags `pricingUnverified` and `public-listing.ts` withholds from Home and
// `/tour-packages`. This transcription is a second copy of the same tour, so
// the same doubt applies; the flag only failed to reach it because the listing
// gate is written against `Package`, not `GroupDeparture` (BLOCKERS.md item 9).
// Marked visibly here rather than withheld: the withholding gate exists to stop
// a fabricated "was ₹X / Save ₹Y" badge, and this card shows no such badge.
// Resolve with the business's real price and drop the flag.
import { slugify } from '../slug';
import { deriveIsSoldOut } from '../sold-out';
import type { GroupDeparture } from '../types';

interface GroupFixtureItem {
  name: string;
  dest: string;
  dates: string;
  month: string;
  board: string;
  dur: string;
  mgr: string;
  price: string;
  seats: string;
  cat: GroupDeparture['category'];
  script: string;
  durationUnverified?: boolean;
  priceUnverified?: boolean;
}

const GROUPS_FIXTURE: GroupFixtureItem[] = [
  {
    name: 'Do Dham Yatra — Kedarnath & Badrinath',
    dest: 'Kedarnath',
    dates: '12 — 18 May 2026',
    month: 'May',
    board: 'Ahmedabad · Delhi',
    dur: '6N / 7D',
    mgr: 'Yes, GTY manager',
    price: '₹28,900',
    seats: '14 seats left',
    cat: 'Spiritual',
    script: 'Faith\nBrings Us\nTogether',
    durationUnverified: true,
    priceUnverified: true,
  },
  {
    name: 'Spiti Valley Circuit',
    dest: 'Spiti Valley',
    dates: '06 — 15 Oct 2026',
    month: 'Oct',
    board: 'Delhi',
    dur: '9N / 10D',
    mgr: 'Yes, GTY manager',
    price: '₹42,500',
    seats: '08 seats left',
    cat: 'Adventure',
    script: 'Where\nThe Road\nEnds',
    durationUnverified: true,
  },
  {
    name: 'Chardham Special',
    dest: 'Uttarakhand',
    dates: '02 — 13 Jun 2026',
    month: 'Jun',
    board: 'Haridwar',
    dur: '11N / 12D',
    mgr: 'Yes, 2 managers',
    price: '₹54,000',
    seats: '22 seats left',
    cat: 'Spiritual',
    script: 'Sacred\nSteps',
  },
  {
    name: 'Kashi · Ayodhya · Prayagraj',
    dest: 'Varanasi',
    dates: '18 — 23 Nov 2026',
    month: 'Nov',
    board: 'Ahmedabad',
    dur: '5N / 6D',
    mgr: 'Yes, GTY manager',
    price: '₹21,700',
    seats: 'Sold out',
    cat: 'Spiritual',
    script: 'Along\nThe Ganga',
  },
];

function toGroupDeparture(item: GroupFixtureItem): GroupDeparture {
  return {
    slug: slugify(item.name),
    name: item.name,
    destinationName: item.dest,
    category: item.cat,
    // Opaque string key (Assumption A4), same convention as `Package.photoUrl`
    // — no real photo files exist, so this renders as a token-coloured
    // `PhotoPlaceholder`, never a fabricated URL.
    photoUrl: item.dest,
    dateRangeLabel: item.dates,
    month: item.month,
    durationLabel: item.dur,
    boardingPoints: item.board,
    tourManagerLabel: item.mgr,
    priceFrom: item.price,
    seatsLabel: item.seats,
    // Derived once here rather than re-parsed in every consumer, via the shared
    // rule in `../sold-out.ts` — `PrismaContentAdapter` is a second producer of
    // `GroupDeparture` and must derive this identically.
    isSoldOut: deriveIsSoldOut(item.seats),
    scriptAccent: item.script,
    durationUnverified: item.durationUnverified,
    priceUnverified: item.priceUnverified,
  };
}

export const groupDepartures: GroupDeparture[] = GROUPS_FIXTURE.map(toGroupDeparture);

/*
 * [MOVED 2026-09-25] The month chip list is no longer derived here. It is
 * derived from the departures /group-tours actually renders, by
 * `departureMonthKeys()` in `src/lib/departure-dates.ts`, because on the
 * database path this fixture is not the source and the public gate may withhold
 * rows. The reasoning below still applies and is kept for its history.
 *
 * Month filter options for the departures chip row (export line ~1135:
 * `['All','May','Jun','Oct','Nov','Dec']`).
 *
 * DERIVED from the departures above, not hardcoded — the export's own list
 * includes `Dec`, which matches zero departures and would render a chip that
 * empties the page. That is the same defect BLOCKERS.md Decision C removed for
 * the `Honeymoon`/`Wildlife` package chips, so it is fixed the same way here:
 * a chip exists only where real departures back it.
 *
 * Sorted into calendar order (May, Jun, Oct, Nov) rather than fixture order
 * (May, Oct, Jun, Nov) — the chip row reads as a departure calendar, so
 * listing June after October would look like a bug to a visitor.
 */
