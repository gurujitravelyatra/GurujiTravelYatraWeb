/**
 * @jest-environment node
 */

/**
 * REPLACEMENT SAFETY, database half — plus where the media actually lands.
 *
 * `cloudinary.test.ts` pins the property that a replacement never overwrites the
 * asset a live page is serving. This file pins the other half: WHEN the stored
 * pointer moves, and that it moves in one statement.
 *
 * The sequence being asserted is:
 *
 *   1. the new file uploads to Cloudinary (a separate request — the upload route
 *      writes nothing to the database at all);
 *   2. the admin presses Save;
 *   3. `pdfUrl` / `coverImageUrl` move to the new asset here, in one update.
 *
 * There is therefore no window in which a column names an asset that does not
 * exist yet, and an upload the admin abandons changes nothing — the tour is
 * never saved, so step 3 never happens.
 *
 * Prisma is mocked. These assertions are about which statements are issued with
 * which data; `tour-repository.integration.test.ts` is where real SQL runs.
 */

const mockGetOptionalPrismaClient = jest.fn();

jest.mock('@/server/db/prisma', () => ({
  getOptionalPrismaClient: () => mockGetOptionalPrismaClient(),
}));

import { createTour, getAdminTourBySlug, updateTour } from '../tour-repository';
import type { ParsedTourFormValues } from '../tour-form-schema';

const OLD_COVER = {
  url: 'https://res.cloudinary.com/demo/image/upload/v1/gty/tours/spiti/cover/old_aaa111.jpg',
  publicId: 'gty/tours/spiti/cover/old_aaa111',
};
const NEW_COVER = {
  url: 'https://res.cloudinary.com/demo/image/upload/v1/gty/tours/spiti/cover/new_bbb222.jpg',
  publicId: 'gty/tours/spiti/cover/new_bbb222',
};

const OLD_BROCHURE = {
  url: 'https://res.cloudinary.com/demo/raw/upload/v1/gty/tours/spiti/brochure/old_ccc333.pdf',
  publicId: 'gty/tours/spiti/brochure/old_ccc333',
  fileName: 'spiti-2025.pdf',
  sizeBytes: 1_000_000,
};
const NEW_BROCHURE = {
  url: 'https://res.cloudinary.com/demo/raw/upload/v1/gty/tours/spiti/brochure/new_ddd444.pdf',
  publicId: 'gty/tours/spiti/brochure/new_ddd444',
  fileName: 'spiti-2026.pdf',
  sizeBytes: 1_200_000,
};

function values(overrides: Partial<ParsedTourFormValues> = {}): ParsedTourFormValues {
  return {
    name: 'Spiti Valley Circuit',
    slug: 'spiti-valley-circuit',
    destinationSlug: 'spiti-valley',
    category: 'Adventure',
    audienceTags: [],
    durationLabel: '9 Days 8 Nights',
    subtitle: 'Shimla - Kaza - Chandratal',
    shortDescription: 'A high-altitude loop.',
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
    ...overrides,
  };
}

/** The version the editor was loaded at (M7). Any fixed instant — the claim is mocked. */
const LOADED_AT = new Date('2026-09-19T10:00:00.000Z');

interface MockTx {
  tour: { create: jest.Mock; update: jest.Mock; updateMany: jest.Mock; findFirst: jest.Mock; findUnique: jest.Mock };
  brochure: { findUnique: jest.Mock; update: jest.Mock; create: jest.Mock };
  tourItineraryDay: { deleteMany: jest.Mock };
  tourFaq: { deleteMany: jest.Mock };
  tourPricingTier: { deleteMany: jest.Mock };
  tourGalleryImage: { deleteMany: jest.Mock };
}

let tx: MockTx;

