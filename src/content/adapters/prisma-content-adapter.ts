import type { PrismaClient } from '@prisma/client';
import type { Brochure, BrochurePort, ContentPort } from '../ports';
import type { Destination, GroupDeparture, Package, PackageRail, TourStatus } from '../types';
import { FixtureContentAdapter } from './fixture-content-adapter';
import { isPubliclyListable, toPublicDeparture } from '../public-listing';
import { deriveIsSoldOut } from '../sold-out';
import { toDomainCategory } from './prisma-category';

/**
 * `ContentPort` backed by the interim content database — BLOCKERS.md §5.
 *
 * ## Why this composes `FixtureContentAdapter` instead of extending it
 *
 * Only four content areas moved to the database (tours, destinations, group
 * departures, brochures). Testimonials, stats, featured videos, About milestones
 * and trip-place options deliberately did NOT — they are unchanged fixtures, and
 * several of them (testimonials, stats, milestones) are placeholder content whose
 * honesty markers live in the fixture files.
 *
 * Composition over inheritance because the delegation is the interesting part of
 * this class and should be legible: `extends FixtureContentAdapter` would make
 * the out-of-scope methods invisible, so a future reader could not tell which
 * queries hit Postgres without diffing against the parent. It also keeps the
 * fallback injectable, which is what lets the tests run with a mock client and no
 * database.
 *
 * ## The safety flags are enforced here, not just stored
 *
 * `Tour.pricingUnverified`, `Tour.status` and `Tour.archivedAt` are real columns,
 * but a column is not enforcement.
 * Every public tour query below ends in the SAME `isPubliclyListable()` predicate
 * that `public-listing.ts` applies on the fixture path — one definition of
 * "may this be shown", used by both adapters. The `where` clause is an
 * optimisation; the predicate is the gate. If they ever disagree, the predicate
 * wins, which is the safe direction.
 *
 * `memory/feedback_qg_unenforced-safety-flag.md` records four occurrences of a
 * flag that existed and did nothing. Porting content to a database is precisely
 * the moment that happens a fifth time, so the adapter tests assert on the ROWS
 * RETURNED, never on the flag's presence.
 */
/**
 * The SQL half of the public-listing gate — an optimisation, never the gate.
 *
 * Kept as one shared constant rather than repeated inline at each `findMany`,
 * because the failure mode of repeating it is that one copy drifts: a query that
 * filtered `pricingUnverified` but forgot `status` would have looked right in
 * review and published every draft tour on that surface. There is now one
 * expression to get right, spread into the queries that need extra conditions.
 *
 * It mirrors `isPubliclyListable()` and must keep mirroring it, but the mirror
 * is not what makes the system safe — every method below ALSO runs the predicate
 * over the mapped rows. If this clause and the predicate ever disagree, the
 * predicate wins and the row is withheld, which is the safe direction.
 * `prisma-content-adapter.test.ts` asserts exactly that by handing the adapter a
 * mock that ignores this clause entirely and returns a draft row anyway.
 */
const PUBLICLY_LISTABLE_WHERE = {
  status: 'PUBLISHED',
  archivedAt: null,
  pricingUnverified: false,
} as const;

/**
 * The SQL half of the DEPARTURE gate — an optimisation, never the gate.
 *
 * A departure is listable when it is linked to no tour, or when its tour is
 * published and not archived. Built FROM `PUBLICLY_LISTABLE_WHERE` minus
 * `pricingUnverified`, rather than restating `status`/`archivedAt`, so the two
 * clauses cannot drift. `pricingUnverified` is left out on purpose: a departure
 * of a price-unconfirmed tour is marked, not withheld (BLOCKERS.md item 9).
 */
const TOUR_PUBLISHED_AND_LIVE_WHERE = {
  status: PUBLICLY_LISTABLE_WHERE.status,
  archivedAt: PUBLICLY_LISTABLE_WHERE.archivedAt,
} as const;

const DEPARTURE_PARENT_VISIBLE_WHERE = {
  OR: [{ tourSlug: null }, { tour: TOUR_PUBLISHED_AND_LIVE_WHERE }],
};

