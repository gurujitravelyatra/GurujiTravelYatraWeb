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
    // Phase B. The factory's DEFAULT is a publishable row, so a test that cares
    // about the draft gate has to say so explicitly — which keeps the gate tests
    // legible about what they are actually varying.
    status: 'PUBLISHED',
    archivedAt: null,
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
    // UNLINKED by default, so the pre-2026-09-25 tests below keep meaning what
    // they meant. The departure-gate tests link it explicitly.
    tourSlug: null,
    tour: null,
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
      status: 'PUBLISHED',
      archivedAt: undefined,
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

describe('PrismaContentAdapter — uploaded media reaches the public surfaces (Phase C)', () => {
  const COVER = 'https://res.cloudinary.com/demo/image/upload/v1/gty/tours/spiti/cover_a1.jpg';

  it('carries an uploaded cover through to the domain object', async () => {
    /**
     * The assertion that stops `coverImageUrl` becoming an inert column. An admin
     * can upload a cover, the row can hold it, and the publish gate can require
     * it — and a visitor still sees a grey placeholder unless the adapter carries
     * it across. That is the exact shape
     * `memory/feedback_qg_unenforced-safety-flag.md` catalogues, applied to a
     * value rather than a flag.
     */
    const { client } = mockPrisma({ tour: [tourRow({ coverImageUrl: COVER })] });
    const [tour] = await new PrismaContentAdapter(client).getAllTours();

    expect(tour.coverImageUrl).toBe(COVER);
  });

  it('leaves coverImageUrl undefined — never null — for a tour with no upload', async () => {
    // `null` would make `'coverImageUrl' in tour` true, and `PhotoPlaceholder`
    // branches on truthiness; the domain types mark it optional throughout.
    const { client } = mockPrisma({ tour: [tourRow({ coverImageUrl: null })] });
    const [tour] = await new PrismaContentAdapter(client).getAllTours();

    expect(tour.coverImageUrl).toBeUndefined();
  });

  it('carries the gallery across in its stored order', async () => {
    const { client } = mockPrisma({
      tour: [
        tourRow({
          galleryImages: [{ url: `${COVER}#one` }, { url: `${COVER}#two` }, { url: `${COVER}#three` }],
        }),
      ],
    });
    const [tour] = await new PrismaContentAdapter(client).getAllTours();

    // Order is the query's `orderBy: { sortOrder: 'asc' }`; the mapper must not
    // re-sort or reverse it, since that order is the admin's own arrangement.
    expect(tour.galleryImageUrls).toEqual([`${COVER}#one`, `${COVER}#two`, `${COVER}#three`]);
  });

  describe('the "N Photos" badge', () => {
    it('reports the real gallery length when the tour has uploads', async () => {
      const { client } = mockPrisma({
        tour: [tourRow({ photosCount: 14, galleryImages: [{ url: `${COVER}#a` }, { url: `${COVER}#b` }] })],
      });
      const [tour] = await new PrismaContentAdapter(client).getAllTours();

      /**
       * 2, not the stored 14. The detail page renders this badge directly above a
       * strip of the gallery images, so a stored count that disagreed with the
       * strip would be contradicted on screen, in the same viewport.
       */
      expect(tour.photosCount).toBe(2);
    });

    it('keeps the stored figure for a tour with no uploads', async () => {
      const { client } = mockPrisma({ tour: [tourRow({ photosCount: 14, galleryImages: [] })] });
      const [tour] = await new PrismaContentAdapter(client).getAllTours();

      /**
       * 14 — the design export's inherited figure, left exactly as it was.
       *
       * It describes photography that does not exist in this project, which is a
       * genuine honesty problem, and it is deliberately NOT corrected here: it
       * predates this work, affects all 22 seeded tours equally, and zeroing the
       * catalogue's photo counts is a content decision for the business rather
       * than a side effect of shipping uploads.
       */
      expect(tour.photosCount).toBe(14);
    });

    it('keeps the stored figure when the gallery was not joined at all', async () => {
      // A future query that omits the include must degrade to the old behaviour
      // rather than reporting every tour as having zero photos.
      const { client } = mockPrisma({ tour: [tourRow({ photosCount: 14 })] });
      const [tour] = await new PrismaContentAdapter(client).getAllTours();

      expect(tour.photosCount).toBe(14);
      expect(tour.galleryImageUrls).toBeUndefined();
    });
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

  /**
   * THE Phase B test, and the same shape as the one above for the same reason.
   *
   * The mock IGNORES the `where` clause and hands back a DRAFT row anyway. That
   * simulates every way the SQL half of the gate can stop being true without
   * anybody noticing: a `findMany` added later without the filter, a query
   * refactor, a stale materialised view, a replica lagging behind an unpublish.
   * The adapter must still withhold it, because `PUBLICLY_LISTABLE_WHERE` is an
   * optimisation and `isPubliclyListable()` is the gate.
   *
   * A test that asserted only `expect(calls.tour.where.status).toBe('PUBLISHED')`
   * would pass whether or not anything acted on the result — which is exactly
   * the "test that asserts the flag is set" failure mode
   * `memory/feedback_qg_unenforced-safety-flag.md` names.
   */
  it('withholds a DRAFT tour even when the query returns one', async () => {
    const { client } = mockPrisma({
      tour: [tourRow({ slug: 'half-written-tour', status: 'DRAFT' }), tourRow()],
    });

    const tours = await new PrismaContentAdapter(client).getAllTours();

    expect(tours.map((tour) => tour.slug)).toEqual(['spiti-valley-circuit']);
    expect(tours.every((tour) => tour.status === 'PUBLISHED')).toBe(true);
  });

  it('withholds an ARCHIVED tour even when the query returns one', async () => {
    // Archived AND still marked PUBLISHED — the realistic archived row, since
    // archiving deliberately does not touch `status` (a restored tour must come
    // back to the state it was pulled from). If the gate only checked `status`,
    // this row would sail through.
    const { client } = mockPrisma({
      tour: [
        tourRow({ slug: 'retired-tour', status: 'PUBLISHED', archivedAt: new Date('2026-09-01') }),
        tourRow(),
      ],
    });

    const tours = await new PrismaContentAdapter(client).getAllTours();
    expect(tours.map((tour) => tour.slug)).toEqual(['spiti-valley-circuit']);
  });

  it('withholds drafts and archived tours from the popular selection and the rails', async () => {
    const { client } = mockPrisma({
      tour: [
        tourRow({ slug: 'draft-popular', status: 'DRAFT', popularOrder: 0 }),
        tourRow({ slug: 'archived-popular', archivedAt: new Date('2026-09-01'), popularOrder: 1 }),
      ],
      rail: [
        {
          title: 'Trending Tour Packages',
          sortOrder: 0,
          items: [
            { tour: tourRow({ slug: 'draft-in-rail', status: 'DRAFT' }) },
            { tour: tourRow({ slug: 'archived-in-rail', archivedAt: new Date('2026-09-01') }) },
            { tour: tourRow() },
          ],
        },
      ],
    });

    const adapter = new PrismaContentAdapter(client);

    await expect(adapter.getPopularDestinations()).resolves.toEqual([]);

    const rails = await adapter.getPackageRails();
    expect(rails[0].items.map((item) => item.slug)).toEqual(['spiti-valley-circuit']);
  });

  it('withholds the brochure of a draft or archived tour', async () => {
    // The brochure query gates through the tour relation. A brochure republishes
    // its tour's title, itinerary summary and price under a different URL, so a
    // gate that covered tours and not brochures would be variant 4 of the memory
    // — a sibling surface the gate silently did not reach.
    const { client, calls } = mockPrisma({ brochure: [brochureRow()] });
    await new PrismaContentAdapter(client).getBrochures();

    expect(calls.brochure).toMatchObject({
      where: { tour: { status: 'PUBLISHED', archivedAt: null, pricingUnverified: false } },
    });
  });

  it('throws on a status the domain union does not contain, rather than defaulting', async () => {
    // Defaulting to PUBLISHED would publish a row this build does not
    // understand; defaulting to DRAFT would unpublish live tours the day a new
    // enum member ships. Neither is the mapper's call to make.
    const { client } = mockPrisma({ tour: [tourRow({ status: 'SCHEDULED' })] });
    await expect(new PrismaContentAdapter(client).getAllTours()).rejects.toThrow(
      /Unknown TourStatus "SCHEDULED"/
    );
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

/**
 * THE DEPARTURE VISIBILITY GATE (2026-09-25).
 *
 * Every row below is returned by a mock that IGNORES the where clause — the
 * same technique the tour gate tests above use. So each assertion is about the
 * PREDICATE (`toPublicDeparture`), not the SQL: a departure of a hidden tour
 * that slips past the query must still be withheld.
 *
 * Proven able to fail (measured 2026-09-25, each mutation reverted after):
 *  - `toPublicDeparture` call replaced by a pass-through → 5 red (draft,
 *    archived, archived-draft, draft-with-doubtful-price, price inheritance);
 *  - the dangling-link guard deleted → 1 red (the dangling test);
 *  - `departureWithholdReason` made to exempt EVERY reason → 4 red.
 */
describe('PrismaContentAdapter — a departure of a hidden tour is withheld', () => {
  const PUBLISHED_TOUR = { status: 'PUBLISHED', archivedAt: null, pricingUnverified: false };

  function linked(slug: string, tour: Record<string, unknown> | null, overrides: Record<string, unknown> = {}) {
    return departureRow({
      slug,
      name: slug,
      tourSlug: 'spiti-valley-circuit',
      tour,
      priceUnverified: false,
      durationUnverified: false,
      ...overrides,
    });
  }

  it('lists a departure whose tour is published and live', async () => {
    const { client } = mockPrisma({ groupDeparture: [linked('live', PUBLISHED_TOUR)] });
    const departures = await new PrismaContentAdapter(client).getGroupDepartures();
    expect(departures.map((d) => d.slug)).toEqual(['live']);
  });

  it('withholds a departure whose tour is a DRAFT, even when the query returns it', async () => {
    const { client } = mockPrisma({
      groupDeparture: [linked('of-a-draft', { ...PUBLISHED_TOUR, status: 'DRAFT' }), linked('live', PUBLISHED_TOUR)],
    });
    const departures = await new PrismaContentAdapter(client).getGroupDepartures();
    // Floor: the call returned SOMETHING, so an empty result cannot pass this.
    expect(departures.map((d) => d.slug)).toEqual(['live']);
  });

  it('withholds a departure whose tour is ARCHIVED, even when the query returns it', async () => {
    const { client } = mockPrisma({
      groupDeparture: [
        linked('of-an-archived-tour', { ...PUBLISHED_TOUR, archivedAt: new Date('2026-09-20T00:00:00Z') }),
        linked('live', PUBLISHED_TOUR),
      ],
    });
    const departures = await new PrismaContentAdapter(client).getGroupDepartures();
    expect(departures.map((d) => d.slug)).toEqual(['live']);
  });

  it('withholds a departure of an archived DRAFT', async () => {
    const { client } = mockPrisma({
      groupDeparture: [linked('x', { status: 'DRAFT', archivedAt: new Date(), pricingUnverified: false }), linked('live', PUBLISHED_TOUR)],
    });
    const departures = await new PrismaContentAdapter(client).getGroupDepartures();
    expect(departures.map((d) => d.slug)).toEqual(['live']);
  });

  it('does NOT over-withhold: an UNLINKED departure (tourSlug NULL) stays listed', async () => {
    const { client } = mockPrisma({
      groupDeparture: [departureRow({ slug: 'unlinked', tourSlug: null, tour: null })],
    });
    const departures = await new PrismaContentAdapter(client).getGroupDepartures();
    expect(departures.map((d) => d.slug)).toEqual(['unlinked']);
  });

  it('withholds a departure whose link names a tour that is not there (closed direction)', async () => {
    const { client } = mockPrisma({
      groupDeparture: [linked('dangling', null), linked('live', PUBLISHED_TOUR)],
    });
    const departures = await new PrismaContentAdapter(client).getGroupDepartures();
    expect(departures.map((d) => d.slug)).toEqual(['live']);
  });

  it('does NOT withhold a departure of a price-unconfirmed tour — it MARKS it (BLOCKERS item 9)', async () => {
    const { client } = mockPrisma({
      groupDeparture: [linked('doubtful-price', { ...PUBLISHED_TOUR, pricingUnverified: true }, { priceUnverified: false })],
    });
    const [departure] = await new PrismaContentAdapter(client).getGroupDepartures();
    expect(departure.slug).toBe('doubtful-price');
    // The departure's own column said false; the parent's doubt is carried across at read time.
    expect(departure.priceUnverified).toBe(true);
  });

  it('a price-unconfirmed DRAFT tour still withholds its departure — draft wins over marking', async () => {
    const { client } = mockPrisma({
      groupDeparture: [linked('x', { status: 'DRAFT', archivedAt: null, pricingUnverified: true }), linked('live', PUBLISHED_TOUR)],
    });
    const departures = await new PrismaContentAdapter(client).getGroupDepartures();
    expect(departures.map((d) => d.slug)).toEqual(['live']);
  });

  it('throws on a parent status the domain union does not contain, rather than defaulting', async () => {
    const { client } = mockPrisma({ groupDeparture: [linked('x', { ...PUBLISHED_TOUR, status: 'SCHEDULED' })] });
    await expect(new PrismaContentAdapter(client).getGroupDepartures()).rejects.toThrow(/Unknown TourStatus/);
  });

  it('still asks the database to filter by the parent tour — the where clause backs up the predicate', async () => {
    const { client, calls } = mockPrisma({ groupDeparture: [] });
    await new PrismaContentAdapter(client).getGroupDepartures();
    expect(calls.groupDeparture).toMatchObject({
      where: { OR: [{ tourSlug: null }, { tour: { status: 'PUBLISHED', archivedAt: null } }] },
      include: { tour: { select: { status: true, archivedAt: true, pricingUnverified: true } } },
    });
    // The price flag must NOT be in the SQL — that would withhold what item 9 says to mark.
    expect(JSON.stringify(calls.groupDeparture)).not.toContain('"pricingUnverified":false');
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