/** `existingBrochurePublicId: null` means a row with no file; `undefined` means no row. */
function setUpPrisma({ existingBrochurePublicId }: { existingBrochurePublicId?: string | null } = {}) {
  tx = {
    tour: {
      create: jest.fn().mockResolvedValue({ slug: 'spiti-valley-circuit' }),
      update: jest.fn().mockResolvedValue({ slug: 'spiti-valley-circuit' }),
      // M7: the version claim. One row = the editor's version was current.
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findFirst: jest.fn().mockResolvedValue({ catalogueOrder: 21 }),
      findUnique: jest.fn(),
    },
    brochure: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          existingBrochurePublicId === undefined ? null : { pdfPublicId: existingBrochurePublicId }
        ),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({}),
    },
    tourItineraryDay: { deleteMany: jest.fn().mockResolvedValue({}) },
    tourFaq: { deleteMany: jest.fn().mockResolvedValue({}) },
    tourPricingTier: { deleteMany: jest.fn().mockResolvedValue({}) },
    tourGalleryImage: { deleteMany: jest.fn().mockResolvedValue({}) },
  };

  mockGetOptionalPrismaClient.mockReturnValue({
    ...tx,
    $transaction: (callback: (client: MockTx) => Promise<unknown>) => callback(tx),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  setUpPrisma();
});

describe('replacing a cover image', () => {
  it('writes the NEW url and publicId in a single update', async () => {
    setUpPrisma();
    await updateTour('spiti-valley-circuit', values({ coverImage: NEW_COVER }), 'publish', LOADED_AT);

    const [[call]] = tx.tour.update.mock.calls;
    expect(call.data.coverImageUrl).toBe(NEW_COVER.url);
    expect(call.data.coverImagePublicId).toBe(NEW_COVER.publicId);

    /**
     * One statement, not a clear-then-set. Two statements would leave a window
     * — however brief, and inside a transaction it is invisible to readers
     * anyway — but more importantly they are two places for the pair to be
     * written inconsistently. The URL and the id are one value in two columns.
     */
    expect(tx.tour.update).toHaveBeenCalledTimes(1);
  });

  it('never issues a statement that mentions the OLD asset', async () => {
    setUpPrisma();
    await updateTour('spiti-valley-circuit', values({ coverImage: NEW_COVER }), 'publish', LOADED_AT);

    // The old asset is not deleted, not invalidated, not referenced. Its URL keeps
    // resolving, which is exactly why a replacement cannot break a live page.
    const everyStatement = JSON.stringify([
      tx.tour.update.mock.calls,
      tx.brochure.update.mock.calls,
      tx.brochure.create.mock.calls,
    ]);
    expect(everyStatement).not.toContain(OLD_COVER.publicId);
    expect(everyStatement).not.toContain(OLD_COVER.url);
  });

  it('clears both columns together when the cover is removed', async () => {
    setUpPrisma();
    await updateTour('spiti-valley-circuit', values({ coverImage: undefined }), 'draft', LOADED_AT);

    const [[call]] = tx.tour.update.mock.calls;
    // Not one null and one stale id — that pair would be a row nothing can read
    // honestly.
    expect(call.data.coverImageUrl).toBeNull();
    expect(call.data.coverImagePublicId).toBeNull();
  });
});

