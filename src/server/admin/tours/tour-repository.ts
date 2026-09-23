import 'server-only';
import type { PrismaClient } from '@prisma/client';

import { getOptionalPrismaClient } from '@/server/db/prisma';
import { CATEGORY_TO_PRISMA, toDomainCategory } from '@/content/adapters/prisma-category';
import { AUDIENCE_TAG_TO_PRISMA, toDomainAudienceTag } from '@/content/adapters/prisma-audience-tag';
import type { DestinationCategory, TourStatus } from '@/content/types';

import { sanitizeTourFormValues } from './sanitize-tour-text';
import type { ParsedTourFormValues, SubmitIntent } from './tour-form-schema';

/**
 * Admin-side tour reads and writes — Phase B of the admin CMS.
 *
 * ## This module deliberately BYPASSES the public-listing gate, and that is the
 * one thing to keep straight about it
 *
 * `src/content/*` exists to serve the PUBLIC site and every query there ends in
 * `isPubliclyListable()`, which withholds drafts, archived tours and
 * unconfirmed-price tours. An admin who could only see publicly-listable tours
 * could never find the draft they were editing — so nothing here goes through
 * `contentAdapter`, and these queries intentionally return rows the public may
 * not see.
 *
 * That makes the boundary between this file and `src/content/` a SECURITY
 * boundary, not a layering preference:
 *
 *  - nothing in `src/content/` may import from here;
 *  - nothing here may be imported by a public page, component or API route;
 *  - every exported function is reachable only from `/admin/*`, behind
 *    `requireAdminSession()`.
 *
 * `import 'server-only'` makes the first failure a BUILD error rather than a
 * shipped bundle: if a client component ever imports this, the build breaks.
 * It is not a substitute for the session check — each caller still performs
 * that itself, per the rule in `src/server/auth/session.ts`.
 *
 * ## "No database configured" is a supported state
 *
 * `getOptionalPrismaClient()` returns null when `DATABASE_URL` is unset, which
 * is the mode `npm test`, `next build` and the Playwright suite run in. Every
 * entry point here returns a discriminated "unconfigured" result rather than
 * throwing, so the admin UI can say so plainly instead of 500ing — the same
 * choice `brochureAdapter: null` makes for the public side.
 */

export type AdminTourLifecycle = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

/**
 * The DISPLAY state shown in the admin list, which is NOT the `status` column.
 *
 * `status` and `archivedAt` are independent in the database on purpose (an
 * archived tour remembers whether it was live). The admin list has one "Status"
 * column, so the two facts are flattened for display ONLY, here, with archive
 * winning because that is the state that determines what a visitor sees.
 *
 * Nothing persists this value and nothing gates on it — the gate is
 * `isPubliclyListable()`, which reads the two real fields.
 */
export function toLifecycle(row: { status: string; archivedAt: Date | null }): AdminTourLifecycle {
  if (row.archivedAt !== null) return 'ARCHIVED';
  return row.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT';
}

export interface AdminTourListItem {
  slug: string;
  name: string;
  category: DestinationCategory;
  destinationName: string;
  photoKey: string;
  /**
   * The uploaded cover, when there is one — Phase C columns, surfaced to the
   * admin list in Phase E.
   *
   * The list rendered a hard-coded emoji tile under a comment asserting "No
   * cover images exist yet — uploads are Phase C", which stopped being true the
   * day uploads shipped. An admin who uploaded a cover had no way to confirm
   * from the list that it took.
   */
  coverImageUrl: string | null;
  lifecycle: AdminTourLifecycle;
  /** `priceFrom` when the tour uses a single price; null when it uses tiers. */
  priceFrom: string | null;
  /** Number of `TourPricingTier` rows — 0 means "single price". */
  pricingTierCount: number;
  pricingUnverified: boolean;
  /**
   * The two REAL lifecycle columns, carried alongside the flattened
   * {@link AdminTourLifecycle} above.
   *
   * `lifecycle` is a display flattening and is explicitly not a gate (see
   * `toLifecycle`). These are what `publicWithholdReason()` reads, and they are
   * surfaced here so the admin list can call THE public predicate rather than
   * re-deriving public visibility from a display string — which is how the list
   * came to show a green "Published" pill for a tour the public site was
   * withholding.
   */
  status: TourStatus;
  archivedAt: Date | null;
  updatedAt: Date;
}

