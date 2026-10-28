/**
 * Response/request shapes for the CRM's `/api/public/*` surface — transcribed
 * field-for-field from `documentation/technical-specification/public-website.md`,
 * the authoritative contract this module is built against. If a field here and
 * the running API ever disagree, the API is the bug (per that file's own
 * header) — do not quietly reshape a type to match what the CRM actually
 * sends; file it and stop.
 *
 * Nothing here is `server-only` on its own — these are plain type/interface
 * declarations, safe to import from a Server Component without pulling in
 * fetch logic or credentials.
 */

export interface CrmMoney {
  amount: number;
  currency: string;
}

/** The website's own category taxonomy — separate from the CRM's internal one. */
export type CrmCategory = 'Spiritual' | 'Adventure' | 'International' | 'Family' | 'Group';

export interface CrmPlaceRef {
  name: string;
  slug: string;
}

export interface CrmNextDeparture {
  date: string;
  seatsLeft: number;
}

/**
 * The card shape shared by `GET /public/tours` and `GET /public/departures`
 * (the latter adds `departureDate`).
 *
 * `departureCity` is ALWAYS `null` today — see the contract's own note. Do
 * not build UI around this ever being non-null.
 *
 * `primaryPlace` is `CrmPlaceRef | null` — production incident 2026-10-27
 * (#1): the contract document's own examples only ever show a populated
 * `primaryPlace`, but the real deployed CRM returns `"primaryPlace": null`
 * for a tour with no place assigned yet, which is a real, reachable state
 * ("the CRM API itself is healthy" — this is not a CRM bug, just an
 * under-documented one). `PackageCard`/the detail page/
 * `GroupDepartureCard` all read `tour.primaryPlace.name` for an `alt` text
 * suffix; a bare (non-optional) `CrmPlaceRef` let that reach production as
 * `Cannot read properties of null (reading 'name')`, crashing `/` and
 * `/tour-packages` (both render `PackageCard`) with a real HTTP 500.
 *
 * `price` is `CrmMoney | null` — same incident, same-day audit after
 * incident #2 (a different field, `alt`, took the whole site down the
 * same way; see `CrmSiteImage`'s own comment). A tour can have no price
 * set yet. `formatCrmPrice()` (`src/lib/rupees.ts`) already renders
 * "Price on request" for `null`/`undefined` — read it through that
 * helper, never `price.amount` directly.
 *
 * `shortDescription`/`coverImageUrl` arrive from `schemas.ts` already
 * normalised to `''` if the CRM sent `null`/omitted them — `''` is safe
 * everywhere these are read (renders nothing / `safeMediaUrl('')` falls
 * through to `PhotoPlaceholder`), so they stay plain `string` here, not
 * nullable.
 */
export interface CrmTourCard {
  slug: string;
  name: string;
  category: CrmCategory;
  shortDescription: string;
  coverImageUrl: string;
  price: CrmMoney | null;
  durationDays: number;
  durationNights: number;
  departureCity: null;
  primaryPlace: CrmPlaceRef | null;
  nextDeparture: CrmNextDeparture | null;
  hasBrochure: boolean;
}