describe('replacing a brochure PDF', () => {
  it('repoints pdfUrl to the new asset and counts it as a new version', async () => {
    setUpPrisma({ existingBrochurePublicId: OLD_BROCHURE.publicId });
    await updateTour('spiti-valley-circuit', values({ brochureFile: NEW_BROCHURE }), 'publish', LOADED_AT);

    expect(tx.brochure.update).toHaveBeenCalledTimes(1);
    const [[call]] = tx.brochure.update.mock.calls;

    expect(call.data.pdfUrl).toBe(NEW_BROCHURE.url);
    expect(call.data.pdfPublicId).toBe(NEW_BROCHURE.publicId);
    expect(call.data.pdfFileName).toBe(NEW_BROCHURE.fileName);
    expect(call.data.version).toEqual({ increment: 1 });
    // A real file now backs the record, which is the only condition under which
    // `BrochureStatus` permits leaving PENDING_UPLOAD.
    expect(call.data.status).toBe('PUBLISHED');
  });

  it('leaves the old asset untouched — no destroy, no overwrite, no reference', async () => {
    setUpPrisma({ existingBrochurePublicId: OLD_BROCHURE.publicId });
    await updateTour('spiti-valley-circuit', values({ brochureFile: NEW_BROCHURE }), 'publish', LOADED_AT);

    const everyStatement = JSON.stringify(tx.brochure.update.mock.calls);
    expect(everyStatement).not.toContain(OLD_BROCHURE.publicId);
    expect(everyStatement).not.toContain(OLD_BROCHURE.url);
  });

  it('does NOT bump the version when the same file is saved again', async () => {
    // A save that edited the price must not inflate the brochure's version, or
    // the number stops meaning "how many times this document was replaced".
    setUpPrisma({ existingBrochurePublicId: OLD_BROCHURE.publicId });
    await updateTour('spiti-valley-circuit', values({ brochureFile: OLD_BROCHURE }), 'publish', LOADED_AT);

    expect(tx.brochure.update).not.toHaveBeenCalled();
    expect(tx.brochure.create).not.toHaveBeenCalled();
  });

  it('does not bump the version for the FIRST upload onto an empty brochure row', async () => {
    // Every seeded tour has a Brochure row with a NULL pdfUrl. The first real
    // upload is version 1, not version 2.
    setUpPrisma({ existingBrochurePublicId: null });
    await updateTour('spiti-valley-circuit', values({ brochureFile: NEW_BROCHURE }), 'publish', LOADED_AT);

    const [[call]] = tx.brochure.update.mock.calls;
    expect(call.data.pdfUrl).toBe(NEW_BROCHURE.url);
    expect(call.data.version).toBeUndefined();
  });

  it('returns the row to PENDING_UPLOAD when the brochure is removed, keeping the record', async () => {
    setUpPrisma({ existingBrochurePublicId: OLD_BROCHURE.publicId });
    await updateTour('spiti-valley-circuit', values({ brochureFile: undefined }), 'draft', LOADED_AT);

    const [[call]] = tx.brochure.update.mock.calls;
    expect(call.data.pdfUrl).toBeNull();
    expect(call.data.status).toBe('PENDING_UPLOAD');
    // The row survives: title, itinerary summary and download count are metadata
    // about the brochure, not about the file.
    expect(tx.brochure.update).toHaveBeenCalledWith(expect.objectContaining({ where: { tourSlug: 'spiti-valley-circuit' } }));
  });

  it('touches nothing when there is no brochure row and nothing was uploaded', async () => {
    setUpPrisma({ existingBrochurePublicId: undefined });
    await updateTour('spiti-valley-circuit', values({ brochureFile: undefined }), 'draft', LOADED_AT);

    expect(tx.brochure.update).not.toHaveBeenCalled();
    expect(tx.brochure.create).not.toHaveBeenCalled();
  });

  it('creates a brochure row, with seed-identical derived metadata, for an admin-created tour', async () => {
    setUpPrisma({ existingBrochurePublicId: undefined });
    await createTour(values({ brochureFile: NEW_BROCHURE }), 'draft');

    const [[call]] = tx.brochure.create.mock.calls;
    // Derived exactly as `prisma/seed.ts` derives them, so a brochure created
    // here is indistinguishable from a seeded one. Nothing invented:
    // `dateRangeLabel` stays null because tours carry no dates in this project.
    expect(call.data.title).toBe('Spiti Valley Circuit');
    expect(call.data.itinerarySummary).toBe('Shimla - Kaza - Chandratal');
    expect(call.data.dateRangeLabel).toBeNull();
    expect(call.data.pdfUrl).toBe(NEW_BROCHURE.url);
    expect(call.data.status).toBe('PUBLISHED');
  });

  /**
   * The bug this guards against is specific and would be invisible: every FK to
   * `Tour.slug` is ON UPDATE CASCADE, so by the time the brochure is synced the
   * row has ALREADY followed the rename. Looking it up under the old slug would
   * find nothing, create a second brochure, and hit the `@@unique` constraint.
   */
  it('finds the brochure under the NEW slug after a rename', async () => {
    setUpPrisma({ existingBrochurePublicId: OLD_BROCHURE.publicId });
    tx.tour.update.mockResolvedValue({ slug: 'spiti-valley-circuit-2026' });

    await updateTour('spiti-valley-circuit', values({ slug: 'spiti-valley-circuit-2026', brochureFile: NEW_BROCHURE }), 'draft', LOADED_AT);

    expect(tx.brochure.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tourSlug: 'spiti-valley-circuit-2026' } })
    );
  });
});