/**
 * One tour, split into the two things a caller wants separately.
 *
 * `form` is EXACTLY the shape the editor submits, so a round-trip (load → save
 * unchanged) is a no-op and the publish check can be run over stored data with
 * the same schema the form uses. The lifecycle fields sit beside it rather than
 * being spread into it, because they are NOT editable through the form —
 * flattening them would invite `{ ...detail }` to be passed as form values, and
 * the fields the form does not own would ride along into a write.
 */
export interface AdminTourDetail {
  form: ParsedTourFormValues;
  lifecycle: AdminTourLifecycle;
  status: TourStatus;
  archivedAt: Date | null;
  /**
   * NOT a form field — it sits here with the other lifecycle facts for exactly
   * that reason, and `toColumnData` still refuses to write it. The editor READS
   * it to explain why a published tour is not on the site; there is deliberately
   * no way to CLEAR it from the admin UI (the user's decision, 2026-09-19), so
   * it stays developer-managed and a save cannot silently un-flag a tour.
   */
  pricingUnverified: boolean;
  updatedAt: Date;
}

export interface DestinationOption {
  slug: string;
  name: string;
}

/** `null` = no database configured. */
type Configured<T> = { configured: true; value: T } | { configured: false };

function unconfigured<T>(): Configured<T> {
  return { configured: false };
}

export type TourStatusFilter = 'ALL' | AdminTourLifecycle;

export interface ListToursFilter {
  /**
   * Defaults to hiding archived tours. The DEFAULT admin view excludes them (the
   * task's requirement and the sane default — an archived tour is retired), but
   * they stay findable under the `ARCHIVED` and `ALL` options, because the whole
   * point of archiving over deleting is that the record can be found later.
   */
  status?: TourStatusFilter;
  category?: DestinationCategory | 'ALL';
  /** Free-text match on name or slug. */
  search?: string;
}

/**
 * The Prisma `where` for each filter option.
 *
 * `DRAFT`/`PUBLISHED` both require `archivedAt: null` — an archived tour must
 * not appear under a lifecycle filter, or "Draft" would list retired tours
 * alongside work in progress.
 */
function lifecycleWhere(status: TourStatusFilter | undefined) {
  switch (status) {
    case 'ARCHIVED':
      return { archivedAt: { not: null } };
    case 'PUBLISHED':
      return { archivedAt: null, status: 'PUBLISHED' as const };
    case 'DRAFT':
      return { archivedAt: null, status: 'DRAFT' as const };
    case 'ALL':
      return {};
    default:
      // The default view: everything except archived.
      return { archivedAt: null };
  }
}

