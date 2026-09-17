import 'server-only';
import type { PrismaClient } from '@prisma/client';

import { getOptionalPrismaClient } from '@/server/db/prisma';
import { CATEGORY_TO_PRISMA, toDomainCategory } from '@/content/adapters/prisma-category';
import { AUDIENCE_TAG_TO_PRISMA, toDomainAudienceTag } from '@/content/adapters/prisma-audience-tag';
import type { DestinationCategory, TourStatus } from '@/content/types';

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
  lifecycle: AdminTourLifecycle;
  /** `priceFrom` when the tour uses a single price; null when it uses tiers. */
  priceFrom: string | null;
  /** Number of `TourPricingTier` rows — 0 means "single price". */
  pricingTierCount: number;
  pricingUnverified: boolean;
  updatedAt: Date;
}

export interface AdminTourDetail extends ParsedTourFormValues {
  lifecycle: AdminTourLifecycle;
  status: TourStatus;
  archivedAt: Date | null;
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
      lifecycle: toLifecycle(row),
      // A tour with tiers shows "N tiers" instead of a single figure, so the
      // single price is withheld here rather than rendered beside them — showing
      // both would imply a base price the tiered tour does not sell at.
      priceFrom: row._count.pricingTiers > 0 ? null : row.priceFrom,
      pricingTierCount: row._count.pricingTiers,
      pricingUnverified: row.pricingUnverified,
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
    },
  });

  if (!row) return { configured: true, value: null };

  return {
    configured: true,
    value: {
      name: row.name,
      slug: row.slug,
      destinationSlug: row.destinationSlug,
      category: toDomainCategory(row.category),
      audienceTags: row.audienceTags.map((tag) => toDomainAudienceTag(tag)),
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
      lifecycle: toLifecycle(row),
      status: row.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
      archivedAt: row.archivedAt,
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
  };
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
  };
}

/** The status a submit intent writes. `'draft'` un-publishes; see `SUBMIT_INTENTS`. */
function statusForIntent(intent: SubmitIntent): TourStatus {
  return intent === 'publish' ? 'PUBLISHED' : 'DRAFT';
}

export async function createTour(
  values: ParsedTourFormValues,
  intent: SubmitIntent
): Promise<Configured<{ slug: string }>> {
  const prisma = getOptionalPrismaClient();
  if (!prisma) return unconfigured();

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

    return tx.tour.create({
      data: {
        ...toColumnData(values),
        slug: values.slug,
        status: statusForIntent(intent),
        catalogueOrder,
        /**
         * Opaque display key, NOT a URL (Assumption A4) — the same contract the
         * fixtures use, where `photoUrl` holds the destination name and the card
         * renders a token-coloured `PhotoPlaceholder` from it. Real uploads are
         * Phase C; seeding this with the destination name gives a new tour the
         * same honest placeholder every existing tour has, rather than a
         * fabricated CDN path.
         */
        photoKey: values.destinationSlug,
        /**
         * ZERO, and honestly so: no photos have been uploaded for a tour created
         * here, because uploads are not built yet. The card renders "0 Photos".
         */
        photosCount: 0,
        itineraryDays: { create: children.itineraryDays },
        faqs: { create: children.faqs },
        pricingTiers: { create: children.pricingTiers },
      },
      select: { slug: true },
    });
  });

  return { configured: true, value: created };
}

export async function updateTour(
  currentSlug: string,
  values: ParsedTourFormValues,
  intent: SubmitIntent
): Promise<Configured<{ slug: string }>> {
  const prisma = getOptionalPrismaClient();
  if (!prisma) return unconfigured();

  const children = childCreates(values);

  const updated = await prisma.$transaction(async (tx) => {
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

    return tx.tour.update({
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
      },
      select: { slug: true },
    });
  });

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
