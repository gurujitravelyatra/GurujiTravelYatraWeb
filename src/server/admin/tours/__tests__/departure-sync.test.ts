/**
 * @jest-environment node
 */

/**
 * BATCH DEPARTURES, written through the tour save (2026-09-25).
 *
 * Prisma is mocked: these assertions are about WHICH statements the save issues,
 * with which data, in which order. `tour-repository.integration.test.ts` runs the
 * same paths against real SQL.
 *
 * The properties that matter most, each pinned below:
 *
 *  1. An existing batch is UPDATED with form-owned columns ONLY — the safety
 *     flags, `sortOrder`, `photoKey` and friends are never in the write, so an
 *     unrelated save cannot clear "pending confirmation" on a seeded departure.
 *  2. Nothing touches a batch before the M7 version claim, and a conflict writes
 *     no batch at all.
 *  3. A batch slug that is not already this tour's is refused, and the whole
 *     save rolls back — no editing another tour's departure by hand-built POST.
 *  4. The public text is DERIVED from the facts: dates → "12 — 18 May 2026" and
 *     a month key; 0 seats → exactly "Sold out".
 */

const mockGetOptionalPrismaClient = jest.fn();

jest.mock('@/server/db/prisma', () => ({
  getOptionalPrismaClient: () => mockGetOptionalPrismaClient(),
}));

import { createTour, ForeignDepartureError, getAdminTourBySlug, updateTour } from '../tour-repository';
import type { DepartureBatchValue, ParsedTourFormValues } from '../tour-form-schema';

const LOADED_AT = new Date('2026-09-25T10:00:00.000Z');

function batch(overrides: Partial<DepartureBatchValue> = {}): DepartureBatchValue {
  return {
    name: 'Spiti Valley Circuit',
    startDate: '2026-10-06',
    endDate: '2026-10-15',
    seatsAvailable: '8',
    priceFrom: '₹42,500',
    durationLabel: '9N / 10D',
    boardingPoints: 'Delhi',
    tourManagerLabel: 'Yes, GTY manager',
    ...overrides,
  };
}

function values(overrides: Partial<ParsedTourFormValues> = {}): ParsedTourFormValues {
  return {
    name: 'Spiti Valley Circuit',
    slug: 'spiti-valley-circuit',
    destinationSlug: 'spiti-valley',
    category: 'Adventure',
    audienceTags: ['Group Tour'],
    durationLabel: '9 Days 8 Nights',
    subtitle: 'Shimla - Kaza - Chandratal',
    shortDescription: 'x',
    fullDescription: undefined,
    bestTimeToVisit: undefined,
    priceFrom: '₹42,500',
    priceWas: undefined,
    savingsLabel: undefined,
    seatsLabel: undefined,
    isHot: false,
    inclusions: [],
    exclusions: [],
    itineraryDays: [],
    faqs: [],
    pricingTiers: [],
    coverImage: undefined,
    galleryImages: [],
    brochureFile: undefined,
    departures: [],
    ...overrides,
  };
}

type Mocked = Record<string, jest.Mock>;
let tx: {
  tour: Mocked;
  brochure: Mocked;
  tourItineraryDay: Mocked;
  tourFaq: Mocked;
  tourPricingTier: Mocked;
  tourGalleryImage: Mocked;
  groupDeparture: Mocked;
};

