import { z } from 'zod';

/**
 * Zod schemas for the CRM's `/api/public/*` surface.
 *
 * ## Incident history — read before touching a field's nullability
 *
 * 2026-10-27, incident 1: this client trusted every response's shape with
 * a blind `as T` cast (no runtime check at all). `GET /public/tours`
 * returned `"primaryPlace": null` for a tour with no place assigned —
 * real, healthy CRM data the contract document's own examples never show
 * — and reached `tour.primaryPlace.name` unguarded, 500ing `/` and
 * `/tour-packages`. Fix: these schemas, to turn a shape mismatch into a
 * clear, named log line instead of either a blind cast reaching a
 * component as a generic crash, or Zod's own unlabelled error dump.
 *
 * 2026-10-27, incident 2 (SAME DAY — caused by incident 1's own fix):
 * `GET /public/site` sends `"alt": null` on a site image with no alt
 * text — also real, healthy data — and the schemas above made THAT a
 * `required string`, so `validateCrmResponse()` (client.ts) THREW on
 * every single page (`SiteShell` calls `getSite()` from all of them),
 * taking the entire site down with a real HTTP 500. The schema was too
 * strict in a NEW place; being more careful about one field is not a
 * structural fix, because the next unanticipated null does the same
 * thing. The actual structural fix is in client.ts: no read function in
 * this file's domain throws on a validation failure anymore, ever — see
 * `withFallback()`'s own comment there. This file's job narrowed to
 * exactly what it should always have been: being as PERMISSIVE as the
 * CRM's real, confirmed behaviour warrants, logged clearly when it isn't,
 * never a gate that can take the site down by being wrong.
 *
 * ## The nullability audit (incident 2, point 1)
 *
 * Every field below that the CRM's own database can plausibly leave
 * empty is now `.nullable()`/`.optional()`, normalised (via
 * `.transform()`) to a safe default the EXISTING UI already renders
 * correctly — an empty string renders as nothing, an empty array maps to
 * nothing, `safeMediaUrl('')` already falls through to
 * `PhotoPlaceholder`'s neutral box. Only `primaryPlace` (and the
 * already-nullable settings/`nextDeparture`/`brochureUrl`/`price` fields
 * from before this incident) are exposed to the TYPE SYSTEM as nullable —
 * everywhere else, the transform absorbs the `null` so no new call site
 * needs its own null check:
 *
 *  - Alt text (`CrmSiteImage.alt`, `CrmGalleryImage.alt`) — THE field
 *    from the crash log, and the whole reason this audit happened.
 *  - `CrmPlace.region`/`imageUrl`, `CrmTourCard.shortDescription`/
 *    `coverImageUrl`, `CrmTourDetail.description`/`cancellationPolicy` —
 *    free-text/URL fields with no confirmed-required reason to exist on
 *    every row.
 *  - `CrmTourCard.price` — now genuinely `CrmMoney | null` (not
 *    normalised away): `formatCrmPrice()` (src/lib/rupees.ts) already
 *    accepts `null | undefined` and renders "Price on request", so this
 *    is the one field where exposing the real null is both safe and more
 *    honest than inventing a ₹0 price.
 *  - `CrmTourDetail.seoTitle`/`seoDescription` — default to the tour's
 *    own `name`/`shortDescription` when unset, satisfying incident 2's
 *    point 3 ("default to the tour/place/site name") for the one place in
 *    this file where the fallback has an obvious, correct value.
 *  - Every array this file declares (`highlights`, `itinerary`,
 *    `inclusions`, `exclusions`, `gallery`, `places`, `pricingOptions`,
 *    `departures` on a tour; `months` on departures) defaults to `[]` if
 *    missing/null entirely, not just if each ITEM is well-formed.
 *
 * ## Lenient array parsing (incident 2, point 2, the list-endpoint half)
 *
 * `parseArrayLeniently()` below validates a list ONE ITEM AT A TIME and
 * drops only the items that fail, logging once per call with a count —
 * never the whole list for one bad row. Used for every top-level array
 * response (`tours`, `places`, `categories`, `sitemap`) so a single
 * malformed CRM row degrades to "N-1 shown, 1 dropped and logged" instead
 * of the entire page losing its content (or, before this incident, the
 * entire SITE).
 */

const crmMoneySchema = z.object({ amount: z.number(), currency: z.string() });

export const crmCategorySchema = z.enum(['Spiritual', 'Adventure', 'International', 'Family', 'Group']);

const crmPlaceRefSchema = z.object({ name: z.string(), slug: z.string() });

const crmNextDepartureSchema = z.object({ date: z.string(), seatsLeft: z.number() });

/** `null`/missing → `''`. Safe for any free-text field the UI already renders as plain text (nothing shows for an empty string). */
const nullableText = () =>
  z
    .string()
    .nullable()
    .optional()
    .transform((value) => value ?? '');

/** `null`/missing → `[]`. Safe for any array field a `.map()` already iterates (zero items renders nothing). */
const nullableArray = <T extends z.ZodTypeAny>(item: T) =>
  z
    .array(item)
    .nullable()
    .optional()
    .transform((value) => value ?? []);