/**
 * What every tour query joins — Phase C added the gallery to it.
 *
 * One shared constant for the same reason `PUBLICLY_LISTABLE_WHERE` is one: the
 * three surfaces that return a `Package` (the catalogue, Home's popular grid,
 * and the rails) must return the SAME shape, and the failure mode of writing the
 * include three times is that a tour's gallery appears on two of them and
 * silently not the third. The detail page reads through `getAllTours()`, so a
 * missed join there would empty the gallery on the one page that renders it.
 */
const TOUR_INCLUDE = {
  destination: true,
  galleryImages: { orderBy: { sortOrder: 'asc' } },
} as const;

export class PrismaContentAdapter implements ContentPort, BrochurePort {
  private readonly prisma: PrismaClient;

  /**
   * Content that did not move to the database is served from here, unchanged.
   * Injectable so tests can assert delegation without reaching for a database.
   */
  private readonly fixtures: ContentPort;

  constructor(prisma: PrismaClient, fixtures: ContentPort = new FixtureContentAdapter()) {
    this.prisma = prisma;
    this.fixtures = fixtures;
  }

  // ---------------------------------------------------------------------------
  // Database-backed — tours, destinations, group departures
  // ---------------------------------------------------------------------------

  async getAllTours(): Promise<Package[]> {
    const rows = await this.prisma.tour.findMany({
      where: PUBLICLY_LISTABLE_WHERE,
      include: TOUR_INCLUDE,
      orderBy: { catalogueOrder: 'asc' },
    });
    return rows.map(toPackage).filter(isPubliclyListable);
  }

  async getPopularDestinations(): Promise<Package[]> {
    const rows = await this.prisma.tour.findMany({
      where: { ...PUBLICLY_LISTABLE_WHERE, popularOrder: { not: null } },
      include: TOUR_INCLUDE,
      orderBy: { popularOrder: 'asc' },
    });
    return rows.map(toPackage).filter(isPubliclyListable);
  }

  async getInternationalDestinations(): Promise<Destination[]> {
    const rows = await this.prisma.destination.findMany({
      where: { isInternational: true },
      orderBy: { internationalOrder: 'asc' },
    });
    return rows.map(toDestination);
  }