/** `stored` = the slugs this tour's departures currently have. */
function setUpPrisma({ stored = [] as string[], savedSlug = 'spiti-valley-circuit' } = {}) {
  const tourRow = { slug: savedSlug, destinationSlug: 'spiti-valley', category: 'Adventure', photoKey: 'spiti-valley' };
  tx = {
    tour: {
      create: jest.fn().mockResolvedValue(tourRow),
      update: jest.fn().mockResolvedValue(tourRow),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findFirst: jest.fn().mockResolvedValue({ catalogueOrder: 21 }),
      findUnique: jest.fn(),
    },
    brochure: {
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
      create: jest.fn(),
    },
    tourItineraryDay: { deleteMany: jest.fn().mockResolvedValue({}) },
    tourFaq: { deleteMany: jest.fn().mockResolvedValue({}) },
    tourPricingTier: { deleteMany: jest.fn().mockResolvedValue({}) },
    tourGalleryImage: { deleteMany: jest.fn().mockResolvedValue({}) },
    groupDeparture: {
      findMany: jest.fn().mockResolvedValue(stored.map((slug) => ({ slug }))),
      findFirst: jest.fn().mockResolvedValue({ sortOrder: 3 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      update: jest.fn().mockResolvedValue({}),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
  mockGetOptionalPrismaClient.mockReturnValue({
    ...tx,
    $transaction: (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  setUpPrisma();
});

/** Exactly the columns the form owns — anything else in an update is a bug. */
const FORM_OWNED_COLUMNS = [
  'boardingPoints',
  'dateRangeLabel',
  'durationLabel',
  'month',
  'name',
  'priceFrom',
  'seatsLabel',
  'tourManagerLabel',
];

describe('an existing batch is updated in place, form-owned columns only', () => {
  it('writes the derived labels and NOTHING the form does not own', async () => {
    setUpPrisma({ stored: ['spiti-valley-circuit'] });
    await updateTour(
      'spiti-valley-circuit',
      values({ departures: [batch({ slug: 'spiti-valley-circuit' })] }),
      'publish',
      LOADED_AT
    );

    expect(tx.groupDeparture.update).toHaveBeenCalledTimes(1);
    const [[call]] = tx.groupDeparture.update.mock.calls;
    expect(call.where).toEqual({ slug: 'spiti-valley-circuit' });
    expect(Object.keys(call.data).sort()).toEqual(FORM_OWNED_COLUMNS);
    // The safety flags in particular — this is the property the whole design exists for.
    for (const forbidden of ['durationUnverified', 'priceUnverified', 'sortOrder', 'photoKey', 'scriptAccent', 'tourSlug', 'slug']) {
      expect(call.data).not.toHaveProperty(forbidden);
    }
    expect(call.data).toMatchObject({
      dateRangeLabel: '06 — 15 Oct 2026',
      month: 'Oct',
      seatsLabel: '08 seats left',
    });
    // Nothing deleted or created for an unchanged set.
    expect(tx.groupDeparture.deleteMany).not.toHaveBeenCalled();
    expect(tx.groupDeparture.createMany).not.toHaveBeenCalled();
  });

  it('writes 0 seats as exactly "Sold out"', async () => {
    setUpPrisma({ stored: ['b1'] });
    await updateTour('spiti-valley-circuit', values({ departures: [batch({ slug: 'b1', seatsAvailable: '0' })] }), 'draft', LOADED_AT);
    expect(tx.groupDeparture.update.mock.calls[0][0].data.seatsLabel).toBe('Sold out');
  });
});

describe('removing and adding batches', () => {
  it('deletes a stored batch that was not submitted — scoped to this tour', async () => {
    setUpPrisma({ stored: ['keep', 'drop'] });
    await updateTour('spiti-valley-circuit', values({ departures: [batch({ slug: 'keep' })] }), 'draft', LOADED_AT);

    expect(tx.groupDeparture.deleteMany).toHaveBeenCalledWith({
      where: { tourSlug: 'spiti-valley-circuit', slug: { in: ['drop'] } },
    });
    expect(tx.groupDeparture.update).toHaveBeenCalledTimes(1);
  });

  it('removing every batch deletes every stored one', async () => {
    setUpPrisma({ stored: ['a', 'b'] });
    await updateTour('spiti-valley-circuit', values({ departures: [] }), 'draft', LOADED_AT);
    expect(tx.groupDeparture.deleteMany).toHaveBeenCalledWith({
      where: { tourSlug: 'spiti-valley-circuit', slug: { in: ['a', 'b'] } },
    });
  });

  it('creates a new batch linked to the tour, inheriting destination/category/photo, appended to the global order', async () => {
    await createTour(values({ departures: [batch(), batch({ startDate: '2026-12-28', endDate: '2027-01-04', seatsAvailable: '0' })] }), 'draft');

    expect(tx.groupDeparture.createMany).toHaveBeenCalledTimes(1);
    const [[{ data }]] = tx.groupDeparture.createMany.mock.calls;
    expect(data).toHaveLength(2);
    expect(data[0]).toMatchObject({
      tourSlug: 'spiti-valley-circuit',
      destinationSlug: 'spiti-valley',
      category: 'Adventure',
      photoKey: 'spiti-valley',
      dateRangeLabel: '06 — 15 Oct 2026',
      month: 'Oct',
      seatsLabel: '08 seats left',
      scriptAccent: '',
      sortOrder: 4, // max (3) + 1
    });
    expect(data[1]).toMatchObject({ dateRangeLabel: '28 Dec 2026 — 04 Jan 2027', month: 'Dec', seatsLabel: 'Sold out', sortOrder: 5 });
    expect(data[0].slug).toMatch(/^spiti-valley-circuit-batch-[0-9a-f]{8}$/);
    expect(data[0].slug).not.toBe(data[1].slug);
    // A new batch carries no safety flag of its own (column defaults apply).
    expect(data[0]).not.toHaveProperty('priceUnverified');
    expect(data[0]).not.toHaveProperty('durationUnverified');
  });

  it('syncs under the NEW slug after a rename (the FK cascade has already moved the batches)', async () => {
    setUpPrisma({ stored: ['b1'], savedSlug: 'spiti-2026' });
    await updateTour('spiti-valley-circuit', values({ slug: 'spiti-2026', departures: [batch({ slug: 'b1' })] }), 'draft', LOADED_AT);
    expect(tx.groupDeparture.findMany).toHaveBeenCalledWith({ where: { tourSlug: 'spiti-2026' }, select: { slug: true } });
  });
});

describe('a batch that is not this tour’s is refused, and nothing is written', () => {
  it('throws ForeignDepartureError for a slug the tour does not own', async () => {
    setUpPrisma({ stored: ['mine'] });
    await expect(
      updateTour('spiti-valley-circuit', values({ departures: [batch({ slug: 'another-tours-batch' })] }), 'draft', LOADED_AT)
    ).rejects.toBeInstanceOf(ForeignDepartureError);

    // Refused BEFORE any batch write — and because it is thrown inside the
    // transaction, the real database rolls the tour update back too.
    expect(tx.groupDeparture.update).not.toHaveBeenCalled();
    expect(tx.groupDeparture.deleteMany).not.toHaveBeenCalled();
    expect(tx.groupDeparture.createMany).not.toHaveBeenCalled();
  });

  it('refuses any submitted slug on CREATE — a new tour owns no batches yet', async () => {
    await expect(createTour(values({ departures: [batch({ slug: 'chardham-special' })] }), 'draft')).rejects.toBeInstanceOf(
      ForeignDepartureError
    );
    expect(tx.groupDeparture.update).not.toHaveBeenCalled();
  });
});

describe('the M7 version check covers the batches too', () => {
  it('claims the tour row before reading or writing any batch', async () => {
    setUpPrisma({ stored: ['b1'] });
    await updateTour('spiti-valley-circuit', values({ departures: [batch({ slug: 'b1' }), batch()] }), 'draft', LOADED_AT);

    const claim = tx.tour.updateMany.mock.invocationCallOrder[0];
    for (const mock of [tx.groupDeparture.findMany, tx.groupDeparture.update, tx.groupDeparture.createMany]) {
      expect(mock).toHaveBeenCalled();
      expect(claim).toBeLessThan(mock.mock.invocationCallOrder[0]);
    }
  });

  it('a conflict writes no batch at all', async () => {
    setUpPrisma({ stored: ['b1', 'b2'] });
    tx.tour.updateMany.mockResolvedValue({ count: 0 });
    tx.tour.findUnique.mockResolvedValue({ slug: 'spiti-valley-circuit' });

    const result = await updateTour('spiti-valley-circuit', values({ departures: [batch()] }), 'publish', LOADED_AT);

    expect(result).toEqual({ configured: true, value: { outcome: 'conflict' } });
    for (const mock of Object.values(tx.groupDeparture)) expect(mock).not.toHaveBeenCalled();
  });
});

describe('free text is stripped at write time, even when the schema was bypassed', () => {
  it('never stores markup from a batch field', async () => {
    setUpPrisma({ stored: ['b1'] });
    await updateTour(
      'spiti-valley-circuit',
      values({
        departures: [
          batch({
            slug: 'b1',
            name: '<script>alert(1)</script>Spiti',
            boardingPoints: '<img src=x onerror=alert(1)>Delhi',
            tourManagerLabel: '<b>Yes</b>',
            durationLabel: '<svg/onload=alert(1)>9N',
          }),
        ],
      }),
      'draft',
      LOADED_AT
    );
    const { data } = tx.groupDeparture.update.mock.calls[0][0];
    for (const value of Object.values(data)) expect(String(value)).not.toMatch(/[<>]/);
    expect(data.boardingPoints).toBe('Delhi');
  });
});

describe('reading a tour back into the form', () => {
  const tourRow = (departures: unknown[], pricingUnverified = false) => ({
    slug: 'do-dham-yatra', name: 'Do Dham Yatra', destinationSlug: 'kedarnath', category: 'Spiritual',
    audienceTags: [], durationLabel: '6 Days 5 Nights', subtitle: '', shortDescription: null,
    fullDescription: null, bestTimeToVisit: null, priceFrom: '₹28,900', priceWas: null,
    savingsLabel: null, seatsLabel: null, isHot: false, inclusions: [], exclusions: [],
    status: 'PUBLISHED', archivedAt: null, updatedAt: new Date(), pricingUnverified,
    itineraryDays: [], faqs: [], pricingTiers: [], galleryImages: [], brochure: null,
    coverImageUrl: null, coverImagePublicId: null, departures,
  });

  const SEEDED = {
    slug: 'do-dham-yatra-kedarnath-badrinath',
    name: 'Do Dham Yatra — Kedarnath & Badrinath',
    dateRangeLabel: '12 — 18 May 2026',
    seatsLabel: '14 seats left',
    priceFrom: '₹28,900',
    durationLabel: '6N / 7D',
    boardingPoints: 'Ahmedabad · Delhi',
    tourManagerLabel: 'Yes, GTY manager',
    durationUnverified: true,
    priceUnverified: false,
  };

  it('turns stored labels back into dates and a count, exactly', async () => {
    mockGetOptionalPrismaClient.mockReturnValue({ tour: { findUnique: jest.fn().mockResolvedValue(tourRow([SEEDED])) } });
    const result = await getAdminTourBySlug('do-dham-yatra');
    if (!result.configured || !result.value) throw new Error('expected a tour');

    expect(result.value.form.departures).toEqual([
      {
        slug: 'do-dham-yatra-kedarnath-badrinath',
        name: 'Do Dham Yatra — Kedarnath & Badrinath',
        startDate: '2026-05-12',
        endDate: '2026-05-18',
        seatsAvailable: '14',
        priceFrom: '₹28,900',
        durationLabel: '6N / 7D',
        boardingPoints: 'Ahmedabad · Delhi',
        tourManagerLabel: 'Yes, GTY manager',
      },
    ]);
  });

  it('reports the EFFECTIVE price marker — the tour’s doubt counts, as it does publicly', async () => {
    mockGetOptionalPrismaClient.mockReturnValue({ tour: { findUnique: jest.fn().mockResolvedValue(tourRow([SEEDED], true)) } });
    const result = await getAdminTourBySlug('do-dham-yatra');
    if (!result.configured || !result.value) throw new Error('expected a tour');
    expect(result.value.departureMarkers).toEqual({
      'do-dham-yatra-kedarnath-badrinath': { durationUnverified: true, priceUnverified: true },
    });
  });

  it('leaves a label it cannot read EMPTY rather than guessing, so the form asks for it', async () => {
    mockGetOptionalPrismaClient.mockReturnValue({
      tour: { findUnique: jest.fn().mockResolvedValue(tourRow([{ ...SEEDED, dateRangeLabel: 'mid-May, TBC', seatsLabel: 'Few left' }])) },
    });
    const result = await getAdminTourBySlug('do-dham-yatra');
    if (!result.configured || !result.value) throw new Error('expected a tour');
    expect(result.value.form.departures[0]).toMatchObject({ startDate: '', endDate: '', seatsAvailable: '' });
  });
});
