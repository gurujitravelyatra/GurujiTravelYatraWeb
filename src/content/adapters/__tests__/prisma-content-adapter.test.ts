import type { PrismaClient } from '@prisma/client';
import { PrismaContentAdapter } from '../prisma-content-adapter';
import { FixtureContentAdapter } from '../fixture-content-adapter';
import type { ContentPort } from '../../ports';

/**
 * These tests run against a MOCKED Prisma client, not a database.
 *
 * That is a deliberate limit, not an oversight, and it is recorded in
 * BLOCKERS.md item 10: Docker is not installed in this environment, so no
 * Postgres was ever started, the migration has never been applied and the seed
 * has never inserted a row. What IS verified here is everything that lives in
 * TypeScript rather than in SQL — row→domain mapping, null handling, ordering
 * arguments, delegation, and above all the public-listing gate.
 *
 * What is NOT verified: that the SQL runs, that the `where`/`orderBy` clauses
 * mean what they look like they mean, or that the schema's constraints hold.
 * Do not read a green run here as "the database works".
 */

/** A row as the adapter's `include: { destination: true }` queries return it. */
function tourRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    slug: 'spiti-valley-circuit',
    name: 'Spiti Valley Circuit',
    destinationSlug: 'spiti-valley',
    category: 'Adventure',
    durationLabel: '9 Days 8 Nights',
    subtitle: 'Shimla - Kaza - Chandratal',
    photoKey: 'Spiti Valley',
    photosCount: 14,
    priceFrom: '₹42,500',
    priceWas: '₹47,700',
    savingsLabel: '5,200',
    seatsLabel: null,
    isHot: false,
    pricingUnverified: false,
    catalogueOrder: 1,
    popularOrder: null,
    destination: { name: 'Spiti Valley' },
    ...overrides,
  };
}

function departureRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    slug: 'do-dham-yatra-kedarnath-badrinath',
    name: 'Do Dham Yatra — Kedarnath & Badrinath',
    category: 'Spiritual',
    photoKey: 'Kedarnath',
    dateRangeLabel: '12 — 18 May 2026',
    month: 'May',
    durationLabel: '6N / 7D',
    boardingPoints: 'Ahmedabad · Delhi',
    tourManagerLabel: 'Yes, GTY manager',
    priceFrom: '₹28,900',
    seatsLabel: '14 seats left',
    scriptAccent: 'Faith\nBrings Us\nTogether',
    durationUnverified: true,
    priceUnverified: true,
    sortOrder: 0,
    destination: { name: 'Kedarnath' },
    ...overrides,
  };
}

function brochureRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    tourSlug: 'spiti-valley-circuit',
    title: 'Spiti Valley Circuit',
    itinerarySummary: 'Shimla - Kaza - Chandratal',
    priceLabel: '₹42,500',
    dateRangeLabel: null,
    coverImageKey: 'Spiti Valley',
    category: 'Adventure',
    pdfUrl: null,
    status: 'PENDING_UPLOAD',
    version: 1,
    fileSizeBytes: null,
    downloadCount: 0,
    uploadedAt: null,
    ...overrides,
  };
}

interface MockDelegates {
  tour?: unknown[];
  destination?: unknown[];
  rail?: unknown[];
  groupDeparture?: unknown[];
  brochure?: unknown[];
}

function mockPrisma(data: MockDelegates) {
  const calls: Record<string, unknown> = {};
  const findMany = (key: string, rows: unknown[]) =>
    jest.fn(async (args?: unknown) => {
      calls[key] = args;
      return rows;
    });

  const client = {
    tour: { findMany: findMany('tour', data.tour ?? []) },
    destination: { findMany: findMany('destination', data.destination ?? []) },
    rail: { findMany: findMany('rail', data.rail ?? []) },
    groupDeparture: { findMany: findMany('groupDeparture', data.groupDeparture ?? []) },
    brochure: {
      findMany: findMany('brochure', data.brochure ?? []),
      findFirst: jest.fn(async (args?: unknown) => {
        calls.brochureFindFirst = args;
        return (data.brochure ?? [])[0] ?? null;
      }),
    },
  };

  return { client: client as unknown as PrismaClient, calls };
}

