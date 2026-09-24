/**
 * @jest-environment node
 */
import { PrismaContentAdapter } from '@/content/adapters/prisma-content-adapter';
import { getOptionalPrismaClient } from '@/server/db/prisma';

import {
  createTour,
  ForeignDepartureError,
  getAdminTourBySlug,
  setTourArchived,
  setTourStatus,
  updateTour,
} from '../tour-repository';
import type { DepartureBatchValue, ParsedTourFormValues } from '../tour-form-schema';

/**
 * BATCH DEPARTURES through the tour save, against the LIVE database — OPT-IN
 * (`RUN_DB_TESTS=1`), same conventions as `tour-repository.integration.test.ts`.
 *
 * What only real SQL can show: that the identity-preserving sync keeps the
 * columns the form does not own (the safety flags above all), that a foreign
 * batch slug rolls the WHOLE save back, that the M7 version check guards the
 * batches, and that a batch written here obeys the public gate.
 *
 * ## Cleanup — departures FIRST
 *
 * `GroupDeparture.tour` is `onDelete: SetNull`: deleting a test tour before its
 * batches would leave them as UNLINKED departures, which are publicly listed on
 * the live `/group-tours`. Batches are deleted first, by prefix, and `afterAll`
 * asserts nothing with the prefix survives.
 */

const SHOULD_RUN = process.env.RUN_DB_TESTS === '1' && Boolean(process.env.DATABASE_URL);
const describeDb = SHOULD_RUN ? describe : describe.skip;

const PREFIX = 'zz-cms-dep-';
const TOUR = `${PREFIX}tour`;

function batch(overrides: Partial<DepartureBatchValue> = {}): DepartureBatchValue {
  return {
    name: 'ZZ Departure Test',
    startDate: '2027-05-10',
    endDate: '2027-05-16',
    seatsAvailable: '12',
    priceFrom: '₹11,111',
    durationLabel: '6N / 7D',
    boardingPoints: 'Delhi',
    tourManagerLabel: 'Yes, GTY manager',
    ...overrides,
  };
}

function values(overrides: Partial<ParsedTourFormValues> = {}): ParsedTourFormValues {
  return {
    name: 'ZZ Departure Test Tour',
    slug: TOUR,
    destinationSlug: 'spiti-valley',
    category: 'Adventure',
    audienceTags: ['Group Tour'],
    durationLabel: '7 Days 6 Nights',
    subtitle: 'A - B',
    shortDescription: 'A test tour created by the departures integration suite.',
    fullDescription: undefined,
    bestTimeToVisit: undefined,
    priceFrom: '₹11,111',
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

async function connectWithRetry(attempts = 6): Promise<void> {
  const prisma = getOptionalPrismaClient();
  if (!prisma) throw new Error('RUN_DB_TESTS=1 but DATABASE_URL is not set');
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await prisma.$connect();
      await prisma.tour.count();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 750));
    }
  }
  throw lastError;
}

async function cleanup(): Promise<void> {
  const prisma = getOptionalPrismaClient();
  if (!prisma) return;
  await prisma.groupDeparture.deleteMany({
    where: { OR: [{ slug: { startsWith: PREFIX } }, { tourSlug: { startsWith: PREFIX } }] },
  });
  await prisma.tour.deleteMany({ where: { slug: { startsWith: PREFIX } } });
}

async function load(slug = TOUR) {
  const result = await getAdminTourBySlug(slug);
  if (!result.configured || result.value === null) throw new Error(`tour ${slug} not found`);
  return result.value;
}

async function saveAtCurrentVersion(slug: string, form: ParsedTourFormValues, intent: 'draft' | 'publish' = 'draft') {
  const { updatedAt } = await load(slug);
  const result = await updateTour(slug, form, intent, updatedAt);
  if (!result.configured || result.value.outcome !== 'saved') throw new Error(`expected a clean save of ${slug}`);
}

async function rowsOf(tourSlug = TOUR) {
  return getOptionalPrismaClient()!.groupDeparture.findMany({ where: { tourSlug }, orderBy: { sortOrder: 'asc' } });
}