  /**
   * Rails are kept even when the public-listing filter empties one — the same
   * contract as `publiclyListedRails`. Dropping a whole rail would change the
   * page's structure based on a temporary data flag, and `PackageRail` already
   * renders a defensive empty state.
   *
   * ONE SQL query, because `relationJoins` is enabled (prisma/schema.prisma).
   * Without it this four-level include is five sequential round trips to a
   * remote database (~1.2s measured), which is what made `/tour-packages` 503
   * under concurrent prefetches (BLOCKERS.md item 16). The page itself is now
   * static, so this runs at build/revalidate time, but the admin and any future
   * caller still pay for it.
   */
  async getPackageRails(): Promise<PackageRail[]> {
    const rows = await this.prisma.rail.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
          include: { tour: { include: TOUR_INCLUDE } },
        },
      },
    });

    return rows.map((rail) => ({
      title: rail.title,
      items: rail.items.map((item) => toPackage(item.tour)).filter(isPubliclyListable),
    }));
  }

  /**
   * Gated through the PARENT TOUR, by `toPublicDeparture()` — the departure half
   * of the public gate in `public-listing.ts`.
   *
   * ## What this used to be, and why it changed (2026-09-25)
   *
   * This query read every row with no reference to the tour it belongs to. It
   * was written on 2026-09-14, before `Tour.status`/`archivedAt` existed, and
   * nothing revisited it when they arrived — so archiving or un-publishing a tour
   * removed it from every public surface except its departures, which stayed
   * listed with real dates, seats and a price. `feedback_qg_unenforced-safety-
   * flag.md` variant 4, reproduced by a later schema change.
   *
   * ## The where clause is an optimisation; the predicate is the gate
   *
   * Same contract as `PUBLICLY_LISTABLE_WHERE` for tours: the SQL keeps withheld
   * rows off the wire, and every row that comes back is STILL run through
   * `toPublicDeparture` with the parent's real columns. If the two disagree the
   * predicate wins, and `prisma-content-adapter.test.ts` proves it with a mock
   * that ignores the where clause.
   *
   * ## What is deliberately still NOT withheld
   *
   *  - A departure with `tourSlug` NULL — the link is genuinely partial (see
   *    `departure-tour-link.ts`) and an unlinked departure answers to no tour.
   *  - A departure of a `pricingUnverified` tour. It is MARKED instead
   *    (`priceUnverified` forced true), per the user's BLOCKERS.md item 9
   *    decision — see `departureWithholdReason` for the full reasoning.
   */
  async getGroupDepartures(): Promise<GroupDeparture[]> {
    const rows = await this.prisma.groupDeparture.findMany({
      where: DEPARTURE_PARENT_VISIBLE_WHERE,
      include: {
        destination: true,
        tour: { select: { status: true, archivedAt: true, pricingUnverified: true } },
      },
      orderBy: { sortOrder: 'asc' },
    });

    return rows.flatMap((row) => {
      /**
       * A `tourSlug` with no tour behind it cannot happen while the foreign key
       * exists (`onDelete: SetNull`). If it ever does — a relaxed constraint, a
       * hand-edited row — the departure claims a parent we cannot check, so it
       * is withheld: the closed direction. NOT treated as `null`, which would
       * list it as an unlinked departure.
       */
      if (row.tourSlug !== null && !row.tour) return [];

      const parent = row.tour ? { ...row.tour, status: toTourStatus(row.tour.status) } : null;
      const visible = toPublicDeparture(toGroupDeparture(row), parent);
      return visible ? [visible] : [];
    });
  }

  // ---------------------------------------------------------------------------
  // Brochures — `BrochurePort`, database-only (no fixture equivalent exists)
  // ---------------------------------------------------------------------------

  /**
   * Gated through the tour relation on the SAME clause the tour queries use, so
   * a draft or archived tour's brochure is withheld for the same reason its
   * detail page 404s. A brochure is per-tour metadata; publishing one for a tour
   * the catalogue hides would republish the hidden tour's title, itinerary
   * summary and price under a different URL.
   */
  async getBrochures(): Promise<Brochure[]> {
    const rows = await this.prisma.brochure.findMany({
      where: { tour: PUBLICLY_LISTABLE_WHERE },
      orderBy: { tour: { catalogueOrder: 'asc' } },
    });
    return rows.map(toBrochure);
  }

  async getBrochureByTourSlug(tourSlug: string): Promise<Brochure | undefined> {
    const row = await this.prisma.brochure.findFirst({
      where: { tourSlug, tour: PUBLICLY_LISTABLE_WHERE },
    });
    return row ? toBrochure(row) : undefined;
  }

  // ---------------------------------------------------------------------------
  // Not database-backed — delegated to the fixtures, unchanged
  // ---------------------------------------------------------------------------

  getFeaturedVideos() {
    return this.fixtures.getFeaturedVideos();
  }

  getStats() {
    return this.fixtures.getStats();
  }

  getSiteStatsSummary() {
    return this.fixtures.getSiteStatsSummary();
  }

  getTestimonials() {
    return this.fixtures.getTestimonials();
  }

  getTripPlaceOptions() {
    return this.fixtures.getTripPlaceOptions();
  }

  getAboutMilestones() {
    return this.fixtures.getAboutMilestones();
  }
}

// -----------------------------------------------------------------------------
// Row → domain mapping
//
// Every mapper converts SQL NULL to `undefined`, and `false` safety flags to
// `undefined`, so a database-sourced record is shape-identical to the fixture
// one. The domain types mark these fields optional; emitting `null` would make
// `'priceWas' in pkg` true with a null value and quietly change how a component
// that tests for presence behaves.
// -----------------------------------------------------------------------------

/** SQL NULL → `undefined`, preserving the optional-field shape of the domain types. */
function optional<T>(value: T | null): T | undefined {
  return value === null ? undefined : value;
}

/**
 * A safety flag is emitted as `true` or omitted entirely — never `false`.
 * The fixtures omit it, and these records are compared against fixture output.
 */