describe('PrismaContentAdapter — row → domain mapping', () => {
  it('maps a tour row, reading the display name through the destination relation', async () => {
    const { client } = mockPrisma({ tour: [tourRow()] });
    const [tour] = await new PrismaContentAdapter(client).getAllTours();

    expect(tour).toEqual({
      slug: 'spiti-valley-circuit',
      name: 'Spiti Valley Circuit',
      destinationSlug: 'spiti-valley',
      destinationName: 'Spiti Valley',
      category: 'Adventure',
      durationLabel: '9 Days 8 Nights',
      subtitle: 'Shimla - Kaza - Chandratal',
      photoUrl: 'Spiti Valley',
      photosCount: 14,
      priceFrom: '₹42,500',
      priceWas: '₹47,700',
      savingsLabel: '5,200',
      seatsLabel: undefined,
      isHot: undefined,
      pricingUnverified: undefined,
    });
  });

  it('emits `undefined` rather than `null` or `false` for absent optionals', async () => {
    const { client } = mockPrisma({ tour: [tourRow({ priceWas: null, savingsLabel: null })] });
    const [tour] = await new PrismaContentAdapter(client).getAllTours();

    // The domain types mark these optional and the fixtures OMIT them. A `null`
    // would make `'priceWas' in tour` true, and a component testing for presence
    // would render an empty "was ₹" strikethrough.
    expect(tour.priceWas).toBeUndefined();
    expect(tour.savingsLabel).toBeUndefined();
    expect(tour.isHot).toBeUndefined();
    expect(tour.pricingUnverified).toBeUndefined();
    expect(Object.values(tour)).not.toContain(null);
  });

  it('translates the stored "Family Trip" category back to the domain union', async () => {
    const { client } = mockPrisma({ tour: [tourRow({ category: 'FamilyTrip' })] });
    const [tour] = await new PrismaContentAdapter(client).getAllTours();
    expect(tour.category).toBe('Family Trip');
  });

  it('throws on a category the domain union does not contain, rather than defaulting', async () => {
    const { client } = mockPrisma({ tour: [tourRow({ category: 'Honeymoon' })] });
    // Honeymoon was removed deliberately (BLOCKERS.md Decision C). Silently
    // coercing it would file the tour under a wrong — or invented — filter chip.
    await expect(new PrismaContentAdapter(client).getAllTours()).rejects.toThrow(/Unknown DestinationCategory "Honeymoon"/);
  });
});

describe('PrismaContentAdapter — the public-listing gate is enforced, not merely queried', () => {
  /**
   * THE test of this change. `memory/feedback_qg_unenforced-safety-flag.md`
   * records four occurrences of a safety flag that existed as data and did
   * nothing at runtime, and porting content into a database is exactly the
   * moment a flag decays into an inert column.
   *
   * The mock deliberately IGNORES the `where` clause and returns a flagged row
   * anyway — simulating a query that drifts, a stale view, or a hand-written
   * `findMany` added later without the filter. The adapter must still withhold
   * it, because the gate is the shared `isPubliclyListable` predicate and the
   * `where` clause is only an optimisation.
   */
  it('withholds a pricingUnverified tour even when the query returns one', async () => {
    const { client } = mockPrisma({
      tour: [tourRow({ slug: 'do-dham-yatra', pricingUnverified: true }), tourRow()],
    });

    const tours = await new PrismaContentAdapter(client).getAllTours();

    expect(tours.map((tour) => tour.slug)).toEqual(['spiti-valley-circuit']);
    for (const tour of tours) {
      expect(tour.pricingUnverified).not.toBe(true);
    }
  });

  it('withholds a flagged tour from the popular selection too', async () => {
    const { client } = mockPrisma({
      tour: [tourRow({ slug: 'kashi-darshan', pricingUnverified: true, popularOrder: 0 })],
    });
    await expect(new PrismaContentAdapter(client).getPopularDestinations()).resolves.toEqual([]);
  });

  it('withholds flagged tours from rails but KEEPS the rail', async () => {
    const { client } = mockPrisma({
      rail: [
        {
          title: 'Trending Tour Packages',
          sortOrder: 0,
          items: [{ tour: tourRow({ slug: 'do-dham-yatra', pricingUnverified: true }) }, { tour: tourRow() }],
        },
      ],
    });

    const rails = await new PrismaContentAdapter(client).getPackageRails();

    // Same contract as `publiclyListedRails`: narrowing a rail must not delete
    // it, because the page's structure should not change on a temporary flag.
    expect(rails).toHaveLength(1);
    expect(rails[0].title).toBe('Trending Tour Packages');
    expect(rails[0].items.map((item) => item.slug)).toEqual(['spiti-valley-circuit']);
  });

  it('still asks the database to filter — the where clause backs up the predicate', async () => {
    const { client, calls } = mockPrisma({ tour: [] });
    await new PrismaContentAdapter(client).getAllTours();
    expect(calls.tour).toMatchObject({ where: { pricingUnverified: false }, orderBy: { catalogueOrder: 'asc' } });
  });
});