export async function listAdminTours(filter: ListToursFilter = {}): Promise<Configured<AdminTourListItem[]>> {
  const prisma = getOptionalPrismaClient();
  if (!prisma) return unconfigured();

  const search = filter.search?.trim();

  const rows = await prisma.tour.findMany({
    where: {
      ...lifecycleWhere(filter.status),
      ...(filter.category && filter.category !== 'ALL'
        ? { category: CATEGORY_TO_PRISMA[filter.category] }
        : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { slug: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    },
    include: {
      destination: { select: { name: true } },
      _count: { select: { pricingTiers: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return {
    configured: true,
    value: rows.map((row) => ({
      slug: row.slug,
      name: row.name,
      category: toDomainCategory(row.category),
      destinationName: row.destination.name,
      photoKey: row.photoKey,
      coverImageUrl: row.coverImageUrl,
      lifecycle: toLifecycle(row),
      // A tour with tiers shows "N tiers" instead of a single figure, so the
      // single price is withheld here rather than rendered beside them — showing
      // both would imply a base price the tiered tour does not sell at.
      priceFrom: row._count.pricingTiers > 0 ? null : row.priceFrom,
      pricingTierCount: row._count.pricingTiers,
      pricingUnverified: row.pricingUnverified,
      status: row.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
      archivedAt: row.archivedAt,
      updatedAt: row.updatedAt,
    })),
  };
}

export async function listDestinationOptions(): Promise<Configured<DestinationOption[]>> {
  const prisma = getOptionalPrismaClient();
  if (!prisma) return unconfigured();

  const rows = await prisma.destination.findMany({
    select: { slug: true, name: true },
    orderBy: { name: 'asc' },
  });
  return { configured: true, value: rows };
}

/**
 * One tour, in FORM SHAPE, with every child collection.
 *
 * Returns the same object the form submits, so the edit page has nothing to
 * translate and a round-trip (load → save with no changes) is a no-op. A
 * separate "detail" shape that the form then mapped into its own would be two
 * mappings to keep in step, and the failure mode of that drift is a field that
 * silently resets to empty when the admin saves — which is the "existing data
 * isn't corrupted" property the edit tests assert.
 */
export async function getAdminTourBySlug(slug: string): Promise<Configured<AdminTourDetail | null>> {
  const prisma = getOptionalPrismaClient();
  if (!prisma) return unconfigured();

  const row = await prisma.tour.findUnique({
    where: { slug },
    include: {
      itineraryDays: { orderBy: { dayNumber: 'asc' } },
      faqs: { orderBy: { sortOrder: 'asc' } },
      pricingTiers: { orderBy: { sortOrder: 'asc' } },
      galleryImages: { orderBy: { sortOrder: 'asc' } },
      /**
       * The brochure comes back as part of the TOUR because that is how the
       * editor presents it — one "Images & brochure" section, one save. The row
       * lives in its own table (see `Brochure.pdfUrl`'s note on why there is no
       * `Tour.brochurePdfUrl`), but that is a storage fact the form does not need
       * to know.
       */
      brochure: {
        select: { pdfUrl: true, pdfPublicId: true, pdfFileName: true, fileSizeBytes: true },
      },
    },
  });

  if (!row) return { configured: true, value: null };

  return {
    configured: true,
    value: {
      form: {
        name: row.name,
        slug: row.slug,
        destinationSlug: row.destinationSlug,
        category: toDomainCategory(row.category),
        audienceTags: row.audienceTags.map((tag) => toDomainAudienceTag(tag)),
        // `|| undefined` rather than `??`: these columns are NOT NULL and hold
        // '' for "not written yet" (see `toColumnData`). An empty string must
        // read as absent, or `publishableTourSchema` would accept it.
        durationLabel: row.durationLabel || undefined,
        subtitle: row.subtitle || undefined,
        shortDescription: row.shortDescription ?? undefined,
        fullDescription: row.fullDescription ?? undefined,
        bestTimeToVisit: row.bestTimeToVisit ?? undefined,
        priceFrom: row.priceFrom || undefined,
        priceWas: row.priceWas ?? undefined,
        savingsLabel: row.savingsLabel ?? undefined,
        seatsLabel: row.seatsLabel ?? undefined,
        isHot: row.isHot,
        inclusions: row.inclusions,
        exclusions: row.exclusions,
        itineraryDays: row.itineraryDays.map((day) => ({ title: day.title, description: day.description })),
        faqs: row.faqs.map((faq) => ({ question: faq.question, answer: faq.answer })),
        pricingTiers: row.pricingTiers.map((tier) => ({
          name: tier.name,
          price: tier.price,
          description: tier.description ?? undefined,
        })),

        /**
         * MEDIA — Phase C. `coverImageUrl` and `coverImagePublicId` are two
         * columns but one value, so they collapse into a single optional object:
         * the form cannot then represent "a URL with no publicId", and neither
         * can a round-trip through it.
         *
         * The pair is only surfaced when BOTH are present. A row holding one and
         * not the other would be data this code has no honest reading of, and
         * passing half of it to the form would let a save write the half back and
         * make the inconsistency permanent.
         */
        coverImage:
          row.coverImageUrl && row.coverImagePublicId
            ? { url: row.coverImageUrl, publicId: row.coverImagePublicId }
            : undefined,

        galleryImages: row.galleryImages.map((image) => ({
          url: image.url,
          publicId: image.publicId,
          width: image.width ?? undefined,
          height: image.height ?? undefined,
        })),

        // Same all-or-nothing rule as `coverImage` above.
        brochureFile:
          row.brochure?.pdfUrl && row.brochure.pdfPublicId
            ? {
                url: row.brochure.pdfUrl,
                publicId: row.brochure.pdfPublicId,
                fileName: row.brochure.pdfFileName ?? 'brochure.pdf',
                sizeBytes: row.brochure.fileSizeBytes ?? 0,
              }
            : undefined,
      },
      lifecycle: toLifecycle(row),
      status: row.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
      archivedAt: row.archivedAt,
      pricingUnverified: row.pricingUnverified,
      updatedAt: row.updatedAt,
    },
  };
}

export type SlugConflict = { taken: true; archived: boolean } | { taken: false };

/**
 * Is this slug already used by a DIFFERENT tour?
 *
 * Checks archived tours too, and reports which it hit. An archived tour still
 * occupies its slug — the row is never deleted (product-spec §7) — so "that URL
 * is free because the tour is retired" is false, and an admin who is told only
 * "slug taken" would go looking for a tour that the default list view does not
 * show. The message names the archive so the search is findable.
 */
export async function findSlugConflict(slug: string, excludeSlug?: string): Promise<Configured<SlugConflict>> {
  const prisma = getOptionalPrismaClient();
  if (!prisma) return unconfigured();

  if (excludeSlug && slug === excludeSlug) return { configured: true, value: { taken: false } };

  const existing = await prisma.tour.findUnique({ where: { slug }, select: { archivedAt: true } });
  return {
    configured: true,
    value: existing ? { taken: true, archived: existing.archivedAt !== null } : { taken: false },
  };
}

/**
 * Form values → the column set shared by create and update.
 *
 * Note what is NOT here: `status`, `archivedAt`, `catalogueOrder`, `popularOrder`
 * and `pricingUnverified`. Those are lifecycle/curation fields the tour FORM
 * does not own — writing them from this mapper is how an edit to a description
 * would silently reset a tour's rail position or clear a safety flag. They are
 * set explicitly by the functions that are actually entitled to change them.
 */
function toColumnData(values: ParsedTourFormValues) {
  return {
    name: values.name,
    destinationSlug: values.destinationSlug,
    category: CATEGORY_TO_PRISMA[values.category],
    audienceTags: values.audienceTags.map((tag) => AUDIENCE_TAG_TO_PRISMA[tag]),
    // These four columns are NOT NULL in the schema with no default, so an
    // absent optional becomes '' rather than null. Empty string is the honest
    // "not written yet" for a required text column, and `publishableTourSchema`
    // is what stops an empty one reaching the public site.
    durationLabel: values.durationLabel ?? '',
    subtitle: values.subtitle ?? '',
    priceFrom: values.priceFrom ?? '',
    shortDescription: values.shortDescription ?? null,
    fullDescription: values.fullDescription ?? null,
    bestTimeToVisit: values.bestTimeToVisit ?? null,
    priceWas: values.priceWas ?? null,
    savingsLabel: values.savingsLabel ?? null,
    seatsLabel: values.seatsLabel ?? null,
    isHot: values.isHot,
    inclusions: values.inclusions,
    exclusions: values.exclusions,

    /**
     * MEDIA — Phase C. Written as a PAIR, always, including the null case: a
     * removed cover clears both columns in the same statement, so the two cannot
     * end up describing different assets.
     */
    coverImageUrl: values.coverImage?.url ?? null,
    coverImagePublicId: values.coverImage?.publicId ?? null,
  };

  /**
   * NOTE WHAT IS STILL NOT HERE: `photosCount`.
   *
   * It was briefly written from here as `values.galleryImages.length`, on the
   * reasoning that a derived count cannot disagree with the gallery it counts.
   * The live integration suite rejected it, and was right to: `photosCount` is
   * not a form field, so writing it made editing a tour's DESCRIPTION silently
   * change its photo count — 11 to 0 on the first seeded tour the suite touched.
   * That is exactly the class of side effect the list above exists to prevent,
   * and the test that caught it ("editing one field of a live seeded tour leaves
   * every other field untouched") is more valuable than the tidiness it blocked.
   *
   * The count is instead DERIVED AT READ TIME by `PrismaContentAdapter`, which
   * returns the gallery's length when a gallery exists and the stored column
   * when it does not. So a tour with uploads cannot show a count that contradicts
   * its own gallery strip, and a tour without uploads keeps the figure it has
   * always had rather than having it rewritten by an unrelated edit.
   */
}

/**
 * Child rows, renumbered from the array order on every save.
 *
 * Ordering is DERIVED from position rather than collected from the form, so a
 * removed middle row cannot leave a gap that violates
 * `@@unique([tourSlug, dayNumber])`, and two rows cannot claim the same index.
 */
function childCreates(values: ParsedTourFormValues) {
  return {
    itineraryDays: values.itineraryDays.map((day, index) => ({
      dayNumber: index + 1,
      title: day.title,
      description: day.description,
    })),
    faqs: values.faqs.map((faq, index) => ({
      question: faq.question,
      answer: faq.answer,
      sortOrder: index,
    })),
    pricingTiers: values.pricingTiers.map((tier, index) => ({
      name: tier.name,
      price: tier.price,
      description: tier.description ?? null,
      sortOrder: index,
    })),
    /**
     * Gallery order IS array order — the up/down buttons in the editor reorder
     * the array and `sortOrder` is rewritten from scratch here, so it is
     * contiguous from 0 by construction and `@@unique([tourSlug, sortOrder])`
     * cannot be violated by a removal from the middle.
     */
    galleryImages: values.galleryImages.map((image, index) => ({
      url: image.url,
      publicId: image.publicId,
      width: image.width ?? null,
      height: image.height ?? null,
      sortOrder: index,
    })),
  };
}

/**
 * Writes the tour's brochure PDF into the `Brochure` table — Phase C.
 *
 * ## Why the brochure is written here and not as a column on `Tour`
 *
 * `Brochure` already exists, already holds `pdfUrl`, and is already what
 * `GET /api/brochures/[slug]` and `BrochureModal` read. A `Tour.brochurePdfUrl`
 * column would have produced an admin UI showing a successfully uploaded
 * brochure while the public endpoint continued to answer `pdfUrl: null, status:
 * PENDING_UPLOAD` — the two-models-one-entity drift recorded as variant 4 in
 * `memory/feedback_qg_unenforced-safety-flag.md`. Writing to the table the
 * readers already read is what makes the upload actually reach a visitor.
 *
 * ## Replacement safety, the database half
 *
 * The Cloudinary half is in `uploadAsset()`: a replacement is a new asset with a
 * new `public_id`, never an overwrite. This is the half that decides WHEN the
 * pointer moves — and it moves here, inside the same transaction as the rest of
 * the save, strictly after the upload returned a URL. So the sequence for
 * replacing a live tour's brochure is:
 *
 *   1. new PDF uploads to Cloudinary, old asset untouched and still serving;
 *   2. admin presses Save;
 *   3. this row's `pdfUrl` moves to the new asset, in one statement.
 *
 * There is no window in which `pdfUrl` names an asset that does not exist yet,
 * and an upload the admin abandons changes nothing at all.
 *
 * `version` is incremented only on a genuine replacement — a save that did not
 * touch the brochure must not inflate the count, or the number stops meaning
 * anything.
 */
async function syncBrochure(
  tx: Pick<PrismaClient, 'brochure'>,
  tourSlug: string,
  values: ParsedTourFormValues
): Promise<void> {
  const existing = await tx.brochure.findUnique({
    where: { tourSlug },
    select: { pdfPublicId: true },
  });

  const file = values.brochureFile;

  if (!file) {
    // Nothing submitted and nothing stored — the ordinary case for the 22 seeded
    // tours, and there is nothing to do.
    if (!existing || existing.pdfPublicId === null) return;

    /**
     * The admin removed the brochure. The FILE fields are cleared and the row is
     * KEPT: `Brochure` also holds title, itinerary summary and download count,
     * which are metadata about the tour's brochure rather than about the file,
     * and deleting the row would discard them. `PENDING_UPLOAD` is exactly the
     * state this returns to — the same one every seeded row is in.
     *
     * The Cloudinary asset is deliberately not destroyed; see `uploadAsset()`.
     */
    await tx.brochure.update({
      where: { tourSlug },
      data: {
        pdfUrl: null,
        pdfPublicId: null,
        pdfFileName: null,
        fileSizeBytes: null,
        uploadedAt: null,
        status: 'PENDING_UPLOAD',
      },
    });
    return;
  }

  // Submitted unchanged — a save of some other field. Touching nothing here keeps
  // `uploadedAt` and `version` meaning what they say.
  if (existing && existing.pdfPublicId === file.publicId) return;

  const fileFields = {
    pdfUrl: file.url,
    pdfPublicId: file.publicId,
    pdfFileName: file.fileName,
    fileSizeBytes: file.sizeBytes,
    uploadedAt: new Date(),
    /**
     * PUBLISHED because a real file now backs the record, which is the condition
     * the enum's own note sets: "A brochure may only move to PUBLISHED when a
     * real file backs it." This is the first code in the project that can
     * truthfully move a row out of PENDING_UPLOAD.
     */
    status: 'PUBLISHED' as const,
  };

  if (existing) {
    await tx.brochure.update({
      where: { tourSlug },
      data: {
        ...fileFields,
        // A genuine replacement only when a different file was there before.
        ...(existing.pdfPublicId !== null ? { version: { increment: 1 } } : {}),
      },
    });
    return;
  }

  /**
   * No brochure row yet — a tour created through the admin UI, since every
   * SEEDED tour has one. The metadata is derived from the tour exactly as
   * `prisma/seed.ts` derives it, so a brochure created here is indistinguishable
   * from a seeded one. Nothing is invented: `dateRangeLabel` stays NULL because
   * tours carry no dates anywhere in this project.
   */
  await tx.brochure.create({
    data: {
      tourSlug,
      title: values.name,
      itinerarySummary: values.subtitle ?? '',
      priceLabel: values.priceFrom ?? null,
      dateRangeLabel: null,
      coverImageKey: values.destinationSlug,
      category: CATEGORY_TO_PRISMA[values.category],
      ...fileFields,
    },
  });
}

/**
 * Transaction budget for the save path, widened from Prisma's 5-second default.
 *
 * Not a guess and not defensive padding — the default was measured failing.
 * Phase C added one more round trip inside the save (the brochure lookup), and
 * over the managed Postgres proxy this project connects through, that was enough
 * to push a save past 5s and abort it with "Transaction not found. Transaction ID
 * is invalid, refers to an old closed transaction". The failure is intermittent,
 * which is the dangerous part: it would have shipped and then eaten roughly one
 * save in five, at random, with a generic "Saving failed" in front of it.
 *
 * `prisma/seed.ts` reached the same conclusion independently and carries the same
 * two options with the same reasoning — `maxWait` covers the initial wait for a
 * pool connection over a slow link, `timeout` covers the work itself. The numbers
 * here are smaller than the seed's because this is one tour rather than the whole
 * catalogue, but they are generous against a link whose ordinary latency is tens
 * of milliseconds: the point is to survive a slow connection, not to hide a slow
 * query.
 *
 * BLOCKERS.md item 10 records the proxy's `P1001` behaviour this sits alongside.
 */
const SAVE_TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 30_000 } as const;

/** The status a submit intent writes. `'draft'` un-publishes; see `SUBMIT_INTENTS`. */
function statusForIntent(intent: SubmitIntent): TourStatus {
  return intent === 'publish' ? 'PUBLISHED' : 'DRAFT';
}

/**
 * The parameter is named `rawValues` and immediately shadowed by a sanitized
 * `values` in both writers below, so there is no name in scope after line one
 * that holds un-cleaned text. See `sanitize-tour-text.ts` for what this buys and
 * why it lives here — in the repository, the last thing before the database —
 * rather than in the Zod schema the form shares with the browser.
 */
export async function createTour(
  rawValues: ParsedTourFormValues,
  intent: SubmitIntent
): Promise<Configured<{ slug: string }>> {
  const prisma = getOptionalPrismaClient();
  if (!prisma) return unconfigured();

  const values = sanitizeTourFormValues(rawValues);
  const children = childCreates(values);

  const created = await prisma.$transaction(async (tx) => {
    /**
     * `catalogueOrder` is `@unique` and NOT NULL, so a new tour needs one.
     * Appended at the end (max + 1) rather than inserted into the sequence: the
     * existing order is an authored design decision (see the column's note), and
     * a new tour has no claim to a position within it. Inside the transaction so
     * two simultaneous creates cannot read the same max.
     */
    const last = await tx.tour.findFirst({ orderBy: { catalogueOrder: 'desc' }, select: { catalogueOrder: true } });
    const catalogueOrder = (last?.catalogueOrder ?? -1) + 1;

    const tour = await tx.tour.create({
      data: {
        ...toColumnData(values),
        slug: values.slug,
        status: statusForIntent(intent),
        catalogueOrder,
        /**
         * The PLACEHOLDER key, still written and still opaque (Assumption A4).
         * It is not superseded by `coverImageUrl`: it is the fallback the card
         * renders when no cover has been uploaded, which is every new tour at the
         * moment of creation and every draft saved before the photos arrived.
         * `PhotoPlaceholder` reads `coverImageUrl` first and falls back to this.
         */
        photoKey: values.destinationSlug,
        /**
         * ZERO, and honestly so: a tour created here has no design-export figure
         * to inherit, and the real count of uploaded photos is whatever its
         * gallery holds. Set only on CREATE — `toColumnData` deliberately does
         * not write it on update, so no later edit can move it.
         */
        photosCount: 0,
        itineraryDays: { create: children.itineraryDays },
        faqs: { create: children.faqs },
        pricingTiers: { create: children.pricingTiers },
        galleryImages: { create: children.galleryImages },
      },
      select: { slug: true },
    });

    await syncBrochure(tx, tour.slug, values);

    return tour;
  }, SAVE_TRANSACTION_OPTIONS);

  return { configured: true, value: created };
}

/**
 * What an edit-save came to. A conflict and a vanished tour are ordinary
 * outcomes the admin must be told about, not exceptions — they are returned, so
 * the action cannot forget to handle them the way it could forget a `catch`.
 */
export type UpdateTourOutcome =
  | { outcome: 'saved'; slug: string }
  /** Someone else saved this tour after the editor was loaded. Nothing was written. */
  | { outcome: 'conflict' }
  /** The tour no longer exists under `currentSlug` (renamed or never existed). Nothing was written. */
  | { outcome: 'missing' };

/**
 * See `createTour` for why the parameter is `rawValues` and is shadowed at once.
 *
 * ## `expectedUpdatedAt` — optimistic concurrency, M7 of the 2026-09-19 review
 *
 * The save below REPLACES every child collection and overwrites every column
 * from the form. Two admins with the same tour open used to mean the second
 * save silently erased the first — itinerary, FAQs, gallery and all — with both
 * shown "Saved". The editor now carries the `updatedAt` it was loaded with, and
 * the FIRST statement of the transaction claims the row only if it is still
 * that version:
 *
 *   UPDATE "Tour" SET "updatedAt" = now() WHERE slug = $1 AND "updatedAt" = $2
 *
 * One row → nobody else has saved; the row is now locked by this transaction
 * until commit, so a concurrent save's claim BLOCKS, then re-evaluates its
 * WHERE against the committed row (Postgres READ COMMITTED), sees the new
 * `updatedAt`, and claims zero rows. Zero rows → conflict (or a missing tour),
 * returned before a single child row is deleted. A check-then-write with a
 * separate SELECT would have a window between the two; this has none.
 *
 * Required, not optional: an optional version would make "no check" the
 * default, and the call site that forgot it would be the one that loses work.
 * `tsc` found every caller.
 */
export async function updateTour(
  currentSlug: string,
  rawValues: ParsedTourFormValues,
  intent: SubmitIntent,
  expectedUpdatedAt: Date
): Promise<Configured<UpdateTourOutcome>> {
  const prisma = getOptionalPrismaClient();
  if (!prisma) return unconfigured();

  const values = sanitizeTourFormValues(rawValues);
  const children = childCreates(values);

  const updated = await prisma.$transaction(async (tx): Promise<UpdateTourOutcome> => {
    const claim = await tx.tour.updateMany({
      where: { slug: currentSlug, updatedAt: expectedUpdatedAt },
      data: { updatedAt: new Date() },
    });

    if (claim.count === 0) {
      const stillThere = await tx.tour.findUnique({ where: { slug: currentSlug }, select: { slug: true } });
      return stillThere ? { outcome: 'conflict' } : { outcome: 'missing' };
    }

    /**
     * Child collections are REPLACED, not merged: delete-all then create-from-
     * the-form. The form submits the complete intended list (that is what a
     * repeatable field group is), so a merge would need per-row identity the
     * form does not carry, and the failure mode of getting that wrong is a
     * removed itinerary day silently reappearing.
     *
     * The unique constraints on `(tourSlug, dayNumber)` and `(tourSlug,
     * sortOrder)` make the ordering of these two steps load-bearing — creating
     * before deleting would collide. In one transaction, so a failure halfway
     * cannot leave a tour with its itinerary deleted and not rewritten.
     */
    await tx.tourItineraryDay.deleteMany({ where: { tourSlug: currentSlug } });
    await tx.tourFaq.deleteMany({ where: { tourSlug: currentSlug } });
    await tx.tourPricingTier.deleteMany({ where: { tourSlug: currentSlug } });
    /**
     * The gallery is replaced on the same terms as the other child collections.
     * Note this deletes only DATABASE ROWS — the Cloudinary assets they pointed
     * at are left alone, so an image removed here and re-added by an undo is the
     * same asset, and an image removed by mistake is recoverable from the media
     * library rather than gone.
     */
    await tx.tourGalleryImage.deleteMany({ where: { tourSlug: currentSlug } });

    const tour = await tx.tour.update({
      where: { slug: currentSlug },
      data: {
        ...toColumnData(values),
        /**
         * The slug is editable, and changing it changes the tour's PUBLIC URL.
         * Every FK to `Tour.slug` is declared `ON UPDATE CASCADE`, so rail
         * memberships, the brochure, departures and the child rows follow
         * automatically rather than being orphaned.
         *
         * NO REDIRECT IS CREATED from the old URL — this project has no redirect
         * table and inventing one here would be out of scope. Renaming a
         * PUBLISHED tour's slug therefore breaks any existing inbound link to
         * it, which is a real cost and is surfaced to the admin as a warning in
         * the form rather than hidden.
         */
        slug: values.slug,
        status: statusForIntent(intent),
        itineraryDays: { create: children.itineraryDays },
        faqs: { create: children.faqs },
        pricingTiers: { create: children.pricingTiers },
        galleryImages: { create: children.galleryImages },
      },
      select: { slug: true },
    });

    /**
     * AFTER the tour update, and keyed on the NEW slug. `Brochure.tourSlug` is
     * `ON UPDATE CASCADE`, so a renamed tour's brochure row has already followed
     * by this point — looking it up under `currentSlug` here would find nothing
     * and silently create a second brochure for the same tour, which
     * `@@unique` would then reject.
     */
    await syncBrochure(tx, tour.slug, values);

    return { outcome: 'saved', slug: tour.slug };
  }, SAVE_TRANSACTION_OPTIONS);

  return { configured: true, value: updated };
}

/**
 * Publish / un-publish from the list view.
 *
 * Publishing re-validates against `publishableTourSchema` at the CALL SITE (see
 * `actions.ts`), not here — this function is the write, and keeping the
 * validation with the action means there is one place that decides what
 * "publishable" means for both the form's Publish button and the list's toggle.
 * A tour that cannot meet the bar is refused with the reason, rather than going
 * live incomplete.
 */
export async function setTourStatus(slug: string, status: TourStatus): Promise<Configured<void>> {
  const prisma = getOptionalPrismaClient();
  if (!prisma) return unconfigured();

  await prisma.tour.update({ where: { slug }, data: { status } });
  return { configured: true, value: undefined };
}

/**
 * Archive / restore. Sets or clears `archivedAt` and NEVER deletes the row.
 *
 * `status` is deliberately left alone in both directions: an archived tour
 * remembers whether it was live, so restoring it returns it to exactly the state
 * it was pulled from rather than silently publishing a tour that was a draft
 * when it was archived.
 */
export async function setTourArchived(slug: string, archived: boolean): Promise<Configured<void>> {
  const prisma = getOptionalPrismaClient();
  if (!prisma) return unconfigured();

  await prisma.tour.update({
    where: { slug },
    data: { archivedAt: archived ? new Date() : null },
  });
  return { configured: true, value: undefined };
}

/** Exported for tests that inject a mock client. */
export type { PrismaClient };
