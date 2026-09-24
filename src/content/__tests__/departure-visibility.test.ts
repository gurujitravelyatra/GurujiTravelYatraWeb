import { resolveDepartureTourSlug } from '../departure-tour-link';
import { groupDepartures } from '../fixtures/group-departures.fixture';
import { allTours } from '../fixtures/packages.fixture';
import {
  departureWithholdReason,
  publiclyListedDepartures,
  toPublicDeparture,
  type DepartureParent,
} from '../public-listing';

/**
 * The departure half of the public gate (2026-09-25) — the predicate itself,
 * and the fixture path that uses it. The database path is covered by
 * `prisma-content-adapter.test.ts`; the rendered page and API response by
 * `src/app/group-tours/__tests__/hidden-tour-departures.test.tsx`.
 */

const PUBLISHED: DepartureParent = { status: 'PUBLISHED', archivedAt: null, pricingUnverified: false };

describe('departureWithholdReason — composed from the tour gate', () => {
  it('withholds nothing for an UNLINKED departure', () => {
    expect(departureWithholdReason(null)).toBeNull();
  });

  it('withholds nothing when the tour is published and live', () => {
    expect(departureWithholdReason(PUBLISHED)).toBeNull();
  });

  it('withholds when the tour is a draft', () => {
    expect(departureWithholdReason({ status: 'DRAFT', archivedAt: null })).toBe('DRAFT');
  });

  it('withholds when the tour is archived — in both spellings the gate accepts', () => {
    expect(departureWithholdReason({ status: 'PUBLISHED', archivedAt: new Date() })).toBe('ARCHIVED');
    expect(departureWithholdReason({ status: 'PUBLISHED', archivedAt: '2026-09-20T00:00:00.000Z' })).toBe('ARCHIVED');
  });

  it('does NOT withhold for an unconfirmed tour price — BLOCKERS item 9 marks instead', () => {
    expect(departureWithholdReason({ status: 'PUBLISHED', archivedAt: null, pricingUnverified: true })).toBeNull();
  });

  it('a draft with an unconfirmed price is still withheld — the exemption covers the price reason only', () => {
    expect(departureWithholdReason({ status: 'DRAFT', archivedAt: null, pricingUnverified: true })).toBe('DRAFT');
  });

  it('is default-closed for a status value the gate does not know', () => {
    // A future status must not publish a departure by falling through.
    const unknown = { status: 'SCHEDULED' as unknown as 'PUBLISHED', archivedAt: null };
    expect(departureWithholdReason(unknown)).toBe('DRAFT');
  });
});

describe('toPublicDeparture', () => {
  const departure = { slug: 'x', priceUnverified: undefined as boolean | undefined };

  it('returns the departure unchanged when nothing applies', () => {
    expect(toPublicDeparture(departure, PUBLISHED)).toBe(departure);
    expect(toPublicDeparture(departure, null)).toBe(departure);
  });

  it('returns undefined for a departure of a hidden tour', () => {
    expect(toPublicDeparture(departure, { status: 'DRAFT', archivedAt: null })).toBeUndefined();
    expect(toPublicDeparture(departure, { status: 'PUBLISHED', archivedAt: new Date() })).toBeUndefined();
  });

  it('carries the tour’s price doubt onto the departure, without mutating the input', () => {
    const result = toPublicDeparture(departure, { status: 'PUBLISHED', archivedAt: null, pricingUnverified: true });
    expect(result?.priceUnverified).toBe(true);
    expect(departure.priceUnverified).toBeUndefined();
  });
});

describe('resolveDepartureTourSlug — the one link rule (seed + fixture path)', () => {
  const tours = [{ slug: 'do-dham' }, { slug: 'do-dham-yatra' }, { slug: 'spiti-valley-circuit' }];

  it('matches an exact slug', () => {
    expect(resolveDepartureTourSlug('Spiti Valley Circuit', tours)).toBe('spiti-valley-circuit');
  });

  it('matches a hyphen-bounded prefix, longest first', () => {
    expect(resolveDepartureTourSlug('Do Dham Yatra — Kedarnath & Badrinath', tours)).toBe('do-dham-yatra');
  });

  it('does not match a prefix that is not a whole slug segment', () => {
    expect(resolveDepartureTourSlug('Spiti Valley Circuitous', tours)).toBeNull();
  });

  it('refuses to guess between two equally specific matches', () => {
    expect(resolveDepartureTourSlug('Twin Trip', [{ slug: 'twin-trip' }, { slug: 'twin-trip' }])).toBeNull();
  });

  it('links exactly the two fixture departures that have a catalogue twin, and no others', () => {
    const links = Object.fromEntries(groupDepartures.map((d) => [d.slug, resolveDepartureTourSlug(d.name, allTours)]));
    expect(links).toEqual({
      'do-dham-yatra-kedarnath-badrinath': 'do-dham-yatra',
      'spiti-valley-circuit': 'spiti-valley-circuit',
      'chardham-special': null,
      'kashi-ayodhya-prayagraj': null,
    });
  });
});

describe('publiclyListedDepartures — the fixture path through the same gate', () => {
  it('lists all four fixture departures today — no over-withholding', () => {
    expect(publiclyListedDepartures.map((d) => d.slug)).toEqual(groupDepartures.map((d) => d.slug));
    expect(publiclyListedDepartures).toHaveLength(4);
  });

  it('keeps Do Dham marked (its tour is price-unconfirmed)', () => {
    const doDham = publiclyListedDepartures.find((d) => d.slug === 'do-dham-yatra-kedarnath-badrinath');
    expect(doDham?.priceUnverified).toBe(true);
  });

  /**
   * The fixture path's gate is not decorative: set the linked catalogue tour to
   * DRAFT and its departure disappears. Proven able to fail: with
   * `departureWithholdReason` made to exempt every reason, this test and 5
   * others in this file went red (measured 2026-09-25, then reverted).
   */
  it('withholds a fixture departure when its catalogue tour is made a draft', () => {
    jest.isolateModules(() => {
      jest.doMock('../fixtures/packages.fixture', () => {
        const actual = jest.requireActual('../fixtures/packages.fixture');
        return {
          ...actual,
          allTours: actual.allTours.map((tour: { slug: string }) =>
            tour.slug === 'spiti-valley-circuit' ? { ...tour, status: 'DRAFT' } : tour
          ),
        };
      });
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const isolated = require('../public-listing') as typeof import('../public-listing');
      const slugs = isolated.publiclyListedDepartures.map((d) => d.slug);
      expect(slugs).toHaveLength(3);
      expect(slugs).not.toContain('spiti-valley-circuit');
    });
  });
});