describe('the gallery', () => {
  it('replaces the rows and renumbers sortOrder from array position', async () => {
    setUpPrisma();
    const gallery = [
      { url: `${NEW_COVER.url}#a`, publicId: 'a' },
      { url: `${NEW_COVER.url}#b`, publicId: 'b' },
      { url: `${NEW_COVER.url}#c`, publicId: 'c' },
    ];

    await updateTour('spiti-valley-circuit', values({ galleryImages: gallery }), 'draft', LOADED_AT);

    // Deleted before created — the unique constraint on (tourSlug, sortOrder)
    // makes that ordering load-bearing.
    expect(tx.tourGalleryImage.deleteMany).toHaveBeenCalledWith({ where: { tourSlug: 'spiti-valley-circuit' } });

    const [[call]] = tx.tour.update.mock.calls;
    expect(call.data.galleryImages.create.map((image: { sortOrder: number; publicId: string }) => [image.publicId, image.sortOrder])).toEqual([
      ['a', 0],
      ['b', 1],
      ['c', 2],
    ]);
  });

  /**
   * `photosCount` is NOT written on update, and this is a regression test for a
   * real defect rather than a hypothetical.
   *
   * It was briefly derived here as `galleryImages.length`, which is tidy and
   * wrong: `photosCount` is not a form field, so writing it made editing a
   * tour's DESCRIPTION silently change its photo count. The live integration
   * suite caught it going 11 → 0 on the first seeded tour it touched. The count
   * is derived at READ time instead (`PrismaContentAdapter`), where it cannot
   * disagree with the gallery and cannot be moved by an unrelated edit.
   */
  it('does NOT write photosCount on update, whatever the gallery holds', async () => {
    setUpPrisma();
    const gallery = [
      { url: `${NEW_COVER.url}#a`, publicId: 'a' },
      { url: `${NEW_COVER.url}#b`, publicId: 'b' },
    ];

    await updateTour('spiti-valley-circuit', values({ galleryImages: gallery }), 'draft', LOADED_AT);

    const [[call]] = tx.tour.update.mock.calls;
    expect(call.data).not.toHaveProperty('photosCount');
  });

  it('does not write photosCount on update even when the gallery is emptied', async () => {
    setUpPrisma();
    await updateTour('spiti-valley-circuit', values({ galleryImages: [] }), 'draft', LOADED_AT);

    const [[call]] = tx.tour.update.mock.calls;
    expect(call.data).not.toHaveProperty('photosCount');
  });

  it('sets photosCount to 0 on CREATE, where there is no inherited figure', async () => {
    setUpPrisma();
    await createTour(values(), 'draft');

    const [[call]] = tx.tour.create.mock.calls;
    expect(call.data.photosCount).toBe(0);
  });
});

describe('reading a tour back into the form', () => {
  it('round-trips media, so loading and re-saving changes nothing', async () => {
    const prisma = {
      tour: {
        findUnique: jest.fn().mockResolvedValue({
          slug: 'spiti-valley-circuit',
          name: 'Spiti Valley Circuit',
          destinationSlug: 'spiti-valley',
          category: 'Adventure',
          audienceTags: [],
          durationLabel: '9 Days 8 Nights',
          subtitle: 'Shimla - Kaza - Chandratal',
          shortDescription: 'A high-altitude loop.',
          fullDescription: null,
          bestTimeToVisit: null,
          priceFrom: '₹42,500',
          priceWas: null,
          savingsLabel: null,
          seatsLabel: null,
          isHot: false,
          inclusions: [],
          exclusions: [],
          status: 'PUBLISHED',
          archivedAt: null,
          updatedAt: new Date('2026-09-18T00:00:00Z'),
          itineraryDays: [],
          faqs: [],
          pricingTiers: [],
          coverImageUrl: OLD_COVER.url,
          coverImagePublicId: OLD_COVER.publicId,
          galleryImages: [
            { url: 'https://res.cloudinary.com/demo/image/upload/v1/a.jpg', publicId: 'a', width: 100, height: 80 },
          ],
          brochure: {
            pdfUrl: OLD_BROCHURE.url,
            pdfPublicId: OLD_BROCHURE.publicId,
            pdfFileName: OLD_BROCHURE.fileName,
            fileSizeBytes: OLD_BROCHURE.sizeBytes,
          },
        }),
      },
    };
    mockGetOptionalPrismaClient.mockReturnValue(prisma);

    const result = await getAdminTourBySlug('spiti-valley-circuit');

    expect(result.configured).toBe(true);
    if (!result.configured || result.value === null) throw new Error('expected a tour');

    expect(result.value.form.coverImage).toEqual(OLD_COVER);
    expect(result.value.form.galleryImages).toEqual([
      { url: 'https://res.cloudinary.com/demo/image/upload/v1/a.jpg', publicId: 'a', width: 100, height: 80 },
    ]);
    expect(result.value.form.brochureFile).toEqual(OLD_BROCHURE);
  });

  it('reports NO cover when only one of the two columns is set', async () => {
    /**
     * A row holding a URL with no publicId (or the reverse) is data this code has
     * no honest reading of. Surfacing half of it would let the next save write
     * the half back and make the inconsistency permanent — and, because the
     * cover is required to publish, would let a tour publish on a cover the
     * system cannot manage.
     */
    const prisma = {
      tour: {
        findUnique: jest.fn().mockResolvedValue({
          slug: 'x', name: 'X', destinationSlug: 'spiti-valley', category: 'Adventure',
          audienceTags: [], durationLabel: '', subtitle: '', shortDescription: null,
          fullDescription: null, bestTimeToVisit: null, priceFrom: '', priceWas: null,
          savingsLabel: null, seatsLabel: null, isHot: false, inclusions: [], exclusions: [],
          status: 'DRAFT', archivedAt: null, updatedAt: new Date(),
          itineraryDays: [], faqs: [], pricingTiers: [], galleryImages: [], brochure: null,
          coverImageUrl: OLD_COVER.url,
          coverImagePublicId: null,
        }),
      },
    };
    mockGetOptionalPrismaClient.mockReturnValue(prisma);

    const result = await getAdminTourBySlug('x');
    if (!result.configured || result.value === null) throw new Error('expected a tour');

    expect(result.value.form.coverImage).toBeUndefined();
  });
});