describeDb('batch departures against the live database', () => {
  beforeAll(async () => {
    await connectWithRetry();
    await cleanup();
  }, 60_000);

  afterAll(async () => {
    await cleanup();
    const prisma = getOptionalPrismaClient()!;
    const leftovers =
      (await prisma.groupDeparture.count({
        where: { OR: [{ slug: { startsWith: PREFIX } }, { tourSlug: { startsWith: PREFIX } }] },
      })) + (await prisma.tour.count({ where: { slug: { startsWith: PREFIX } } }));
    expect(leftovers).toBe(0);
    await prisma.$disconnect();
  }, 60_000);

  it('creates a tour WITH batches, and reads them back into the form exactly', async () => {
    await createTour(values({ departures: [batch(), batch({ startDate: '2027-06-01', endDate: '2027-06-07', seatsAvailable: '0' })] }), 'draft');

    const rows = await rowsOf();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      tourSlug: TOUR,
      dateRangeLabel: '10 — 16 May 2027',
      month: 'May',
      seatsLabel: '12 seats left',
      destinationSlug: 'spiti-valley',
      category: 'Adventure',
      durationUnverified: false,
      priceUnverified: false,
    });
    expect(rows[1].seatsLabel).toBe('Sold out');

    const { form } = await load();
    expect(form.departures).toEqual([
      { ...batch(), slug: rows[0].slug },
      { ...batch({ startDate: '2027-06-01', endDate: '2027-06-07', seatsAvailable: '0' }), slug: rows[1].slug },
    ]);
  });

  it('a new batch is appended AFTER every seeded departure in the /group-tours order', async () => {
    const prisma = getOptionalPrismaClient()!;
    const seededMax = await prisma.groupDeparture.findFirst({
      where: { NOT: { tourSlug: { startsWith: PREFIX } } },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    const [first] = await rowsOf();
    expect(first.sortOrder).toBeGreaterThan(seededMax?.sortOrder ?? -1);
  });

  it('edits one batch in place, removes another and adds a third — in one save', async () => {
    const before = await rowsOf();
    const { form } = await load();

    await saveAtCurrentVersion(TOUR, {
      ...form,
      departures: [
        { ...form.departures[0], seatsAvailable: '3', startDate: '2027-05-11' }, // edited
        // [1] removed
        batch({ name: 'ZZ Added Batch', startDate: '2027-09-01', endDate: '2027-09-05' }), // added
      ],
    });

    const after = await rowsOf();
    expect(after).toHaveLength(2);
    // Same row, same identity, same global position — updated, not re-created.
    expect(after[0].slug).toBe(before[0].slug);
    expect(after[0].sortOrder).toBe(before[0].sortOrder);
    expect(after[0]).toMatchObject({ seatsLabel: '03 seats left', dateRangeLabel: '11 — 16 May 2027' });
    // The removed one is gone, and the added one is new.
    expect(after.map((row) => row.slug)).not.toContain(before[1].slug);
    expect(after[1]).toMatchObject({ name: 'ZZ Added Batch', dateRangeLabel: '01 — 05 Sep 2027', month: 'Sep' });
  });

  /**
   * THE property the identity-preserving design exists for. A safety flag the
   * form does not carry must survive an unrelated save of the tour — which a
   * delete-and-recreate of the batches would silently reset to false.
   */
  it('a save of an unrelated field leaves every batch column — safety flags included — byte-identical', async () => {
    const prisma = getOptionalPrismaClient()!;
    const [target] = await rowsOf();
    await prisma.groupDeparture.update({
      where: { slug: target.slug },
      data: { durationUnverified: true, priceUnverified: true, scriptAccent: 'Hand\nSet' },
    });
    const before = await prisma.groupDeparture.findUniqueOrThrow({ where: { slug: target.slug } });

    const { form } = await load();
    await saveAtCurrentVersion(TOUR, { ...form, fullDescription: 'An unrelated edit.' });

    const after = await prisma.groupDeparture.findUniqueOrThrow({ where: { slug: target.slug } });
    expect(after).toEqual(before);
  });

  it('a save from a STALE version touches no batch', async () => {
    const before = await rowsOf();
    const { form, updatedAt } = await load();
    await saveAtCurrentVersion(TOUR, { ...form, fullDescription: 'Someone else saved first.' });

    const stale = await updateTour(TOUR, { ...form, departures: [] }, 'draft', updatedAt);
    expect(stale).toEqual({ configured: true, value: { outcome: 'conflict' } });

    const after = await rowsOf();
    expect(after.map((row) => row.slug)).toEqual(before.map((row) => row.slug));
  });

  it('refuses a batch slug that belongs to no batch of this tour, and rolls the WHOLE save back', async () => {
    const prisma = getOptionalPrismaClient()!;
    const seededBefore = await prisma.groupDeparture.findUniqueOrThrow({ where: { slug: 'chardham-special' } });
    const { form, updatedAt } = await load();

    await expect(
      updateTour(
        TOUR,
        { ...form, fullDescription: 'MUST NOT PERSIST', departures: [...form.departures, batch({ slug: 'chardham-special' })] },
        'draft',
        updatedAt
      )
    ).rejects.toBeInstanceOf(ForeignDepartureError);

    // The seeded departure is untouched — not adopted, not rewritten.
    expect(await prisma.groupDeparture.findUniqueOrThrow({ where: { slug: 'chardham-special' } })).toEqual(seededBefore);
    // And the tour's own update was rolled back with it.
    const tour = await prisma.tour.findUniqueOrThrow({ where: { slug: TOUR } });
    expect(tour.fullDescription).not.toBe('MUST NOT PERSIST');
    expect(tour.updatedAt).toEqual(updatedAt);
  });

  it('a batch written here obeys the public gate: hidden as a draft, listed when published, hidden when archived', async () => {
    const adapter = new PrismaContentAdapter(getOptionalPrismaClient()!);
    const listed = async () => (await adapter.getGroupDepartures()).map((d) => d.slug);
    const mine = (await rowsOf()).map((row) => row.slug);
    expect(mine.length).toBeGreaterThan(0);

    // Draft (the tour was created as one).
    for (const slug of mine) expect(await listed()).not.toContain(slug);

    await setTourStatus(TOUR, 'PUBLISHED');
    const whenPublished = await listed();
    for (const slug of mine) expect(whenPublished).toContain(slug);

    await setTourArchived(TOUR, true);
    const whenArchived = await listed();
    for (const slug of mine) expect(whenArchived).not.toContain(slug);
    // The floor: the seeded batches are still there, so the query did return rows.
    expect(whenArchived).toContain('chardham-special');
  });

  /**
   * A LIVE seeded tour, round-tripped through the editor with one unrelated edit:
   * its seeded batch — dates, seats, price, and the `durationUnverified` flag the
   * design export's two transcriptions put on it — must come out byte-identical.
   * This is the check that the label parsers are exact inverses on REAL data.
   */
  it('round-tripping the seeded Spiti Valley Circuit leaves its seeded batch byte-identical', async () => {
    const prisma = getOptionalPrismaClient()!;
    const before = await prisma.groupDeparture.findUniqueOrThrow({ where: { slug: 'spiti-valley-circuit' } });
    expect(before.tourSlug).toBe('spiti-valley-circuit'); // linked by migration 20260925090000
    expect(before.durationUnverified).toBe(true);

    const loaded = await load('spiti-valley-circuit');
    expect(loaded.form.departures.map((d) => d.slug)).toEqual(['spiti-valley-circuit']);
    const original = loaded.form.fullDescription;

    try {
      await saveAtCurrentVersion('spiti-valley-circuit', { ...loaded.form, fullDescription: 'EDITED BY DEPARTURES SUITE' }, 'publish');
      const after = await prisma.groupDeparture.findUniqueOrThrow({ where: { slug: 'spiti-valley-circuit' } });
      expect(after).toEqual(before);
    } finally {
      const current = await load('spiti-valley-circuit');
      await saveAtCurrentVersion('spiti-valley-circuit', { ...current.form, fullDescription: original }, 'publish');
    }
    const restored = await prisma.tour.findUniqueOrThrow({ where: { slug: 'spiti-valley-circuit' } });
    expect(restored.fullDescription).toBe(original ?? null);
  });
});
