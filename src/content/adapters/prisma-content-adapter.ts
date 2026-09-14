import type { PrismaClient } from '@prisma/client';
import type { Brochure, BrochurePort, ContentPort } from '../ports';
import type { Destination, GroupDeparture, Package, PackageRail } from '../types';
import { FixtureContentAdapter } from './fixture-content-adapter';
import { isPubliclyListable } from '../public-listing';
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
 * `Tour.pricingUnverified` is a real column, but a column is not enforcement.
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
      where: { pricingUnverified: false },
      include: { destination: true },
      orderBy: { catalogueOrder: 'asc' },
    });
    return rows.map(toPackage).filter(isPubliclyListable);
  }

  async getPopularDestinations(): Promise<Package[]> {
    const rows = await this.prisma.tour.findMany({
      where: { pricingUnverified: false, popularOrder: { not: null } },
      include: { destination: true },
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
   */
  async getPackageRails(): Promise<PackageRail[]> {
    const rows = await this.prisma.rail.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
          include: { tour: { include: { destination: true } } },
        },
      },
    });

    return rows.map((rail) => ({
      title: rail.title,
      items: rail.items.map((item) => toPackage(item.tour)).filter(isPubliclyListable),
    }));
  }

  /**
   * NOT routed through `isPubliclyListable` — deliberately, matching
   * `FixtureContentAdapter`. That gate withholds records whose unconfirmed price
   * would be wrapped in a "was ₹X / Save ₹Y" badge; a departure card renders no
   * such badge, and its dates and seat counts are real regardless. The
   * unconfirmed price is surfaced with the `priceUnverified` marker instead
   * (BLOCKERS.md item 9 — a user-made product decision, not an agent's).
   */
  async getGroupDepartures(): Promise<GroupDeparture[]> {
    const rows = await this.prisma.groupDeparture.findMany({
      include: { destination: true },
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map(toGroupDeparture);
  }

  // ---------------------------------------------------------------------------
  // Brochures — `BrochurePort`, database-only (no fixture equivalent exists)
  // ---------------------------------------------------------------------------

  async getBrochures(): Promise<Brochure[]> {
    const rows = await this.prisma.brochure.findMany({
      where: { tour: { pricingUnverified: false } },
      orderBy: { tour: { catalogueOrder: 'asc' } },
    });
    return rows.map(toBrochure);
  }

  async getBrochureByTourSlug(tourSlug: string): Promise<Brochure | undefined> {
    const row = await this.prisma.brochure.findFirst({
      where: { tourSlug, tour: { pricingUnverified: false } },
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
  photosCount: number;
  priceFrom: string;
  priceWas: string | null;
  savingsLabel: string | null;
  seatsLabel: string | null;
  isHot: boolean;
  pricingUnverified: boolean;
  destination: { name: string };
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
    photosCount: row.photosCount,
    priceFrom: row.priceFrom,
    priceWas: optional(row.priceWas),
    savingsLabel: optional(row.savingsLabel),
    seatsLabel: optional(row.seatsLabel),
    isHot: flag(row.isHot),
    pricingUnverified: flag(row.pricingUnverified),
  };
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
