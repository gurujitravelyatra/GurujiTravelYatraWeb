/**
 * @jest-environment node
 */
import { PrismaContentAdapter } from '@/content/adapters/prisma-content-adapter';
import { getOptionalPrismaClient } from '@/server/db/prisma';

import {
  createTour,
  findSlugConflict,
  getAdminTourBySlug,
  listAdminTours,
  setTourArchived,
  setTourStatus,
  updateTour,
} from '../tour-repository';
import type { ParsedTourFormValues } from '../tour-form-schema';

/**
 * LIVE-DATABASE integration tests for the tour CMS — OPT-IN.
 *
 * ## Why these are skipped by default
 *
 * `npm test` must not depend on the network. This project's unit suites
 * deliberately run with the fixture adapter (`content-routes.test.ts` explains
 * why at length: the managed Postgres proxy drops connections with an
 * intermittent `P1001`, and assertions would depend on whatever rows happen to
 * be in a shared database). Making the default suite hit a remote database would
 * trade a fast, deterministic suite for a slow, flaky one.
 *
 * ## Why they exist anyway
 *
 * Everything else in this change is verified against mocks or fixtures, and
 * BLOCKERS.md item 10 records the cost of that: "the SQL has not been executed
 * and the seed has not been proven to insert". Mocked tests cannot tell you
 * whether `@@unique([tourSlug, dayNumber])` actually holds, whether the
 * delete-then-create child replacement really is atomic, or whether an edit
 * silently blanks a column the form did not send. Those are exactly the failures
 * that matter for a CMS, so they get a suite that runs real SQL.
 *
 * Run with:  RUN_DB_TESTS=1 npx jest tour-repository.integration
 *
 * ## These tests write to the real database, and clean up after themselves
 *
 * Every row they create uses the `zz-cms-test-` slug prefix and is deleted in
 * `afterAll` (and defensively in `beforeAll`, so a crashed run does not poison
 * the next one). They never modify a pre-existing tour destructively: the edit
 * test writes to a tour it created, and the "existing tour is not corrupted"
 * test snapshots a real seeded tour, edits ONE field, and asserts every other
 * field is byte-identical before restoring it.
 */

const SHOULD_RUN = process.env.RUN_DB_TESTS === '1' && Boolean(process.env.DATABASE_URL);
const describeDb = SHOULD_RUN ? describe : describe.skip;

const TEST_PREFIX = 'zz-cms-test-';
const DRAFT_SLUG = `${TEST_PREFIX}draft-tour`;
const RENAMED_SLUG = `${TEST_PREFIX}draft-tour-renamed`;

function baseValues(overrides: Partial<ParsedTourFormValues> = {}): ParsedTourFormValues {
  return {
    name: 'ZZ CMS Test Tour',
    slug: DRAFT_SLUG,
    destinationSlug: 'spiti-valley',
    category: 'Adventure',
    audienceTags: ['Domestic', 'Group Tour'],
    durationLabel: '5 Days 4 Nights',
    subtitle: 'A - B - C',
    shortDescription: 'A test tour created by the CMS integration suite.',
    fullDescription: undefined,
    bestTimeToVisit: undefined,
    priceFrom: '₹11,111',
    priceWas: undefined,
    savingsLabel: undefined,
    seatsLabel: undefined,
    isHot: false,
    inclusions: ['Breakfast', 'Transfers'],
    exclusions: ['Airfare'],
    itineraryDays: [
      { title: 'Day one', description: 'Arrive.' },
      { title: 'Day two', description: 'Explore.' },
    ],
    faqs: [{ question: 'Is this real?', answer: 'No, it is a test row.' }],
    pricingTiers: [],
    // Phase C media. Absent by default — the base row is a DRAFT, and a draft with
    // no cover is the state most of these tests are about.
    coverImage: undefined,
    galleryImages: [],
    brochureFile: undefined,
    ...overrides,
  };
}

