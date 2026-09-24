import { departureMonthKey, departureMonthKeys } from '@/lib/departure-dates';

import { groupDepartures } from '../fixtures/group-departures.fixture';

const departureMonths = departureMonthKeys(groupDepartures);
import { allTours } from '../fixtures/packages.fixture';

/**
 * Guards `group-departures.fixture.ts` — the `/group-tours` data source
 * (fixture-content-adapter.test.ts covers the adapter boundary; this file
 * covers the fixture's own shape and derivations).
 */
describe('groupDepartures fixture', () => {
  it('holds exactly 4 records', () => {
    expect(groupDepartures).toHaveLength(4);
  });

  it('gives every record every non-empty field', () => {
    for (const departure of groupDepartures) {
      expect(departure.slug.length).toBeGreaterThan(0);
      expect(departure.name.length).toBeGreaterThan(0);
      expect(departure.destinationName.length).toBeGreaterThan(0);
      expect(departure.category.length).toBeGreaterThan(0);
      expect(departure.photoUrl.length).toBeGreaterThan(0);
      expect(departure.dateRangeLabel.length).toBeGreaterThan(0);
      expect(departure.month.length).toBeGreaterThan(0);
      expect(departure.durationLabel.length).toBeGreaterThan(0);
      expect(departure.boardingPoints.length).toBeGreaterThan(0);
      expect(departure.tourManagerLabel.length).toBeGreaterThan(0);
      expect(departure.priceFrom.length).toBeGreaterThan(0);
      expect(departure.seatsLabel.length).toBeGreaterThan(0);
      expect(departure.scriptAccent.length).toBeGreaterThan(0);
      expect(typeof departure.isSoldOut).toBe('boolean');
    }
  });

  it('has unique slugs across all 4 records', () => {
    const slugs = groupDepartures.map((departure) => departure.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('flags isSoldOut true for exactly the "Kashi · Ayodhya · Prayagraj" record, false for the rest', () => {
    const soldOut = groupDepartures.filter((departure) => departure.isSoldOut);
    expect(soldOut.map((departure) => departure.name)).toEqual(['Kashi · Ayodhya · Prayagraj']);

    const bookable = groupDepartures.filter((departure) => !departure.isSoldOut);
    expect(bookable.map((departure) => departure.name).sort()).toEqual(
      ['Do Dham Yatra — Kedarnath & Badrinath', 'Spiti Valley Circuit', 'Chardham Special'].sort()
    );
  });

  it('sets durationUnverified on exactly the Do Dham and Spiti records', () => {
    const unverified = groupDepartures.filter((departure) => departure.durationUnverified).map((departure) => departure.name);
    expect(unverified.sort()).toEqual(['Do Dham Yatra — Kedarnath & Badrinath', 'Spiti Valley Circuit'].sort());

    const verified = groupDepartures.filter((departure) => !departure.durationUnverified);
    expect(verified.map((departure) => departure.name).sort()).toEqual(['Chardham Special', 'Kashi · Ayodhya · Prayagraj'].sort());
  });

  /**
   * BLOCKERS.md item 9. The departures fixture is a SECOND transcription of
   * tours the package catalogue also carries, so a doubt recorded about a
   * tour's price in one fixture has to be recorded in the other. It wasn't:
   * `public-listing.ts` withheld "Do Dham Yatra" from Home and `/tour-packages`
   * over its unconfirmed ₹28,900 while `/group-tours` published the same figure
   * as its card's largest number, because the gate is written against
   * `Package` and this is a `GroupDeparture`.
   *
   * This test fails if the two fixtures ever drift apart again — including in
   * the good direction, when GTY confirms the price and only one of the two
   * flags gets cleared.
   */
  it('flags priceUnverified on exactly the departures whose tour the catalogue flags pricingUnverified', () => {
    const flaggedDepartures = groupDepartures
      .filter((departure) => departure.priceUnverified)
      .map((departure) => departure.name);

    expect(flaggedDepartures).toEqual(['Do Dham Yatra — Kedarnath & Badrinath']);

    for (const departure of groupDepartures) {
      // Match on the leading tour name: the catalogue names this tour
      // "Do Dham Yatra", the departures fixture appends the two shrines.
      const catalogueTwin = allTours.find(
        (tour) => departure.name.startsWith(tour.name) || tour.name.startsWith(departure.name.split(' — ')[0])
      );
      if (!catalogueTwin) continue;

      expect({ tour: departure.name, flagged: departure.priceUnverified === true }).toEqual({
        tour: departure.name,
        flagged: catalogueTwin.pricingUnverified === true,
      });
    }
  });

  it('quotes the same price string as the catalogue record it is flagged against', () => {
    const doDham = groupDepartures.find((departure) => departure.priceUnverified)!;
    const catalogueTwin = allTours.find((tour) => tour.name === 'Do Dham Yatra')!;

    // If these ever differ, "the same unconfirmed figure" is no longer the
    // reason for the flag and item 9's rationale needs re-checking.
    expect(doDham.priceFrom).toBe(catalogueTwin.priceFrom);
    expect(catalogueTwin.pricingUnverified).toBe(true);
  });

  it('marks the flagged departure rather than withholding it — it still reaches the page', () => {
    // The opposite of `public-listing.ts`'s treatment of `Package`, and
    // deliberately so: no "was ₹X / Save ₹Y" badge exists on a departure card.
    const flagged = groupDepartures.find((departure) => departure.priceUnverified)!;

    expect(groupDepartures).toContain(flagged);
    expect(flagged.dateRangeLabel.length).toBeGreaterThan(0);
    expect(flagged.seatsLabel.length).toBeGreaterThan(0);
  });
});

describe('month chip derivation (departureMonthKeys over the fixture)', () => {
  it('is sorted in calendar order, each key carrying its own year', () => {
    expect(departureMonths).toEqual(['May 2026', 'Jun 2026', 'Oct 2026', 'Nov 2026']);
  });

  it('contains no month that has zero departures', () => {
    for (const month of departureMonths) {
      const count = groupDepartures.filter((departure) => departureMonthKey(departure) === month).length;
      expect(count).toBeGreaterThan(0);
    }
  });

  /**
   * Regression guard: the export's own literal chip list was
   * `['All','May','Jun','Oct','Nov','Dec']`, and `Dec` matches zero
   * departures. `departureMonths` must be DERIVED from the departures, not a
   * copy of that literal — this test fails if someone reintroduces the
   * hardcoded list.
   */
  it('does NOT contain Dec — the export listed it but no departure ships in December', () => {
    expect(departureMonths.some((key) => key.startsWith('Dec'))).toBe(false);
  });

  it('contains exactly the distinct months present in groupDepartures, no more and no less', () => {
    const actualMonths = new Set(groupDepartures.map((departure) => departure.month));
    expect(new Set(departureMonths.map((key) => key.split(' ')[0]))).toEqual(actualMonths);
  });
});