describe('no database configured', () => {
  it('reports unconfigured rather than throwing', async () => {
    mockGetOptionalPrismaClient.mockReturnValue(null);

    expect((await updateTour('x', values(), 'draft', LOADED_AT)).configured).toBe(false);
    expect((await createTour(values(), 'draft')).configured).toBe(false);
    expect((await getAdminTourBySlug('x')).configured).toBe(false);
  });
});

/**
 * M7 of the 2026-09-19 review — the version claim, against a mocked client.
 * The live suite proves the Postgres locking behaviour; this pins the ORDER:
 * the claim is the first write, and a failed claim writes nothing else.
 */
describe('an edit from a stale version writes nothing', () => {
  it('claims the row on (slug, updatedAt) before any other write', async () => {
    await updateTour('spiti-valley-circuit', values(), 'draft', LOADED_AT);

    expect(tx.tour.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: 'spiti-valley-circuit', updatedAt: LOADED_AT } })
    );
    const claimOrder = tx.tour.updateMany.mock.invocationCallOrder[0];
    expect(claimOrder).toBeLessThan(tx.tourItineraryDay.deleteMany.mock.invocationCallOrder[0]);
    expect(claimOrder).toBeLessThan(tx.tour.update.mock.invocationCallOrder[0]);
  });

  it('returns a conflict and deletes/updates nothing when someone saved since', async () => {
    tx.tour.updateMany.mockResolvedValue({ count: 0 });
    tx.tour.findUnique.mockResolvedValue({ slug: 'spiti-valley-circuit' });

    const result = await updateTour('spiti-valley-circuit', values(), 'publish', LOADED_AT);

    expect(result).toEqual({ configured: true, value: { outcome: 'conflict' } });
    for (const mock of [
      tx.tourItineraryDay.deleteMany,
      tx.tourFaq.deleteMany,
      tx.tourPricingTier.deleteMany,
      tx.tourGalleryImage.deleteMany,
      tx.tour.update,
      tx.brochure.update,
      tx.brochure.create,
    ]) {
      expect(mock).not.toHaveBeenCalled();
    }
  });

  it('returns missing, not a thrown P2025, when the tour is gone', async () => {
    tx.tour.updateMany.mockResolvedValue({ count: 0 });
    tx.tour.findUnique.mockResolvedValue(null);

    const result = await updateTour('spiti-valley-circuit', values(), 'draft', LOADED_AT);

    expect(result).toEqual({ configured: true, value: { outcome: 'missing' } });
    expect(tx.tour.update).not.toHaveBeenCalled();
  });

  it('reports the saved slug on success', async () => {
    const result = await updateTour('spiti-valley-circuit', values(), 'draft', LOADED_AT);
    expect(result).toEqual({ configured: true, value: { outcome: 'saved', slug: 'spiti-valley-circuit' } });
  });
});
