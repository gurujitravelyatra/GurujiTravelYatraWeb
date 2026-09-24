/**
 * @jest-environment node
 */
import { PrismaContentAdapter } from '@/content/adapters/prisma-content-adapter';
import { getOptionalPrismaClient } from '@/server/db/prisma';

/**
 * The departure visibility gate against the LIVE database — OPT-IN
 * (`RUN_DB_TESTS=1`), same conventions as `tour-repository.integration.test.ts`.
 *
 * The mocked adapter tests prove the predicate. This proves the SQL half: that
 * `OR: [{ tourSlug: null }, { tour: { status, archivedAt } }]` and the
 * `tour: { select }` join mean on Postgres what they look like they mean, and
 * that the seeded departures are all still listed (no over-withholding on real
 * data).
 *
 * ## Cleanup order is load-bearing — read before editing
 *
 * `GroupDeparture.tour` is `onDelete: SetNull`. Deleting a test TOUR first would
 * not delete its departures; it would turn them into UNLINKED departures, which
 * are publicly listed — i.e. a crashed or careless cleanup would publish test
 * rows on the live `/group-tours`. So departures are deleted first, by prefix,
 * and the count of leftovers is asserted in `afterAll`.
 */

const SHOULD_RUN = process.env.RUN_DB_TESTS === '1' && Boolean(process.env.DATABASE_URL);
const describeDb = SHOULD_RUN ? describe : describe.skip;

const PREFIX = 'zz-departure-gate-';
const TOUR = `${PREFIX}tour`;
const LINKED = `${PREFIX}linked-batch`;
const UNLINKED = `${PREFIX}unlinked-batch`;

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
  // Departures FIRST — see the file header.
  await prisma.groupDeparture.deleteMany({
    where: { OR: [{ slug: { startsWith: PREFIX } }, { tourSlug: { startsWith: PREFIX } }] },
  });
  await prisma.tour.deleteMany({ where: { slug: { startsWith: PREFIX } } });
}

function departureData(slug: string, tourSlug: string | null, sortOrder: number) {
  return {
    slug,
    name: `ZZ ${slug}`,
    destinationSlug: 'spiti-valley',
    tourSlug,
    category: 'Adventure' as const,
    photoKey: 'Spiti Valley',
    dateRangeLabel: '06 — 15 Oct 2026',
    month: 'Oct',
    durationLabel: '9N / 10D',
    boardingPoints: 'Delhi',
    tourManagerLabel: 'Yes, GTY manager',
    priceFrom: '₹42,500',
    seatsLabel: '08 seats left',
    scriptAccent: '',
    sortOrder,
  };
}

describeDb('departure visibility gate against the live database', () => {
  const adapter = () => new PrismaContentAdapter(getOptionalPrismaClient()!);
  const listedSlugs = async () => (await adapter().getGroupDepartures()).map((d) => d.slug);

  beforeAll(async () => {
    await connectWithRetry();
    await cleanup();
    const prisma = getOptionalPrismaClient()!;
    const last = await prisma.tour.findFirst({ orderBy: { catalogueOrder: 'desc' }, select: { catalogueOrder: true } });
    const lastDeparture = await prisma.groupDeparture.findFirst({ orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } });
    const base = (lastDeparture?.sortOrder ?? 0) + 1000;

    await prisma.tour.create({
      data: {
        slug: TOUR,
        name: 'ZZ Departure Gate Tour',
        destinationSlug: 'spiti-valley',
        category: 'Adventure',
        durationLabel: '9 Days 8 Nights',
        subtitle: 'A - B',
        photoKey: 'spiti-valley',
        photosCount: 0,
        priceFrom: '₹42,500',
        status: 'PUBLISHED',
        catalogueOrder: (last?.catalogueOrder ?? 0) + 1000,
      },
    });
    await prisma.groupDeparture.create({ data: departureData(LINKED, TOUR, base) });
    await prisma.groupDeparture.create({ data: departureData(UNLINKED, null, base + 1) });
  }, 60_000);

  afterAll(async () => {
    await cleanup();
    const prisma = getOptionalPrismaClient()!;
    const leftovers =
      (await prisma.groupDeparture.count({ where: { slug: { startsWith: PREFIX } } })) +
      (await prisma.tour.count({ where: { slug: { startsWith: PREFIX } } }));
    expect(leftovers).toBe(0);
    await prisma.$disconnect();
  }, 60_000);

  it('lists a departure of a PUBLISHED tour, and an unlinked one', async () => {
    const slugs = await listedSlugs();
    expect(slugs).toContain(LINKED);
    expect(slugs).toContain(UNLINKED);
  });

  it('still lists every seeded departure — no over-withholding on real data', async () => {
    const slugs = await listedSlugs();
    for (const seeded of ['do-dham-yatra-kedarnath-badrinath', 'spiti-valley-circuit', 'chardham-special', 'kashi-ayodhya-prayagraj']) {
      expect(slugs).toContain(seeded);
    }
  });

  /**
   * The gate only covers a departure that is LINKED. The live database was
   * seeded before `tourSlug` existed, so all four seeded rows were NULL until
   * migration `20260925090000_link_seeded_departures_to_tours` — and every other
   * test in this file passed anyway, because an unlinked departure is listed.
   * This asserts the links themselves, so that state cannot return unnoticed.
   */
  it('the seeded departures that have a catalogue twin are LINKED to it', async () => {
    const prisma = getOptionalPrismaClient()!;
    const rows = await prisma.groupDeparture.findMany({
      where: { slug: { in: ['do-dham-yatra-kedarnath-badrinath', 'spiti-valley-circuit', 'chardham-special', 'kashi-ayodhya-prayagraj'] } },
      select: { slug: true, tourSlug: true },
    });
    expect(Object.fromEntries(rows.map((r) => [r.slug, r.tourSlug]))).toEqual({
      'do-dham-yatra-kedarnath-badrinath': 'do-dham-yatra',
      'spiti-valley-circuit': 'spiti-valley-circuit',
      'chardham-special': null,
      'kashi-ayodhya-prayagraj': null,
    });
  });

  it('keeps the seeded Do Dham departure marked (its tour is price-unconfirmed)', async () => {
    const doDham = (await adapter().getGroupDepartures()).find((d) => d.slug === 'do-dham-yatra-kedarnath-badrinath');
    expect(doDham?.priceUnverified).toBe(true);
  });

  it('withdraws the departure when its tour is ARCHIVED, and restores it on un-archive', async () => {
    const prisma = getOptionalPrismaClient()!;
    await prisma.tour.update({ where: { slug: TOUR }, data: { archivedAt: new Date() } });
    let slugs = await listedSlugs();
    expect(slugs).not.toContain(LINKED);
    expect(slugs).toContain(UNLINKED); // the floor — the query did return rows

    await prisma.tour.update({ where: { slug: TOUR }, data: { archivedAt: null } });
    slugs = await listedSlugs();
    expect(slugs).toContain(LINKED);
  });

  it('withdraws the departure when its tour is un-published (DRAFT)', async () => {
    const prisma = getOptionalPrismaClient()!;
    await prisma.tour.update({ where: { slug: TOUR }, data: { status: 'DRAFT' } });
    const slugs = await listedSlugs();
    expect(slugs).not.toContain(LINKED);
    expect(slugs).toContain(UNLINKED);
    await prisma.tour.update({ where: { slug: TOUR }, data: { status: 'PUBLISHED' } });
  });
});