describe('PrismaContentAdapter — group departures', () => {
  it('surfaces an unverified-price departure rather than withholding it, with both markers intact', async () => {
    const { client } = mockPrisma({ groupDeparture: [departureRow()] });
    const [departure] = await new PrismaContentAdapter(client).getGroupDepartures();

    // BLOCKERS.md item 9: the user chose MARK over WITHHOLD for departures,
    // because the card carries no fabricated "was ₹X / Save ₹Y" badge and
    // withholding would empty a quarter of the page.
    expect(departure.priceFrom).toBe('₹28,900');
    expect(departure.priceUnverified).toBe(true);
    expect(departure.durationUnverified).toBe(true);
  });

  it('derives isSoldOut from seatsLabel instead of trusting a stored column', async () => {
    const { client } = mockPrisma({
      groupDeparture: [departureRow({ seatsLabel: 'Sold out' }), departureRow({ slug: 'other', seatsLabel: '08 seats left' })],
    });

    const departures = await new PrismaContentAdapter(client).getGroupDepartures();

    expect(departures[0].isSoldOut).toBe(true);
    expect(departures[1].isSoldOut).toBe(false);
  });
});

describe('PrismaContentAdapter — brochures', () => {
  it('leaves pdfUrl undefined when there is no file, substituting no default path', async () => {
    const { client } = mockPrisma({ brochure: [brochureRow()] });
    const [brochure] = await new PrismaContentAdapter(client).getBrochures();

    // A synthesised `/brochures/<slug>.pdf` would look real and 404 on click —
    // the same defect class as the "▶ Watch Full Video" button with no video
    // (memory/feedback_qg_export-verbatim-false-copy.md).
    expect(brochure.pdfUrl).toBeUndefined();
    expect(brochure.status).toBe('PENDING_UPLOAD');
    expect(brochure.fileSizeBytes).toBeUndefined();
    expect(brochure.uploadedAt).toBeUndefined();
    expect(brochure.downloadCount).toBe(0);
  });

  it('asks the database for brochures of publicly-listable tours only', async () => {
    const { client, calls } = mockPrisma({ brochure: [] });
    await new PrismaContentAdapter(client).getBrochures();
    // A brochure for a withheld tour is unreachable content quoting an
    // unconfirmed price — its tour's detail route 404s.
    expect(calls.brochure).toMatchObject({ where: { tour: { pricingUnverified: false } } });
  });

  it('carries no price for a tour whose price the catalogue withholds', async () => {
    const { client } = mockPrisma({ brochure: [brochureRow({ priceLabel: null })] });
    const [brochure] = await new PrismaContentAdapter(client).getBrochures();
    expect(brochure.priceLabel).toBeUndefined();
  });
});

describe('PrismaContentAdapter — out-of-scope content delegates to the fixtures', () => {
  /**
   * Testimonials, stats, videos, About milestones and trip places did NOT move
   * to the database. Several carry honesty markers (`isPlaceholder`) that live
   * in the fixture files, so silently re-sourcing them would strip those.
   */
  it('delegates every non-migrated method to the injected fixture adapter', async () => {
    const fixtures = new FixtureContentAdapter();
    const spies = {
      getFeaturedVideos: jest.spyOn(fixtures, 'getFeaturedVideos'),
      getStats: jest.spyOn(fixtures, 'getStats'),
      getTestimonials: jest.spyOn(fixtures, 'getTestimonials'),
      getTripPlaceOptions: jest.spyOn(fixtures, 'getTripPlaceOptions'),
      getAboutMilestones: jest.spyOn(fixtures, 'getAboutMilestones'),
    };

    const { client } = mockPrisma({});
    const adapter = new PrismaContentAdapter(client, fixtures as ContentPort);

    await Promise.all([
      adapter.getFeaturedVideos(),
      adapter.getStats(),
      adapter.getTestimonials(),
      adapter.getTripPlaceOptions(),
      adapter.getAboutMilestones(),
    ]);

    for (const spy of Object.values(spies)) {
      expect(spy).toHaveBeenCalledTimes(1);
    }
  });

  it('returns the placeholder markers untouched through the delegation', async () => {
    const { client } = mockPrisma({});
    const adapter = new PrismaContentAdapter(client);

    for (const stat of await adapter.getStats()) {
      expect(stat.isPlaceholder).toBe(true);
    }
    for (const review of await adapter.getTestimonials()) {
      expect(review.isPlaceholder).toBe(true);
      expect(review.ratingOutOf5).toBeUndefined();
    }
  });
});
