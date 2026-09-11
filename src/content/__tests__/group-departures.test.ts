import { departureMonths, groupDepartures } from '../fixtures/group-departures.fixture';

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
});

describe('departureMonths derivation', () => {
  it('is sorted in calendar order: May, Jun, Oct, Nov', () => {
    expect(departureMonths).toEqual(['May', 'Jun', 'Oct', 'Nov']);
  });

  it('contains no month that has zero departures', () => {
    for (const month of departureMonths) {
      const count = groupDepartures.filter((departure) => departure.month === month).length;
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
    expect(departureMonths).not.toContain('Dec');
  });

  it('contains exactly the distinct months present in groupDepartures, no more and no less', () => {
    const actualMonths = new Set(groupDepartures.map((departure) => departure.month));
    expect(new Set(departureMonths)).toEqual(actualMonths);
  });
});