export interface CrmTourListResponse {
  tours: CrmTourCard[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CrmItineraryDay {
  day: number;
  title: string;
  detail: string;
}

/**
 * `alt` arrives from `schemas.ts` already normalised to `''` if the CRM
 * sent `null` — production incident 2026-10-27 (#2): the real
 * `GET /public/site` response sends `"alt": null` for `CrmSiteImage`
 * (see that type's own comment) and the same field exists here for a
 * tour's own gallery. Treat `''` the same way as the rest of this
 * codebase treats absent alt text: fall back to the tour's `name` at the
 * call site, per that incident's point 3 ("default the alt attribute to
 * the tour/place/site name").
 */
export interface CrmGalleryImage {
  url: string;
  alt: string;
}

export interface CrmPricingOption {
  label: string;
  note: string;
  price: CrmMoney;
}

/**
 * `returnDate`/`price` are currently ALWAYS `null` — `TourDate` carries
 * neither in the data model today. Kept in the shape for forward
 * compatibility; do not build UI assuming either is ever non-null.
 */
export interface CrmTourDeparture {
  date: string;
  returnDate: string | null;
  price: CrmMoney | null;
  seatsLeft: number;
  soldOut: boolean;
}

export interface CrmTourDetail extends CrmTourCard {
  description: string;
  highlights: string[];
  itinerary: CrmItineraryDay[];
  inclusions: string[];
  exclusions: string[];
  cancellationPolicy: string;
  gallery: CrmGalleryImage[];
  brochureUrl: string | null;
  places: CrmPlaceRef[];
  pricingOptions: CrmPricingOption[];
  departures: CrmTourDeparture[];
  seoTitle: string;
  seoDescription: string;
}

/** `GET /public/tours/:slug`'s redirect body — a 200, never a 301. */
export interface CrmTourRedirect {
  redirectTo: string;
}

export interface CrmDeparturesTourCard extends CrmTourCard {
  departureDate: string;
}

export interface CrmDeparturesResponse {
  departures: CrmDeparturesTourCard[];
  /** Every `YYYY-MM` with at least one upcoming departure of a live tour. */
  months: string[];
}

export interface CrmPlace {
  name: string;
  slug: string;
  region: string;
  description: string;
  imageUrl: string;
  showInCustomBuilder: boolean;
  liveTourCount: number;
}

export type CrmSiteImageSlot = 'HERO_BACKGROUND' | 'ABOUT' | 'GALLERY' | 'FOOTER';

/**
 * Production incident 2026-10-27 (#2): the real `GET /public/site`
 * response sends `"alt": null` for images with no alt text set — real,
 * healthy data the contract document never shows as nullable.
 * `schemas.ts` normalises this to `''` before it reaches here (never
 * throws on it — see `client.ts`'s `withFallback()`), so `alt` stays
 * plain `string`, not nullable, at this type level. Fall back to the
 * site's own name at the call site when `alt === ''`, per that
 * incident's point 3.
 */
export interface CrmSiteImage {
  url: string;
  alt: string;
}

/**
 * Every settings field is `null` until the Owner has saved it at least once
 * — there is no backfill or default copy. Every consumer of this type must
 * treat `null` as "not set", never substitute invented copy.
 */
export interface CrmSiteSettings {
  heroHeadline: string | null;
  heroSubtext: string | null;
  happyTravellersLabel: string | null;
  destinationsLabel: string | null;
  yearsExperienceLabel: string | null;
  showFiguresNote: boolean;
  phone: string | null;
  whatsappNumber: string | null;
  email: string | null;
  instagramUrl: string | null;
  address: string | null;
  profileVideoUrl: string | null;
}

export interface CrmSiteResponse {
  images: Record<CrmSiteImageSlot, CrmSiteImage[]>;
  settings: CrmSiteSettings;
}

export interface CrmCategoryCount {
  category: CrmCategory;
  count: number;
}

export interface CrmSitemapEntry {
  type: 'tour' | 'place';
  slug: string;
  updatedAt: string;
}

/** `POST /public/enquiries` request body. */
export type CrmEnquiryKind = 'ENQUIRY' | 'BROCHURE_REQUEST' | 'RESERVE_SEAT' | 'CUSTOM_TRIP';

export interface CrmEnquiryRequest {
  kind: CrmEnquiryKind;
  name: string;
  phone: string;
  email?: string;
  message?: string;
  tourSlug?: string;
  departureDate?: string;
  travellers?: number;
  preferredMonth?: string;
  placeSlugs?: string[];
  travelStyle?: string;
  consent: true;
  turnstileToken: string;
  /**
   * Should be empty/absent for a real visitor. Typed as a general `string`,
   * not the literal `''`: CRM-migration Step 3's honeypot is a real hidden
   * form field a BOT can fill with anything, and the whole point is to
   * forward whatever it typed untouched (contract's own wording: "a filled
   * value is treated as a bot") rather than rejecting it before the CRM
   * ever sees it. Never populate this from a REAL visitor's input.
   */
  honeypot?: string;
}

/** Always `{ ok: true }` — whether a lead was created, noted, or the honeypot caught a bot. */
export interface CrmEnquiryResponse {
  ok: true;
}

/** The CRM's own error envelope — Nest's standard shape wrapping `{code, message}`. */
export interface CrmErrorBody {
  statusCode: number;
  error: string;
  message: {
    code: string;
    message: string;
  };
}

export type CrmErrorCode =
  | 'NOT_FOUND'
  | 'VALIDATION_FAILED'
  | 'API_KEY_INVALID'
  | 'RATE_LIMITED'
  | 'NOT_CONFIGURED';