/**
 * Opens the connection, retrying the intermittent `P1001`.
 *
 * NOT defensive padding — measured. An empty test whose only statement is
 * `prisma.tour.count()` failed 3 runs out of 4 against this database with
 * `PrismaClientInitializationError: Can't reach database server`, then succeeded
 * on the next attempt with no change. The server is fine; it is Railway's
 * managed TCP PROXY dropping connection attempts, the same failure
 * `src/server/db/prisma.ts` caps the connection pool for and that BLOCKERS.md
 * records as intermittent.
 *
 * Retrying here rather than around every query keeps the tests readable: once a
 * connection is established it stays up for the run. If this ever exhausts its
 * attempts, the suite fails loudly rather than skipping — a silently-skipped
 * integration suite is worse than no integration suite.
 */
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

/**
 * An edit made by an admin whose editor is UP TO DATE: reads the row's current
 * `updatedAt` and passes it as the version, exactly as the edit page does. Every
 * pre-M7 test here is about what an edit WRITES, not about concurrency, so they
 * all go through this. The concurrency tests call `updateTour` directly with a
 * version they control.
 */
async function updateAtCurrentVersion(
  slug: string,
  values: ParsedTourFormValues,
  intent: 'draft' | 'publish'
): Promise<Awaited<ReturnType<typeof updateTour>>> {
  const prisma = getOptionalPrismaClient();
  if (!prisma) throw new Error('RUN_DB_TESTS=1 but DATABASE_URL is not set');
  const { updatedAt } = await prisma.tour.findUniqueOrThrow({ where: { slug }, select: { updatedAt: true } });
  const result = await updateTour(slug, values, intent, updatedAt);
  if (result.configured && result.value.outcome !== 'saved') {
    throw new Error(`expected a clean save of ${slug}, got ${result.value.outcome}`);
  }
  return result;
}

async function cleanup(): Promise<void> {
  const prisma = getOptionalPrismaClient();
  if (!prisma) return;
  // Children cascade from the tour, but deleting them explicitly keeps the
  // cleanup correct even if a cascade is ever relaxed.
  await prisma.tour.deleteMany({ where: { slug: { startsWith: TEST_PREFIX } } });
}

