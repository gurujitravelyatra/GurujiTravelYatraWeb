import type { Brochure } from '@/content/ports';
import type { Destination, GroupDeparture, Package } from '@/content/types';

/**
 * Domain record → public API JSON.
 *
 * EXPLICIT field-by-field mapping rather than returning the domain object, so
 * the wire contract is a decision recorded in one file instead of a side effect
 * of whatever `src/content/types.ts` happens to contain. Adding an internal
 * field can then never silently publish it.
 *
 * ## `photoUrl` is deliberately renamed to `photoKey` on the wire
 *
 * The domain field is called `photoUrl` but it does NOT hold a URL — it holds an
 * opaque display key such as `"Spiti Valley"` (Assumption A4; no photo files
 * exist in this project, and components render a token-coloured
 * `PhotoPlaceholder` from it). The database column was already renamed to
 * `photoKey` for exactly this reason: the schema says "Renamed from the domain
 * field's `photoUrl` precisely so nothing downstream mistakes it for a fetchable
 * address."
 *
 * An HTTP API is the furthest-downstream consumer there is, and the one most
 * likely to be read by someone who never opens this repo. Publishing
 * `"photoUrl": "Spiti Valley"` would invite a client to render
 * `<img src="Spiti Valley">` and ship a broken image — the field name would be
 * the fabrication, even though the value is honest. So the rename that protected
 * the database layer is applied at the wire boundary too.
 */

export interface TourJson {
  slug: string;
  name: string;
  destinationSlug: string;
  destinationName: string;
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
}

/**
 * NOTE: there is no `pricingUnverified` field on `TourJson`, and that is not an
 * omission.
 *
 * A `pricingUnverified` tour is WITHHELD from every public surface
 * (`src/content/public-listing.ts`), so no tour that reaches this serializer can
 * carry the flag — a `"pricingUnverified": false` on every record would be dead
 * weight implying a distinction the endpoint never exposes. This is the opposite
 * of `GroupDepartureJson` below, whose flags ARE published, because those
 * records are marked rather than withheld. Same flag family, different product
 * decision (BLOCKERS.md item 9), so different wire treatment.
 */
export function toTourJson(pkg: Package): TourJson {
  return {
    slug: pkg.slug,
    name: pkg.name,
    destinationSlug: pkg.destinationSlug,
    destinationName: pkg.destinationName,
    category: pkg.category,
    durationLabel: pkg.durationLabel,
    subtitle: pkg.subtitle,
    photoKey: pkg.photoUrl,
    photosCount: pkg.photosCount,
    priceFrom: pkg.priceFrom,
    // `undefined` → `null`: `JSON.stringify` DROPS undefined-valued keys, so an
    // optional domain field would make the key vanish from some records and not
    // others. An explicit null keeps every record the same shape.
    priceWas: pkg.priceWas ?? null,
    savingsLabel: pkg.savingsLabel ?? null,
    seatsLabel: pkg.seatsLabel ?? null,
    isHot: pkg.isHot === true,
  };
}

export interface DestinationJson {
  slug: string;
  name: string;
  region: string | null;
  category: string | null;
  tagline: string | null;
  photoKey: string;
  photosCount: number | null;
}

export function toDestinationJson(destination: Destination): DestinationJson {
  return {
    slug: destination.slug,
    name: destination.name,
    region: destination.region ?? null,
    category: destination.category ?? null,
    tagline: destination.tagline ?? null,
    photoKey: destination.photoUrl,
    photosCount: destination.photosCount ?? null,
  };
}

export interface GroupDepartureJson {
  slug: string;
  name: string;
  destinationName: string;
  category: string;
  photoKey: string;
  dateRangeLabel: string;
  month: string;
  durationLabel: string;
  boardingPoints: string;
  tourManagerLabel: string;
  priceFrom: string;
  seatsLabel: string;
  isSoldOut: boolean;
  /**
   * PUBLISHED, not hidden — the whole point of the field.
   *
   * These departures are surfaced with a visible marker rather than withheld
   * (BLOCKERS.md item 9, a user-made product call). `GroupDepartureCard` renders
   * an asterisk + `aria-describedby` footnote off these flags, and an API
   * consumer must be able to render the equivalent. Dropping the flags from the
   * response would hand a consumer an unconfirmed price with no way to know it
   * is unconfirmed — i.e. it would make THIS surface the one that republishes a
   * figure the site marks as doubtful, which is precisely the defect
   * `memory/feedback_qg_unenforced-safety-flag.md` records four occurrences of.
   */
  priceUnverified: boolean;
  durationUnverified: boolean;
}

export function toGroupDepartureJson(departure: GroupDeparture): GroupDepartureJson {
  return {
    slug: departure.slug,
    name: departure.name,
    destinationName: departure.destinationName,
    category: departure.category,
    photoKey: departure.photoUrl,
    dateRangeLabel: departure.dateRangeLabel,
    month: departure.month,
    durationLabel: departure.durationLabel,
    boardingPoints: departure.boardingPoints,
    tourManagerLabel: departure.tourManagerLabel,
    priceFrom: departure.priceFrom,
    seatsLabel: departure.seatsLabel,
    isSoldOut: departure.isSoldOut === true,
    // Emitted as real booleans, never omitted. The domain type uses
    // `true | undefined` (fixture-shaped); `=== true` normalises that without
    // ever turning an unknown into a confident `false`.
    priceUnverified: departure.priceUnverified === true,
    durationUnverified: departure.durationUnverified === true,
  };
}

export interface BrochureJson {
  tourSlug: string;
  title: string;
  itinerarySummary: string;
  priceLabel: string | null;
  dateRangeLabel: string | null;
  coverImageKey: string;
  category: string;
  /**
   * NULL on every record today, and the response says so rather than omitting
   * the key.
   *
   * No brochure PDF exists anywhere in this project: every seeded row has
   * `pdfUrl = NULL` and `status = PENDING_UPLOAD`. A synthesised path like
   * `/brochures/spiti-valley.pdf` would be a fabricated asset, and a
   * "Download Brochure" button wired to a 404 is worse than a disabled one.
   *
   * `pdfUrl: null` + `status: "PENDING_UPLOAD"` together are the honest answer:
   * the field is present so a consumer can see it is null, and `status` carries
   * the reason. A consumer MUST treat "no URL" as "no download", never as "use a
   * default path" — there is no default path.
   */
  pdfUrl: string | null;
  status: Brochure['status'];
  version: number;
  fileSizeBytes: number | null;
  downloadCount: number;
  uploadedAt: string | null;
}

export function toBrochureJson(brochure: Brochure): BrochureJson {
  return {
    tourSlug: brochure.tourSlug,
    title: brochure.title,
    itinerarySummary: brochure.itinerarySummary,
    priceLabel: brochure.priceLabel ?? null,
    dateRangeLabel: brochure.dateRangeLabel ?? null,
    coverImageKey: brochure.coverImageKey,
    category: brochure.category,
    pdfUrl: brochure.pdfUrl ?? null,
    status: brochure.status,
    version: brochure.version,
    fileSizeBytes: brochure.fileSizeBytes ?? null,
    downloadCount: brochure.downloadCount,
    uploadedAt: brochure.uploadedAt ?? null,
  };
}