export const crmTourCardSchema = z.object({
  slug: z.string(),
  name: z.string(),
  category: crmCategorySchema,
  shortDescription: nullableText(),
  // `null`/missing → `''`, which `safeMediaUrl('')` (src/lib/cloudinary-url.ts)
  // already treats as "no valid image" and falls through to
  // `PhotoPlaceholder`'s neutral box — no new call-site handling needed.
  coverImageUrl: nullableText(),
  // Genuinely nullable, not normalised away — `formatCrmPrice()` already
  // renders "Price on request" for `null`/`undefined`.
  price: crmMoneySchema.nullable(),
  durationDays: z.number(),
  durationNights: z.number(),
  departureCity: z.null(),
  // Incident 1 — confirmed real, healthy state.
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

const crmItineraryDaySchema = z.object({ day: z.number(), title: z.string(), detail: nullableText() });
/** `alt: null` is incident 2's own crash, confirmed from the real GET /public/site response. */
const crmGalleryImageSchema = z.object({ url: z.string(), alt: nullableText() });
const crmPricingOptionSchema = z.object({ label: z.string(), note: nullableText(), price: crmMoneySchema });
const crmTourDepartureSchema = z.object({
  date: z.string(),
  returnDate: z.string().nullable(),
  price: crmMoneySchema.nullable(),
  seatsLeft: z.number(),
  soldOut: z.boolean(),
});

export const crmTourDetailSchema = crmTourCardSchema
  .extend({
    description: nullableText(),
    highlights: nullableArray(z.string()),
    itinerary: nullableArray(crmItineraryDaySchema),
    inclusions: nullableArray(z.string()),
    exclusions: nullableArray(z.string()),
    cancellationPolicy: nullableText(),
    gallery: nullableArray(crmGalleryImageSchema),
    brochureUrl: z.string().nullable(),
    places: nullableArray(crmPlaceRefSchema),
    pricingOptions: nullableArray(crmPricingOptionSchema),
    departures: nullableArray(crmTourDepartureSchema),
    seoTitle: z.string().nullable().optional(),
    seoDescription: z.string().nullable().optional(),
  })
  // Defaults AFTER the base object's own fields are available — a missing
  // SEO field falls back to the tour's own name/description rather than
  // an empty `<title>`/meta tag, per incident 2 point 3's "default to the
  // tour/place/site name".
  .transform((tour) => ({
    ...tour,
    seoTitle: tour.seoTitle ?? tour.name,
    seoDescription: tour.seoDescription ?? tour.shortDescription,
  }));

export const crmTourRedirectSchema = z.object({ redirectTo: z.string() });

/** `GET /public/tours/:slug` — a found tour OR a redirect body, never neither. */
export const crmTourBySlugResponseSchema = z.union([crmTourDetailSchema, crmTourRedirectSchema]);

export const crmDeparturesTourCardSchema = crmTourCardSchema.extend({ departureDate: z.string() });

export const crmDeparturesResponseSchema = z.object({
  departures: nullableArray(crmDeparturesTourCardSchema),
  months: nullableArray(z.string()),
});

/**
 * Incident 1: the real deployed CRM sends `liveTours`, not the contract
 * document's documented `liveTourCount` — and omits `description`
 * entirely. `.transform()` normalises both gaps to the one shape the rest
 * of this codebase reads (`CrmPlace` in `types.ts`). Incident 2's audit
 * adds `region`/`imageUrl` to the same "default to empty, let the UI's
 * existing empty-string handling cope" treatment.
 */
export const crmPlaceSchema = z
  .object({
    name: z.string(),
    slug: z.string(),
    region: nullableText(),
    description: z.string().nullable().optional(),
    imageUrl: nullableText(),
    showInCustomBuilder: z.boolean(),
    liveTourCount: z.number().nullable().optional(),
    liveTours: z.number().nullable().optional(),
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
    _usedLiveToursFallback: place.liveTourCount == null && place.liveTours != null,
  }));

export const crmPlacesResponseSchema = z.array(crmPlaceSchema);

/** Incident 2's own crash: `alt: null` on a real `GET /public/site` response. */
export const crmSiteImageSchema = z.object({ url: z.string(), alt: nullableText() });

export const crmSiteSettingsSchema = z.object({
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
    HERO_BACKGROUND: nullableArray(crmSiteImageSchema),
    ABOUT: nullableArray(crmSiteImageSchema),
    GALLERY: nullableArray(crmSiteImageSchema),
    FOOTER: nullableArray(crmSiteImageSchema),
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

/**
 * Validates a list ONE ITEM AT A TIME, keeping every item that parses and
 * dropping (with one summary log line, not one per item) any that do
 * not — incident 2 point 2's list-endpoint half of "use whatever data DID
 * parse" rather than failing the whole response for one bad row.
 */
export function parseArrayLeniently<T>(
  path: string,
  // `any` for the Input param (not `z.ZodType<T>`, which defaults Input to
  // `T`/Output): every per-item schema here that normalises a nullable
  // wire field (`nullableText()`/`nullableArray()`/`.transform()`) has an
  // Input shape that genuinely differs from its Output (`T`) — pinning
  // Input to `T` makes TypeScript reject exactly those schemas, and
  // narrows generic inference for `T` itself to the wrong (partially
  // input-shaped) type at every call site.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  itemSchema: z.ZodType<T, z.ZodTypeDef, any>,
  items: unknown[]
): { parsed: T[]; droppedCount: number } {
  const parsed: T[] = [];
  let droppedCount = 0;

  for (const item of items) {
    const result = itemSchema.safeParse(item);
    if (result.success) {
      parsed.push(result.data);
    } else {
      droppedCount += 1;
    }
  }

  if (droppedCount > 0) {
    console.error(
      `[crm] ${path}: dropped ${droppedCount} of ${items.length} item(s) that did not match the documented shape — ` +
        'the rest of the list is shown as normal. Check recent CRM-side changes to this endpoint.'
    );
  }

  return { parsed, droppedCount };
}
