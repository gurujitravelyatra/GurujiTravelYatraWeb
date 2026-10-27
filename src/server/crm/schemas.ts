import { z } from 'zod';

/**
 * Zod schemas for the CRM's `/api/public/*` surface, added 2026-10-27 after
 * a real production incident: this client trusted every response's shape
 * with a blind `as T` cast (no runtime check at all), and the real deployed
 * CRM's data is sparser than either the contract document's own examples or
 * this project's test fixtures ever exercised — a `null` `primaryPlace` on
 * `GET /public/tours` reached `tour.primaryPlace.name` and 500'd `/` and
 * `/tour-packages`.
 *
 * ## What these schemas are FOR, and what they are deliberately NOT for
 *
 * They exist to turn a shape mismatch into a CLEAR, NAMED log line —
 * "`GET /public/places` returned a `places[2].liveTourCount` that isn't a
 * number" — instead of either (a) a blind cast that lets bad data reach a
 * component and crash with a generic `TypeError`, or (b) Zod's own default
 * error, which is accurate but lists every issue in a dense, unlabelled
 * dump that does not say WHICH ENDPOINT produced it.
 *
 * They are NOT a strict contract-compliance gate. Two known, CONFIRMED
 * real-world gaps are modelled as tolerated, not rejected:
 *
 *  - `CrmTourCard.primaryPlace` is `.nullable()` here, matching the type
 *    fix in `types.ts` — the contract document's own examples never show
 *    this null, but the real CRM does, and this is a real, healthy state
 *    ("the CRM API itself is healthy" — production incident report), not
 *    a bug to reject.
 *  - `CrmPlace` accepts EITHER `liveTourCount` (the contract document's
 *    documented name) OR `liveTours` (what the real deployed CRM actually
 *    sends) and normalises to `liveTourCount` — see `placeSchema`'s own
 *    comment. `description` is optional, since the real payload omits it
 *    and nothing in this codebase reads it.
 *
 * Every other genuine type error (a string where a number belongs, a
 * missing REQUIRED field) still fails validation and is logged — this is
 * about tolerating two specific, confirmed gaps, not about accepting
 * anything.
 */

const crmMoneySchema = z.object({ amount: z.number(), currency: z.string() });

export const crmCategorySchema = z.enum(['Spiritual', 'Adventure', 'International', 'Family', 'Group']);

const crmPlaceRefSchema = z.object({ name: z.string(), slug: z.string() });

const crmNextDepartureSchema = z.object({ date: z.string(), seatsLeft: z.number() });

export const crmTourCardSchema = z.object({
  slug: z.string(),
  name: z.string(),
  category: crmCategorySchema,
  shortDescription: z.string(),
  coverImageUrl: z.string(),
  price: crmMoneySchema,
  durationDays: z.number(),
  durationNights: z.number(),
  departureCity: z.null(),
  // Production incident 2026-10-27: confirmed real, healthy state — see
  // this file's own header.
  primaryPlace: crmPlaceRefSchema.nullable(),
  nextDeparture: crmNextDepartureSchema.nullable(),
  hasBrochure: z.boolean(),
});