function flag(value: boolean): true | undefined {
  return value ? true : undefined;
}

type TourRow = {
  slug: string;
  name: string;
  destinationSlug: string;
  category: string;
  durationLabel: string;
  subtitle: string;
  photoKey: string;
  coverImageUrl: string | null;
  photosCount: number;
  priceFrom: string;
  priceWas: string | null;
  savingsLabel: string | null;
  seatsLabel: string | null;
  isHot: boolean;
  pricingUnverified: boolean;
  status: string;
  archivedAt: Date | null;
  destination: { name: string };
  /**
   * Optional on the ROW TYPE, not on the schema: it is present on every query
   * that includes it and absent on any future one that does not. Typing it as
   * required would force every caller to join the gallery even when nothing
   * renders it; typing it optional means a caller that forgets simply yields a
   * tour with no gallery, which is the same as a tour that has none.
   */
  galleryImages?: { url: string }[];
};

function toPackage(row: TourRow): Package {
  return {
    slug: row.slug,
    name: row.name,
    destinationSlug: row.destinationSlug,
    // Read through the relation rather than duplicated on the tour row — the
    // display name has exactly one home, so a renamed destination cannot leave
    // stale copies behind on its tours.
    destinationName: row.destination.name,
    category: toDomainCategory(row.category),
    durationLabel: row.durationLabel,
    subtitle: row.subtitle,
    // `photoKey` is an opaque token, not a URL (Assumption A4). The domain field
    // is still called `photoUrl`; the column is not, so nothing downstream in
    // the database layer mistakes it for a fetchable address.
    photoUrl: row.photoKey,
    /**
     * The uploaded cover, when there is one. Unlike `photoKey` this IS a
     * fetchable address, which is why the two are separate fields rather than
     * one column that changed meaning — a consumer that has not been updated
     * still renders the placeholder instead of putting an https URL through
     * `PhotoPlaceholder`'s uppercase label.
     */
    coverImageUrl: optional(row.coverImageUrl),
    galleryImageUrls: row.galleryImages?.map((image) => image.url),
    /**
     * The "N Photos" badge, derived at READ TIME rather than stored.
     *
     * A tour with uploaded photos reports how many it has; a tour with none keeps
     * the design export's inherited figure, which is what all 22 seeded tours
     * still show.
     *
     * Derived here and not written on save, because `photosCount` is not a form
     * field: writing it from the admin form made editing a tour's description
     * silently change its photo count, which the live integration suite caught
     * (see `toColumnData`). Deriving it costs nothing and cannot drift from the
     * gallery, so the badge and the gallery strip on the detail page can never
     * contradict each other — "8 Photos" above a strip of three was the failure
     * worth designing out.
     *
     * The inherited figure for a tour with no uploads is NOT corrected here.
     * Those numbers describe photography that does not exist in this project,
     * which is a real honesty problem — but it is the pre-existing one, it
     * affects all 22 tours equally, and silently zeroing the catalogue is a
     * content decision for the business rather than a side effect of shipping
     * uploads.
     */
    photosCount:
      row.galleryImages && row.galleryImages.length > 0 ? row.galleryImages.length : row.photosCount,
    priceFrom: row.priceFrom,
    priceWas: optional(row.priceWas),
    savingsLabel: optional(row.savingsLabel),
    seatsLabel: optional(row.seatsLabel),
    isHot: flag(row.isHot),
    pricingUnverified: flag(row.pricingUnverified),
    /**
     * Mapped through `toTourStatus`, which THROWS on an unrecognised value
     * rather than defaulting.
     *
     * Defaulting an unknown status to `'PUBLISHED'` would publish a row this
     * build does not understand; defaulting it to `'DRAFT'` would silently
     * unpublish live tours if a future enum member arrived. Neither is a
     * decision this mapper is entitled to make, so it refuses — the same
     * reasoning, and the same shape, as `toDomainCategory()` above it.
     */
    status: toTourStatus(row.status),
    /**
     * `Date | null` → `string | undefined`. The domain type is JSON-shaped
     * (fixtures and API responses are strings), and SQL NULL becomes ABSENT
     * rather than `null` so `archivedAt !== undefined` in the gate reads
     * correctly — a `null` here would make an unarchived tour test as archived
     * and blank the entire catalogue.
     */
    archivedAt: row.archivedAt === null ? undefined : row.archivedAt.toISOString(),
  };
}

