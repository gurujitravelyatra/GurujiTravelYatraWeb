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
 */
export interface CrmTourCard {
  slug: string;
  name: string;
  category: CrmCategory;
  shortDescription: string;
  coverImageUrl: string;
  price: CrmMoney;
  durationDays: number;
  durationNights: number;
  departureCity: null;
  primaryPlace: CrmPlaceRef;
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