export const crmTourListResponseSchema = z.object({
  tours: z.array(crmTourCardSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

const crmItineraryDaySchema = z.object({ day: z.number(), title: z.string(), detail: z.string() });
const crmGalleryImageSchema = z.object({ url: z.string(), alt: z.string() });
const crmPricingOptionSchema = z.object({ label: z.string(), note: z.string(), price: crmMoneySchema });
const crmTourDepartureSchema = z.object({
  date: z.string(),
  returnDate: z.string().nullable(),
  price: crmMoneySchema.nullable(),
  seatsLeft: z.number(),
  soldOut: z.boolean(),
});

export const crmTourDetailSchema = crmTourCardSchema.extend({
  description: z.string(),
  highlights: z.array(z.string()),
  itinerary: z.array(crmItineraryDaySchema),
  inclusions: z.array(z.string()),
  exclusions: z.array(z.string()),
  cancellationPolicy: z.string(),
  gallery: z.array(crmGalleryImageSchema),
  brochureUrl: z.string().nullable(),
  places: z.array(crmPlaceRefSchema),
  pricingOptions: z.array(crmPricingOptionSchema),
  departures: z.array(crmTourDepartureSchema),
  seoTitle: z.string(),
  seoDescription: z.string(),
});

export const crmTourRedirectSchema = z.object({ redirectTo: z.string() });

/** `GET /public/tours/:slug` — a found tour OR a redirect body, never neither. */
export const crmTourBySlugResponseSchema = z.union([crmTourDetailSchema, crmTourRedirectSchema]);

const crmDeparturesTourCardSchema = crmTourCardSchema.extend({ departureDate: z.string() });

export const crmDeparturesResponseSchema = z.object({
  departures: z.array(crmDeparturesTourCardSchema),
  months: z.array(z.string()),
});

/**
 * Production incident 2026-10-27: the real deployed CRM sends
 * `liveTours`, not the contract document's documented `liveTourCount` —
 * and omits `description` entirely, which the contract document shows as
 * required. `.transform()` normalises both gaps to the one shape the rest
 * of this codebase reads (`CrmPlace` in `types.ts`), so every consumer
 * keeps reading `place.liveTourCount`/`place.description` and never has
 * to know which wire name actually arrived. This does NOT silently hide
 * the drift: `fetchCrm()` logs a named warning whenever the fallback name
 * is the one that matched — see its own comment.
 */
export const crmPlaceSchema = z
  .object({
    name: z.string(),
    slug: z.string(),
    region: z.string(),
    description: z.string().optional(),
    imageUrl: z.string(),
    showInCustomBuilder: z.boolean(),
    liveTourCount: z.number().optional(),
    liveTours: z.number().optional(),
  })
  .transform((place) => ({
    name: place.name,
    slug: place.slug,
    region: place.region,
    description: place.description ?? '',
    imageUrl: place.imageUrl,
    showInCustomBuilder: place.showInCustomBuilder,
    liveTourCount: place.liveTourCount ?? place.liveTours ?? 0,
    /** Set only when the fallback name is what actually matched — `fetchCrm()` logs this once per response, not per place, to avoid flooding the log for a catalogue-wide rename. */
    _usedLiveToursFallback: place.liveTourCount === undefined && place.liveTours !== undefined,
  }));

export const crmPlacesResponseSchema = z.array(crmPlaceSchema);

const crmSiteImageSchema = z.object({ url: z.string(), alt: z.string() });

const crmSiteSettingsSchema = z.object({
  heroHeadline: z.string().nullable(),
  heroSubtext: z.string().nullable(),
  happyTravellersLabel: z.string().nullable(),
  destinationsLabel: z.string().nullable(),
  yearsExperienceLabel: z.string().nullable(),
  showFiguresNote: z.boolean(),
  phone: z.string().nullable(),
  whatsappNumber: z.string().nullable(),
  email: z.string().nullable(),
  instagramUrl: z.string().nullable(),
  address: z.string().nullable(),
  profileVideoUrl: z.string().nullable(),
});

export const crmSiteResponseSchema = z.object({
  images: z.object({
    HERO_BACKGROUND: z.array(crmSiteImageSchema),
    ABOUT: z.array(crmSiteImageSchema),
    GALLERY: z.array(crmSiteImageSchema),
    FOOTER: z.array(crmSiteImageSchema),
  }),
  settings: crmSiteSettingsSchema,
});

export const crmCategoryCountSchema = z.object({ category: crmCategorySchema, count: z.number() });
export const crmCategoriesResponseSchema = z.array(crmCategoryCountSchema);

export const crmSitemapEntrySchema = z.object({
  type: z.enum(['tour', 'place']),
  slug: z.string(),
  updatedAt: z.string(),
});
export const crmSitemapResponseSchema = z.array(crmSitemapEntrySchema);