describeDb('tour CMS against the live database', () => {
  beforeAll(async () => {
    await connectWithRetry();
    await cleanup();
  });
  afterAll(async () => {
    await cleanup();
    const prisma = getOptionalPrismaClient();
    await prisma?.$disconnect();
  });

  // -------------------------------------------------------------------------
  describe('creating a tour', () => {
    it('saves a draft with every child collection, and reads back exactly what was sent', async () => {
      const created = await createTour(baseValues(), 'draft');
      expect(created.configured && created.value.slug).toBe(DRAFT_SLUG);

      const loaded = await getAdminTourBySlug(DRAFT_SLUG);
      if (!loaded.configured || loaded.value === null) throw new Error('tour not found after create');

      // A round-trip, not a spot check. `getAdminTourBySlug` returns FORM SHAPE
      // precisely so this comparison is possible — if load and save disagreed,
      // an edit would silently reset whatever they disagreed about.
      expect(loaded.value.form.name).toBe('ZZ CMS Test Tour');
      expect(loaded.value.form.audienceTags.sort()).toEqual(['Domestic', 'Group Tour']);
      expect(loaded.value.form.inclusions).toEqual(['Breakfast', 'Transfers']);
      expect(loaded.value.form.exclusions).toEqual(['Airfare']);
      expect(loaded.value.form.itineraryDays).toEqual([
        { title: 'Day one', description: 'Arrive.' },
        { title: 'Day two', description: 'Explore.' },
      ]);
      expect(loaded.value.form.faqs).toEqual([{ question: 'Is this real?', answer: 'No, it is a test row.' }]);
      expect(loaded.value.lifecycle).toBe('DRAFT');
    });

    it('numbers itinerary days from 1 in array order', async () => {
      const prisma = getOptionalPrismaClient();
      const days = await prisma!.tourItineraryDay.findMany({
        where: { tourSlug: DRAFT_SLUG },
        orderBy: { dayNumber: 'asc' },
      });
      expect(days.map((day) => day.dayNumber)).toEqual([1, 2]);
    });

    it('the new draft appears in the admin list', async () => {
      const list = await listAdminTours({ status: 'DRAFT' });
      if (!list.configured) throw new Error('unconfigured');
      expect(list.value.map((tour) => tour.slug)).toContain(DRAFT_SLUG);
    });

    it('but is INVISIBLE to every public query while it is a draft', async () => {
      // The whole point, asserted against real SQL rather than a mock: the
      // adapter's WHERE clause and the predicate together, over a row that
      // genuinely exists in Postgres.
      const prisma = getOptionalPrismaClient();
      const adapter = new PrismaContentAdapter(prisma!);

      const [all, popular, rails] = await Promise.all([
        adapter.getAllTours(),
        adapter.getPopularDestinations(),
        adapter.getPackageRails(),
      ]);

      expect(all.map((tour) => tour.slug)).not.toContain(DRAFT_SLUG);
      expect(popular.map((tour) => tour.slug)).not.toContain(DRAFT_SLUG);
      expect(rails.flatMap((rail) => rail.items.map((item) => item.slug))).not.toContain(DRAFT_SLUG);

      // And the row really is there — otherwise this test passes for the wrong
      // reason.
      expect(await prisma!.tour.count({ where: { slug: DRAFT_SLUG } })).toBe(1);
    });

    it('rejects a slug already taken by another tour', async () => {
      const conflict = await findSlugConflict(DRAFT_SLUG);
      expect(conflict.configured && conflict.value).toEqual({ taken: true, archived: false });

      // ...but not when the tour is checking its own slug during an edit.
      const self = await findSlugConflict(DRAFT_SLUG, DRAFT_SLUG);
      expect(self.configured && self.value).toEqual({ taken: false });
    });
  });

  // -------------------------------------------------------------------------
  describe('publishing', () => {
    it('makes the tour visible to public queries', async () => {
      await setTourStatus(DRAFT_SLUG, 'PUBLISHED');

      const prisma = getOptionalPrismaClient();
      const tours = await new PrismaContentAdapter(prisma!).getAllTours();
      expect(tours.map((tour) => tour.slug)).toContain(DRAFT_SLUG);
    });

    it('un-publishing hides it again', async () => {
      await setTourStatus(DRAFT_SLUG, 'DRAFT');

      const prisma = getOptionalPrismaClient();
      const tours = await new PrismaContentAdapter(prisma!).getAllTours();
      expect(tours.map((tour) => tour.slug)).not.toContain(DRAFT_SLUG);

      await setTourStatus(DRAFT_SLUG, 'PUBLISHED');
    });
  });

  // -------------------------------------------------------------------------
  describe('editing', () => {
    it('replaces child collections rather than appending to them', async () => {
      // The delete-then-create path. Appending would silently resurrect a
      // removed itinerary day, and duplicate dayNumbers would violate the
      // unique constraint — this asserts against real SQL that neither happens.
      await updateAtCurrentVersion(DRAFT_SLUG, baseValues({ itineraryDays: [{ title: 'Only day', description: 'Solo.' }] }), 'publish');

      const loaded = await getAdminTourBySlug(DRAFT_SLUG);
      if (!loaded.configured || loaded.value === null) throw new Error('missing');
      expect(loaded.value.form.itineraryDays).toEqual([{ title: 'Only day', description: 'Solo.' }]);
    });

    it('switching to pricing tiers is the presence of rows, with no flag to drift', async () => {
      await updateAtCurrentVersion(
        DRAFT_SLUG,
        baseValues({
          itineraryDays: [{ title: 'Only day', description: 'Solo.' }],
          pricingTiers: [
            { name: 'Standard', price: '₹11,111', description: undefined },
            { name: 'Deluxe', price: '₹22,222', description: 'Better rooms.' },
          ],
        }),
        'publish'
      );

      const loaded = await getAdminTourBySlug(DRAFT_SLUG);
      if (!loaded.configured || loaded.value === null) throw new Error('missing');
      expect(loaded.value.form.pricingTiers).toHaveLength(2);

      const list = await listAdminTours({ status: 'ALL' });
      const row = list.configured ? list.value.find((tour) => tour.slug === DRAFT_SLUG) : undefined;
      // The list shows "2 tiers" and withholds the single price, rather than
      // rendering both and implying a base price the tour does not sell at.
      expect(row?.pricingTierCount).toBe(2);
      expect(row?.priceFrom).toBeNull();
    });

    it('removing every tier returns the tour to its single price', async () => {
      await updateAtCurrentVersion(
        DRAFT_SLUG,
        baseValues({ itineraryDays: [{ title: 'Only day', description: 'Solo.' }], pricingTiers: [] }),
        'publish'
      );

      const list = await listAdminTours({ status: 'ALL' });
      const row = list.configured ? list.value.find((tour) => tour.slug === DRAFT_SLUG) : undefined;
      expect(row?.pricingTierCount).toBe(0);
      expect(row?.priceFrom).toBe('₹11,111');
    });

    it('renaming the slug cascades to children and frees nothing behind it', async () => {
      await updateAtCurrentVersion(DRAFT_SLUG, baseValues({ slug: RENAMED_SLUG }), 'publish');

      const prisma = getOptionalPrismaClient();
      expect(await prisma!.tour.count({ where: { slug: DRAFT_SLUG } })).toBe(0);
      expect(await prisma!.tour.count({ where: { slug: RENAMED_SLUG } })).toBe(1);
      // ON UPDATE CASCADE — the children followed rather than being orphaned.
      expect(await prisma!.tourItineraryDay.count({ where: { tourSlug: RENAMED_SLUG } })).toBe(2);

      await updateAtCurrentVersion(RENAMED_SLUG, baseValues({ slug: DRAFT_SLUG }), 'publish');
    });

    /**
     * The "existing data isn't corrupted" test the task asks for, run against a
     * REAL SEEDED TOUR rather than one this suite created — because the risk is
     * specifically that the form's other fields default incorrectly and blank
     * columns the admin never touched.
     */
    it('editing one field of a live seeded tour leaves every other field untouched', async () => {
      const prisma = getOptionalPrismaClient();

      const target = await prisma!.tour.findFirst({
        where: { slug: { not: { startsWith: TEST_PREFIX } }, status: 'PUBLISHED', archivedAt: null },
        orderBy: { catalogueOrder: 'asc' },
      });
      if (!target) throw new Error('no seeded tour to edit');

      const before = await getAdminTourBySlug(target.slug);
      if (!before.configured || before.value === null) throw new Error('missing');
      const beforeForm = before.value.form;

      try {
        await updateAtCurrentVersion(
          target.slug,
          { ...beforeForm, fullDescription: 'EDITED BY INTEGRATION TEST' },
          'publish'
        );

        const after = await prisma!.tour.findUnique({ where: { slug: target.slug } });
        expect(after!.fullDescription).toBe('EDITED BY INTEGRATION TEST');

        // Everything the form did not change must be byte-identical. These are
        // the curation/lifecycle columns `toColumnData` deliberately does not
        // write — an edit that reset a rail position or cleared a safety flag
        // would be a silent, hard-to-notice regression.
        expect(after!.priceFrom).toBe(target.priceFrom);
        expect(after!.priceWas).toBe(target.priceWas);
        expect(after!.category).toBe(target.category);
        expect(after!.catalogueOrder).toBe(target.catalogueOrder);
        expect(after!.popularOrder).toBe(target.popularOrder);
        expect(after!.pricingUnverified).toBe(target.pricingUnverified);
        expect(after!.photoKey).toBe(target.photoKey);
        expect(after!.photosCount).toBe(target.photosCount);
        expect(after!.destinationSlug).toBe(target.destinationSlug);
        expect(after!.status).toBe('PUBLISHED');
        expect(after!.archivedAt).toBeNull();

        // Its public URL still resolves, with the edit visible.
        const adapter = new PrismaContentAdapter(prisma!);
        const publicTours = await adapter.getAllTours();
        expect(publicTours.map((tour) => tour.slug)).toContain(target.slug);
      } finally {
        // Restore, whatever happened above.
        await updateAtCurrentVersion(target.slug, beforeForm, 'publish');
        const restored = await prisma!.tour.findUnique({ where: { slug: target.slug } });
        expect(restored!.fullDescription).toBe(target.fullDescription);
      }
    });
  });

  // -------------------------------------------------------------------------
  describe('archiving', () => {
    it('removes the tour from every public surface without deleting the row', async () => {
      const prisma = getOptionalPrismaClient();

      // Published first, so archiving is the ONLY thing that can hide it.
      await setTourStatus(DRAFT_SLUG, 'PUBLISHED');
      expect((await new PrismaContentAdapter(prisma!).getAllTours()).map((t) => t.slug)).toContain(DRAFT_SLUG);

      await setTourArchived(DRAFT_SLUG, true);

      const adapter = new PrismaContentAdapter(prisma!);
      expect((await adapter.getAllTours()).map((t) => t.slug)).not.toContain(DRAFT_SLUG);
      expect((await adapter.getPopularDestinations()).map((t) => t.slug)).not.toContain(DRAFT_SLUG);

      // The row survives — the entire reason archiving exists (product-spec §7).
      const row = await prisma!.tour.findUnique({ where: { slug: DRAFT_SLUG } });
      expect(row).not.toBeNull();
      expect(row!.archivedAt).toBeInstanceOf(Date);
      // And `status` is untouched, so a restore returns it to PUBLISHED rather
      // than silently leaving it a draft.
      expect(row!.status).toBe('PUBLISHED');
    });

    it('disappears from the DEFAULT admin list but is findable under the Archived filter', async () => {
      const [defaultView, archivedView, allView] = await Promise.all([
        listAdminTours({}),
        listAdminTours({ status: 'ARCHIVED' }),
        listAdminTours({ status: 'ALL' }),
      ]);
      if (!defaultView.configured || !archivedView.configured || !allView.configured) {
        throw new Error('unconfigured');
      }

      expect(defaultView.value.map((t) => t.slug)).not.toContain(DRAFT_SLUG);
      expect(archivedView.value.map((t) => t.slug)).toContain(DRAFT_SLUG);
      expect(allView.value.map((t) => t.slug)).toContain(DRAFT_SLUG);

      // An archived tour must not show up under a lifecycle filter either, or
      // "Draft" would list retired tours alongside work in progress.
      const draftView = await listAdminTours({ status: 'DRAFT' });
      const publishedView = await listAdminTours({ status: 'PUBLISHED' });
      expect(draftView.configured && draftView.value.map((t) => t.slug)).not.toContain(DRAFT_SLUG);
      expect(publishedView.configured && publishedView.value.map((t) => t.slug)).not.toContain(DRAFT_SLUG);
    });

    it('an archived tour still holds its slug, and says so', async () => {
      const conflict = await findSlugConflict(DRAFT_SLUG);
      expect(conflict.configured && conflict.value).toEqual({ taken: true, archived: true });
    });

    it('restoring returns it to the public site in its previous status', async () => {
      await setTourArchived(DRAFT_SLUG, false);

      const prisma = getOptionalPrismaClient();
      const row = await prisma!.tour.findUnique({ where: { slug: DRAFT_SLUG } });
      expect(row!.archivedAt).toBeNull();
      expect(row!.status).toBe('PUBLISHED');

      expect((await new PrismaContentAdapter(prisma!).getAllTours()).map((t) => t.slug)).toContain(
        DRAFT_SLUG
      );
    });
  });

  // -------------------------------------------------------------------------
  /**
   * PHASE C media, against real SQL.
   *
   * Worth its own block because everything else about uploads is verified against
   * mocks — and, more to the point, because **no upload in this project has ever
   * been performed against a real Cloudinary account** (BLOCKERS.md item 12).
   * There are no credentials in this repo or environment. So the URLs below are
   * realistic strings rather than assets that exist, and what these tests prove
   * is exactly the half that does not need an account: that the new columns and
   * the new `TourGalleryImage` table hold what they are given, that a
   * replacement repoints the row, and that an uploaded cover reaches a public
   * query. The Cloudinary leg remains unverified.
   */
  describe('media (Phase C)', () => {
    const CDN = 'https://res.cloudinary.com/demo/image/upload/v1/gty/tours/zz-cms-test';
    const RAW = 'https://res.cloudinary.com/demo/raw/upload/v1/gty/tours/zz-cms-test';

    const OLD_COVER = { url: `${CDN}/cover_old111.jpg`, publicId: 'gty/tours/zz-cms-test/cover_old111' };
    const NEW_COVER = { url: `${CDN}/cover_new222.jpg`, publicId: 'gty/tours/zz-cms-test/cover_new222' };

    it('round-trips a cover, a gallery and a brochure through real SQL', async () => {
      await updateAtCurrentVersion(
        DRAFT_SLUG,
        {
          ...baseValues(),
          coverImage: OLD_COVER,
          galleryImages: [
            { url: `${CDN}/g1.jpg`, publicId: 'g1', width: 1600, height: 1000 },
            { url: `${CDN}/g2.jpg`, publicId: 'g2' },
          ],
          brochureFile: {
            url: `${RAW}/brochure_v1.pdf`,
            publicId: 'gty/tours/zz-cms-test/brochure_v1',
            fileName: 'zz-test-2026.pdf',
            sizeBytes: 1_234_567,
          },
        },
        'draft'
      );

      const reloaded = await getAdminTourBySlug(DRAFT_SLUG);
      if (!reloaded.configured || reloaded.value === null) throw new Error('missing');

      // Load → save unchanged must be a no-op, which is only true if every field
      // survives the round trip in the shape the form submits.
      expect(reloaded.value.form.coverImage).toEqual(OLD_COVER);
      expect(reloaded.value.form.galleryImages).toEqual([
        { url: `${CDN}/g1.jpg`, publicId: 'g1', width: 1600, height: 1000 },
        // Dimensions Cloudinary did not report stay absent rather than becoming 0.
        { url: `${CDN}/g2.jpg`, publicId: 'g2', width: undefined, height: undefined },
      ]);
      expect(reloaded.value.form.brochureFile).toEqual({
        url: `${RAW}/brochure_v1.pdf`,
        publicId: 'gty/tours/zz-cms-test/brochure_v1',
        fileName: 'zz-test-2026.pdf',
        sizeBytes: 1_234_567,
      });
    });

    it('keeps the gallery in the admin’s order, with contiguous sortOrder', async () => {
      const prisma = getOptionalPrismaClient();

      await updateAtCurrentVersion(
        DRAFT_SLUG,
        {
          ...baseValues(),
          galleryImages: [
            { url: `${CDN}/b.jpg`, publicId: 'b' },
            { url: `${CDN}/c.jpg`, publicId: 'c' },
            { url: `${CDN}/a.jpg`, publicId: 'a' },
          ],
        },
        'draft'
      );

      const rows = await prisma!.tourGalleryImage.findMany({
        where: { tourSlug: DRAFT_SLUG },
        orderBy: { sortOrder: 'asc' },
      });

      // The order is the admin's arrangement, not alphabetical and not insertion
      // order by id. `@@unique([tourSlug, sortOrder])` is what makes the
      // renumbering worth asserting: a gap or a duplicate would be a constraint
      // violation rather than a cosmetic bug.
      expect(rows.map((row) => [row.publicId, row.sortOrder])).toEqual([
        ['b', 0],
        ['c', 1],
        ['a', 2],
      ]);
    });

    it('removing a middle image renumbers the rest rather than leaving a gap', async () => {
      const prisma = getOptionalPrismaClient();

      await updateAtCurrentVersion(
        DRAFT_SLUG,
        {
          ...baseValues(),
          galleryImages: [
            { url: `${CDN}/b.jpg`, publicId: 'b' },
            { url: `${CDN}/a.jpg`, publicId: 'a' },
          ],
        },
        'draft'
      );

      const rows = await prisma!.tourGalleryImage.findMany({ where: { tourSlug: DRAFT_SLUG }, orderBy: { sortOrder: 'asc' } });
      expect(rows.map((row) => row.sortOrder)).toEqual([0, 1]);
      expect(rows.map((row) => row.publicId)).toEqual(['b', 'a']);
    });

    /**
     * REPLACEMENT SAFETY, end to end against real SQL.
     *
     * `cloudinary.test.ts` proves a replacement never overwrites the live asset;
     * this proves the database pointer moves cleanly to the new one, in one
     * statement, leaving no trace of the old id anywhere in the row.
     */
    it('repoints a published tour’s cover to a new asset without disturbing anything else', async () => {
      const prisma = getOptionalPrismaClient();

      await updateAtCurrentVersion(DRAFT_SLUG, { ...baseValues(), coverImage: OLD_COVER }, 'publish');
      const before = await prisma!.tour.findUnique({ where: { slug: DRAFT_SLUG } });
      expect(before!.coverImageUrl).toBe(OLD_COVER.url);
      expect(before!.status).toBe('PUBLISHED');

      await updateAtCurrentVersion(DRAFT_SLUG, { ...baseValues(), coverImage: NEW_COVER }, 'publish');

      const after = await prisma!.tour.findUnique({ where: { slug: DRAFT_SLUG } });
      expect(after!.coverImageUrl).toBe(NEW_COVER.url);
      expect(after!.coverImagePublicId).toBe(NEW_COVER.publicId);
      // The tour stayed live throughout — a replacement is not an un-publish.
      expect(after!.status).toBe('PUBLISHED');
      expect(after!.catalogueOrder).toBe(before!.catalogueOrder);
    });

    it('bumps the brochure version on replacement and keeps the row when it is removed', async () => {
      const prisma = getOptionalPrismaClient();

      const first = {
        url: `${RAW}/brochure_v1.pdf`,
        publicId: 'gty/tours/zz-cms-test/brochure_v1',
        fileName: 'v1.pdf',
        sizeBytes: 1000,
      };
      const second = { ...first, url: `${RAW}/brochure_v2.pdf`, publicId: 'gty/tours/zz-cms-test/brochure_v2', fileName: 'v2.pdf' };

      await updateAtCurrentVersion(DRAFT_SLUG, { ...baseValues(), brochureFile: first }, 'draft');
      const v1 = await prisma!.brochure.findUnique({ where: { tourSlug: DRAFT_SLUG } });
      expect(v1!.status).toBe('PUBLISHED');
      expect(v1!.version).toBe(1);

      // A save that does not touch the brochure must not inflate the version.
      await updateAtCurrentVersion(DRAFT_SLUG, { ...baseValues(), brochureFile: first, priceFrom: '₹12,345' }, 'draft');
      expect((await prisma!.brochure.findUnique({ where: { tourSlug: DRAFT_SLUG } }))!.version).toBe(1);

      await updateAtCurrentVersion(DRAFT_SLUG, { ...baseValues(), brochureFile: second }, 'draft');
      const v2 = await prisma!.brochure.findUnique({ where: { tourSlug: DRAFT_SLUG } });
      expect(v2!.version).toBe(2);
      expect(v2!.pdfUrl).toBe(second.url);

      await updateAtCurrentVersion(DRAFT_SLUG, { ...baseValues(), brochureFile: undefined }, 'draft');
      const cleared = await prisma!.brochure.findUnique({ where: { tourSlug: DRAFT_SLUG } });
      // The RECORD survives with its metadata; only the file is detached. Nothing
      // hard-deletes a brochure (product-spec §7).
      expect(cleared).not.toBeNull();
      expect(cleared!.pdfUrl).toBeNull();
      expect(cleared!.status).toBe('PENDING_UPLOAD');
      expect(cleared!.title).toBe(v2!.title);
    });

    it('delivers an uploaded cover and gallery to the PUBLIC adapter, not just the admin one', async () => {
      const prisma = getOptionalPrismaClient();

      await updateAtCurrentVersion(
        DRAFT_SLUG,
        {
          ...baseValues(),
          coverImage: NEW_COVER,
          galleryImages: [
            { url: `${CDN}/g1.jpg`, publicId: 'g1' },
            { url: `${CDN}/g2.jpg`, publicId: 'g2' },
          ],
        },
        'publish'
      );

      const published = (await new PrismaContentAdapter(prisma!).getAllTours()).find(
        (tour) => tour.slug === DRAFT_SLUG
      );

      /**
       * The assertion that makes the whole feature real. Everything upstream can
       * be correct — the upload, the column, the publish gate — and a visitor
       * still sees a grey placeholder unless the value survives the public query
       * as well. That gap is the defect
       * `memory/feedback_qg_unenforced-safety-flag.md` exists for, and this is
       * where it would show.
       */
      expect(published?.coverImageUrl).toBe(NEW_COVER.url);
      expect(published?.galleryImageUrls).toEqual([`${CDN}/g1.jpg`, `${CDN}/g2.jpg`]);
      // Derived from the gallery, so it cannot contradict the strip beneath it.
      expect(published?.photosCount).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  /**
   * M7 of the 2026-09-19 review — two admins, one tour. Real SQL, because the
   * property that matters (the claim's row lock makes a concurrent save
   * re-evaluate its WHERE and lose) is Postgres behaviour a mock cannot show.
   */
  describe('concurrent edits are refused, not silently overwritten', () => {
    const SLUG = `${TEST_PREFIX}concurrency`;
    const prisma = () => getOptionalPrismaClient()!;
    const versionOf = async () =>
      (await prisma().tour.findUniqueOrThrow({ where: { slug: SLUG }, select: { updatedAt: true } })).updatedAt;

    beforeEach(async () => {
      await prisma().tour.deleteMany({ where: { slug: SLUG } });
      await createTour(baseValues({ slug: SLUG, name: 'Original' }), 'draft');
    });

    it('refuses a save made from a STALE version, and writes nothing at all', async () => {
      const loadedAt = await versionOf();

      // Admin B saves first.
      const b = await updateTour(SLUG, baseValues({ slug: SLUG, name: 'Saved by B' }), 'draft', loadedAt);
      expect(b.configured && b.value.outcome).toBe('saved');

      // Admin A, still holding the version from before B's save, now saves —
      // with a different itinerary, which the old code would have replaced B's with.
      const a = await updateTour(
        SLUG,
        baseValues({ slug: SLUG, name: 'Saved by A', itineraryDays: [{ title: 'A only', description: 'A.' }] }),
        'publish',
        loadedAt
      );
      expect(a.configured && a.value.outcome).toBe('conflict');

      const after = await getAdminTourBySlug(SLUG);
      if (!after.configured || !after.value) throw new Error('tour vanished');
      expect(after.value.form.name).toBe('Saved by B');
      expect(after.value.form.itineraryDays.map((d) => d.title)).toEqual(['Day one', 'Day two']);
      expect(after.value.status).toBe('DRAFT');
    });

    it('lets exactly ONE of two simultaneous saves from the same version through', async () => {
      const loadedAt = await versionOf();

      const [first, second] = await Promise.all([
        updateTour(SLUG, baseValues({ slug: SLUG, name: 'Racer One' }), 'draft', loadedAt),
        updateTour(SLUG, baseValues({ slug: SLUG, name: 'Racer Two' }), 'draft', loadedAt),
      ]);

      const outcomes = [first, second].map((r) => (r.configured ? r.value.outcome : 'unconfigured')).sort();
      expect(outcomes).toEqual(['conflict', 'saved']);

      const winner = first.configured && first.value.outcome === 'saved' ? 'Racer One' : 'Racer Two';
      const after = await getAdminTourBySlug(SLUG);
      expect(after.configured && after.value?.form.name).toBe(winner);
    });

    it('accepts the next save once the editor has the fresh version', async () => {
      await updateAtCurrentVersion(SLUG, baseValues({ slug: SLUG, name: 'First' }), 'draft');
      const second = await updateTour(SLUG, baseValues({ slug: SLUG, name: 'Second' }), 'draft', await versionOf());
      expect(second.configured && second.value.outcome).toBe('saved');
    });

    it('L2: the list toggles report a missing tour instead of throwing P2025', async () => {
      const gone = `${TEST_PREFIX}never-existed`;

      await expect(setTourStatus(gone, 'PUBLISHED')).resolves.toEqual({ configured: true, value: { found: false } });
      await expect(setTourArchived(gone, true)).resolves.toEqual({ configured: true, value: { found: false } });
      // And a real one still reports found.
      await expect(setTourArchived(SLUG, true)).resolves.toEqual({ configured: true, value: { found: true } });
    });

    it('reports a tour that no longer exists as missing, rather than throwing', async () => {
      const loadedAt = await versionOf();
      await prisma().tour.delete({ where: { slug: SLUG } });

      const result = await updateTour(SLUG, baseValues({ slug: SLUG }), 'draft', loadedAt);
      expect(result.configured && result.value.outcome).toBe('missing');
    });
  });
});