/**
 * Stored status → the domain union, or an exception.
 *
 * Deliberately not a cast. `row.status as TourStatus` would compile, be shorter,
 * and hand a value the rest of the system trusts straight through without ever
 * checking it — so a database holding anything other than these two strings
 * would flow into `isPubliclyListable()` and be compared against `'PUBLISHED'`
 * with whatever result it happened to produce.
 */
function toTourStatus(value: string): TourStatus {
  if (value === 'PUBLISHED' || value === 'DRAFT') return value;
  throw new Error(
    `Unknown TourStatus "${value}" from the database — it is not in the union in src/content/types.ts. ` +
      `Schema and code are out of sync; run prisma generate and check prisma/schema.prisma.`
  );
}

type DestinationRow = {
  slug: string;
  name: string;
  region: string | null;
  category: string | null;
  tagline: string | null;
  photoKey: string;
  photosCount: number | null;
};

function toDestination(row: DestinationRow): Destination {
  return {
    slug: row.slug,
    name: row.name,
    region: optional(row.region),
    category: row.category === null ? undefined : toDomainCategory(row.category),
    tagline: optional(row.tagline),
    photoUrl: row.photoKey,
    photosCount: optional(row.photosCount),
  };
}

type GroupDepartureRow = {
  slug: string;
  name: string;
  category: string;
  photoKey: string;
  dateRangeLabel: string;
  month: string;
  durationLabel: string;
  boardingPoints: string;
  tourManagerLabel: string;
  priceFrom: string;
  seatsLabel: string;
  scriptAccent: string;
  durationUnverified: boolean;
  priceUnverified: boolean;
  destination: { name: string };
};

function toGroupDeparture(row: GroupDepartureRow): GroupDeparture {
  return {
    slug: row.slug,
    name: row.name,
    destinationName: row.destination.name,
    category: toDomainCategory(row.category),
    photoUrl: row.photoKey,
    dateRangeLabel: row.dateRangeLabel,
    month: row.month,
    durationLabel: row.durationLabel,
    boardingPoints: row.boardingPoints,
    tourManagerLabel: row.tourManagerLabel,
    priceFrom: row.priceFrom,
    seatsLabel: row.seatsLabel,
    // Derived, never stored — see `../sold-out.ts` for why there is no column.
    isSoldOut: deriveIsSoldOut(row.seatsLabel),
    scriptAccent: row.scriptAccent,
    durationUnverified: flag(row.durationUnverified),
    priceUnverified: flag(row.priceUnverified),
  };
}

type BrochureRow = {
  tourSlug: string;
  title: string;
  itinerarySummary: string;
  priceLabel: string | null;
  dateRangeLabel: string | null;
  coverImageKey: string;
  category: string;
  pdfUrl: string | null;
  status: string;
  version: number;
  fileSizeBytes: number | null;
  downloadCount: number;
  uploadedAt: Date | null;
};

function toBrochure(row: BrochureRow): Brochure {
  return {
    tourSlug: row.tourSlug,
    title: row.title,
    itinerarySummary: row.itinerarySummary,
    priceLabel: optional(row.priceLabel),
    dateRangeLabel: optional(row.dateRangeLabel),
    coverImageKey: row.coverImageKey,
    category: toDomainCategory(row.category),
    // Stays `undefined` when the column is NULL. No default path is substituted:
    // there is no brochure PDF anywhere in this project, and a plausible-looking
    // `/brochures/<slug>.pdf` would be a fabricated asset.
    pdfUrl: optional(row.pdfUrl),
    status: row.status as Brochure['status'],
    version: row.version,
    fileSizeBytes: optional(row.fileSizeBytes),
    downloadCount: row.downloadCount,
    uploadedAt: row.uploadedAt === null ? undefined : row.uploadedAt.toISOString(),
  };
}
