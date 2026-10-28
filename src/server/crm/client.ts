import 'server-only';

import type { z } from 'zod';

import { getCrmApiUrl, getWebsiteApiKey, isBuildPhase } from './config';
import {
  crmCategoryCountSchema,
  crmDeparturesTourCardSchema,
  crmPlaceSchema,
  crmSiteImageSchema,
  crmSiteSettingsSchema,
  crmSitemapEntrySchema,
  crmTourBySlugResponseSchema,
  crmTourCardSchema,
  parseArrayLeniently,
} from './schemas';
import type {
  CrmCategory,
  CrmCategoryCount,
  CrmDeparturesResponse,
  CrmEnquiryRequest,
  CrmEnquiryResponse,
  CrmErrorBody,
  CrmPlace,
  CrmSiteImage,
  CrmSiteResponse,
  CrmSitemapEntry,
  CrmTourDetail,
  CrmTourListResponse,
  CrmTourRedirect,
} from './types';

/**
 * The ONE module that talks to the CRM's `/api/public/*` surface. Every
 * content-reading page/adapter and the enquiry route call through here —
 * never `fetch()` a CRM URL anywhere else — so the base URL, the API key
 * header, the error shape and the cache-tag scheme are each defined exactly
 * once.
 */

export class CrmApiError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'CrmApiError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

/** A response the CRM returned but this client could not parse as its documented error envelope. */
export class CrmUnexpectedResponseError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, bodySnippet: string) {
    super(`CRM returned ${statusCode} with an unrecognised body: ${bodySnippet.slice(0, 200)}`);
    this.name = 'CrmUnexpectedResponseError';
    this.statusCode = statusCode;
  }
}

/**
 * Production incident 2026-10-27 — a `200` response that parses as JSON
 * but does not match this endpoint's documented shape (`schemas.ts`).
 * Distinct from `CrmUnexpectedResponseError`, which is for a body that does
 * not even look like the contract's success-or-error envelope at all; this
 * is for "it parsed, but a field is the wrong type or a required one is
 * missing" — e.g. a `GET /public/tours` entry whose `primaryPlace` is a
 * string instead of an object.
 *
 * The message is built by `describeSchemaMismatch()` below, which names
 * the endpoint and the exact field path(s) that failed — the generic
 * `ZodError` dump buries that under a stack of nested issue objects with
 * no indication of which request produced them.
 */
export class CrmSchemaMismatchError extends Error {
  readonly path: string;

  constructor(path: string, issues: z.ZodIssue[]) {
    const fieldSummary = issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    super(`${path} returned a response that does not match its documented shape — ${fieldSummary}`);
    this.name = 'CrmSchemaMismatchError';
    this.path = path;
  }
}

/**
 * Validates `parsed` against `schema`, logging a clear, endpoint-named
 * message and throwing `CrmSchemaMismatchError` on a mismatch — never lets
 * a shape error reach a component as a blind cast (`as T`) would, and
 * never lets it surface as Zod's own unlabelled error either.
 *
 * Only `getTourBySlug()` still calls this directly (see that function's own
 * comment for why a single tour page is allowed to fail on its own, scoped
 * failure). Every other read below has its own lenient parser instead — see
 * `withFallback()`'s comment for why.
 */
function validateCrmResponse<Schema extends z.ZodType>(path: string, schema: Schema, parsed: unknown): z.infer<Schema> {
  const result = schema.safeParse(parsed);
  if (!result.success) {
    const error = new CrmSchemaMismatchError(path, result.error.issues);
    console.error(`[crm] ${error.message}`);
    throw error;
  }
  return result.data;
}

function isErrorBody(value: unknown): value is CrmErrorBody {
  if (typeof value !== 'object' || value === null) return false;
  const body = value as Record<string, unknown>;
  return (
    typeof body.statusCode === 'number' &&
    typeof body.message === 'object' &&
    body.message !== null &&
    typeof (body.message as Record<string, unknown>).code === 'string'
  );
}

export interface FetchCrmOptions {
  /** Appended to `getCrmApiUrl()`, e.g. `/public/tours`. Must start with `/`. */
  path: string;
  method?: 'GET' | 'POST';
  /** Serialised as `?key=value` pairs; `undefined` values are omitted. */
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  /**
   * Next's data-cache knobs. `revalidate` mirrors the contract's own
   * `s-maxage=60` guidance; `tags` are what `POST /api/revalidate`
   * (`src/app/api/revalidate/route.ts`) calls `revalidateTag()` with, so a
   * CRM-side save can invalidate exactly the reads it affects without
   * waiting out the 60s window.
   */
  revalidate?: number | false;
  tags?: string[];
}

function buildUrl(path: string, query?: Record<string, string | number | undefined>): string {
  const url = new URL(`${getCrmApiUrl()}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/**
 * The one `fetch()` call site. Parses the CRM's documented error envelope on
 * a non-2xx response and throws `CrmApiError`; a body this client cannot
 * recognise throws `CrmUnexpectedResponseError` rather than silently
 * returning `undefined` as if the call had succeeded.
 *
 * Network failures and timeouts propagate as whatever `fetch` itself throws
 * — callers decide whether that is a hard failure (most reads, with the CRM
 * as the single source of truth per the migration decision) or something to
 * degrade gracefully, case by case.
 */
async function fetchCrm<T>(options: FetchCrmOptions): Promise<T> {
  const { path, method = 'GET', query, body, headers, revalidate = 60, tags } = options;

  const response = await fetch(buildUrl(path, query), {
    method,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    // Next's fetch-cache integration. POST requests are never cached by
    // fetch regardless of these options; harmless to pass them for both.
    next: { revalidate, tags },
  });

  const rawText = await response.text();
  let parsed: unknown;
  try {
    parsed = rawText.length > 0 ? JSON.parse(rawText) : undefined;
  } catch {
    if (!response.ok) throw new CrmUnexpectedResponseError(response.status, rawText);
    throw new CrmUnexpectedResponseError(response.status, rawText);
  }

  if (!response.ok) {
    if (isErrorBody(parsed)) {
      throw new CrmApiError(parsed.statusCode, parsed.message.code, parsed.message.message);
    }
    throw new CrmUnexpectedResponseError(response.status, rawText);
  }

  return parsed as T;
}

/**
 * Catches a failure from `fn()` ONLY during `next build`
 * (`isBuildPhase()`) and returns `fallback` instead — a real runtime
 * failure (network error, `CrmApiError`, `CrmUnexpectedResponseError`)
 * still propagates exactly as before. Used by `getTours`/`getDepartures`/
 * `getCategories`/`getSitemap` — NOT `getSite`/`getPlaces`, which use
 * `withFallbackAlways()` below instead; see that function's own comment
 * for why those two are different.
 *
 * `next build` on Railway evaluates every statically-renderable page, which
 * calls these read functions for real, during the build step — and
 * Railway's private network (where `gty-crm.railway.internal`, the default
 * `CRM_API_URL`, actually resolves) does not exist yet at build time. The
 * build died with `getaddrinfo ENOTFOUND gty-crm.railway.internal` from
 * this exact file (production incident 2026-10-27, #1). At RUNTIME, a real
 * CRM outage or rejection is still a real, loud failure, by design (the
 * migration's own "CRM is the single source of truth" decision) —
 * unchanged from before incident #2. What DID change in incident #2: a
 * SCHEMA mismatch (the CRM sending valid, healthy data this client's
 * schema was too strict to accept) must never reach this function as a
 * throw in the first place — each of these four reads now parses its own
 * top-level array LENIENTLY (one bad row dropped, the rest kept — see
 * `parseArrayLeniently` in schemas.ts) BEFORE calling this wrapper, so a
 * schema issue degrades to "fewer rows, logged" without ever needing to
 * fall back to the fully-empty shape below. This function is now the last
 * resort for a response that is not even shaped like the right endpoint at
 * all (not JSON, a wrong top-level key) — not the first line of defence.
 */
async function withBuildPhaseFallback<T>(path: string, fallback: T, fn: () => Promise<T>): Promise<T> {
  if (!isBuildPhase()) return fn();

  try {
    return await fn();
  } catch (error) {
    // Expected and tolerated here — `console.warn`, not `console.error` —
    // and the build keeps going.
    console.warn(
      `[crm] ${path}: unreachable during next build (expected if CRM_API_URL resolves only at runtime, ` +
        `e.g. a Railway-internal address) — using the fallback data for this page; it will revalidate on the ` +
        `first real request: ${error instanceof Error ? error.message : String(error)}`
    );
    return fallback;
  }
}

/**
 * Catches ANY failure from `fn()` — a network error, `CrmApiError`,
 * `CrmUnexpectedResponseError`, or `CrmSchemaMismatchError` — in EITHER
 * phase, build or runtime, and returns `fallback` instead of letting it
 * propagate. Used ONLY by `getSite()`/`getPlaces()`.
 *
 * ## Why these two, specifically, are different from every other read
 *
 * `SiteShell` calls `getSite()` and `getPlaces()` from EVERY single page —
 * header, footer, contact details. Production incident 2026-10-27 (#2):
 * `GET /public/site` sending `alt: null` on a site image (real, healthy
 * CRM data, not an outage) made the old strict schema throw
 * `CrmSchemaMismatchError`, and because that throw was only shielded
 * during the build phase (`withBuildPhaseFallback`'s original design, back
 * when it was this function too), it reached `SiteShell` at RUNTIME on
 * every request, taking the ENTIRE site down with a real HTTP 500 — not
 * just the one endpoint, every page that renders the header/footer, which
 * is all of them.
 *
 * `force-dynamic` (added earlier the same day, for a Railway build OOM)
 * made this worse than it would once have been: these pages have no
 * "last successfully generated page" left to fall back to via ISR, so a
 * thrown error here is not a stale-but-working page, it is a real 500 on
 * every request, forever, until a human redeploys a fix. Given that,
 * `getSite()`/`getPlaces()` specifically must ALWAYS produce something
 * renderable — the empty/all-`null` shapes below are exactly the states
 * the UI already renders correctly on purpose (`resolveSiteContact()`
 * falling back to the static `gty-contact` constants for a `null` phone/
 * email, `DestinationsRail` returning `null` for an empty `places` array)
 * — so using them on ANY failure, including a real CRM outage, is a
 * deliberate exception to the "CRM is the single source of truth, a real
 * outage should be loud" decision: a real CRM outage degrading the
 * header/footer to static defaults for a few minutes is an acceptable,
 * recoverable trade-off; the SAME outage crashing every page on the site
 * is not. Every OTHER read (`getTours` etc.) keeps the louder behaviour —
 * see `withBuildPhaseFallback()`'s own comment for why those are scoped
 * differently.
 */
async function withFallbackAlways<T>(path: string, fallback: T, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const duringBuild = isBuildPhase();
    const message = error instanceof Error ? error.message : String(error);
    if (duringBuild) {
      console.warn(
        `[crm] ${path}: unreachable during next build (expected if CRM_API_URL resolves only at runtime, ` +
          `e.g. a Railway-internal address) — using the fallback data for this page; it will revalidate on the ` +
          `first real request: ${message}`
      );
    } else {
      // A real runtime failure. Still `console.error` (worth paging on),
      // but NEVER re-thrown — see this function's own comment for why a
      // thrown error here is the exact failure mode that took the whole
      // site down on 2026-10-27.
      console.error(`[crm] ${path}: failed at runtime — serving the fallback data for this request instead of a 500: ${message}`);
    }
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export interface TourListParams {
  category?: CrmCategory;
  place?: string;
  month?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

export async function getTours(params: TourListParams = {}): Promise<CrmTourListResponse> {
  const path = 'GET /public/tours';
  const fallback: CrmTourListResponse = { tours: [], total: 0, page: params.page ?? 1, pageSize: params.pageSize ?? 12 };
  return withBuildPhaseFallback(path, fallback, async () => {
    const body = await fetchCrm<unknown>({ path: '/public/tours', query: { ...params }, tags: ['crm:tours'] });
    const raw = (body ?? {}) as Record<string, unknown>;
    const { parsed: tours } = parseArrayLeniently(path, crmTourCardSchema, Array.isArray(raw.tours) ? raw.tours : []);
    return {
      tours,
      total: typeof raw.total === 'number' ? raw.total : tours.length,
      page: typeof raw.page === 'number' ? raw.page : fallback.page,
      pageSize: typeof raw.pageSize === 'number' ? raw.pageSize : fallback.pageSize,
    };
  });
}

export type TourBySlugResult =
  | { status: 'found'; tour: CrmTourDetail }
  | { status: 'redirect'; redirectTo: string }
  | { status: 'not-found' };

/**
 * The one method that has to tell apart THREE outcomes the contract gives
 * one HTTP status to (`200`) for two of them: a real tour, a `{redirectTo}`
 * body for a retired-but-still-existing slug, and — via a real `404` — a
 * slug that is neither. Every caller (today, just the detail page; any
 * future API route would too) must handle all three; none of them may
 * assume `200` means "here is a tour".
 *
 * NOT wrapped in `withFallback()`, unlike every other read in this file —
 * a deliberate exception, re-confirmed during incident 2's (2026-10-27)
 * audit: there is no sensible SAFE fallback value for "one specific tour".
 * Returning `{status: 'not-found'}` on a schema mismatch would be actively
 * wrong (a real, live tour wrongly 404ing — worse for SEO and for a
 * visitor who followed a real link than a scoped error page), and there is
 * no "empty tour" shape the detail page could render instead. A failure
 * here is scoped to exactly one tour's page — never the whole site, since
 * `SiteShell` never calls this — and is already caught by `src/app/error.tsx`
 * at the page boundary, so a mismatch here degrades to one page showing a
 * friendly error, not a 500 with no UI at all. The detail page also has no
 * `generateStaticParams()` (removed in CRM-migration Step 2 — "resolves on
 * demand"), so this is never called during `next build`, only at request
 * time.
 */
export async function getTourBySlug(slug: string): Promise<TourBySlugResult> {
  try {
    const raw = await fetchCrm<unknown>({
      path: `/public/tours/${encodeURIComponent(slug)}`,
      tags: ['crm:tours', `crm:tour:${slug}`],
    });
    const body = validateCrmResponse(`GET /public/tours/${slug}`, crmTourBySlugResponseSchema, raw) as
      | CrmTourDetail
      | CrmTourRedirect;
    if ('redirectTo' in body) return { status: 'redirect', redirectTo: body.redirectTo };
    return { status: 'found', tour: body };
  } catch (error) {
    if (error instanceof CrmApiError && error.statusCode === 404) return { status: 'not-found' };
    throw error;
  }
}

export interface DeparturesParams {
  month?: string;
  q?: string;
}

/** The all-`null`/all-`false` shape `getSite()` falls back to on ANY failure (build-time unreachability or a runtime failure — see `withFallback()`/`getSite()`'s own comments) — identical to what the contract itself documents for a site the Owner has never configured ("every settings field is `null` until... saved"), so every existing consumer (`resolveSiteContact()`, `toSiteStatsSummary()`) already renders it correctly with no new code. */
const EMPTY_SITE_RESPONSE: CrmSiteResponse = {
  images: { HERO_BACKGROUND: [], ABOUT: [], GALLERY: [], FOOTER: [] },
  settings: {
    heroHeadline: null,
    heroSubtext: null,
    happyTravellersLabel: null,
    destinationsLabel: null,
    yearsExperienceLabel: null,
    showFiguresNote: false,
    phone: null,
    whatsappNumber: null,
    email: null,
    instagramUrl: null,
    address: null,
    profileVideoUrl: null,
  },
};

export async function getDepartures(params: DeparturesParams = {}): Promise<CrmDeparturesResponse> {
  const path = 'GET /public/departures';
  return withBuildPhaseFallback(path, { departures: [], months: [] }, async () => {
    const body = await fetchCrm<unknown>({ path: '/public/departures', query: { ...params }, tags: ['crm:departures'] });
    const raw = (body ?? {}) as Record<string, unknown>;
    const { parsed: departures } = parseArrayLeniently(
      path,
      crmDeparturesTourCardSchema,
      Array.isArray(raw.departures) ? raw.departures : []
    );
    const months = Array.isArray(raw.months) ? raw.months.filter((m): m is string => typeof m === 'string') : [];
    return { departures, months };
  });
}

export async function getPlaces(): Promise<CrmPlace[]> {
  const path = 'GET /public/places';
  return withFallbackAlways(path, [], async () => {
    const body = await fetchCrm<unknown>({ path: '/public/places', tags: ['crm:places'] });
    const { parsed: places } = parseArrayLeniently(path, crmPlaceSchema, Array.isArray(body) ? body : []);

    // Production incident 2026-10-27 — logged ONCE per response (not once
    // per place) so a catalogue-wide field rename produces one line, not
    // one per row. See `crmPlaceSchema`'s own comment in schemas.ts for
    // why this is tolerated rather than rejected.
    if (places.some((place) => place._usedLiveToursFallback)) {
      console.warn(
        '[crm] GET /public/places: at least one place has `liveTours` but no `liveTourCount` — ' +
          "the contract document (documentation/technical-specification/public-website.md) documents " +
          '`liveTourCount`; the real CRM is sending `liveTours`. Tolerated (normalised to `liveTourCount`), ' +
          'but this is a genuine contract/reality drift worth reconciling on the CRM side.'
      );
    }

    // Destructured only to OMIT it from the returned `CrmPlace` shape —
    // the whole point is that nothing downstream of this function ever
    // sees `_usedLiveToursFallback` at all.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return places.map(({ _usedLiveToursFallback, ...place }) => place);
  });
}

/**
 * The critical one — `SiteShell` calls this from EVERY page (header,
 * footer, contact details). Incident 2 (2026-10-27): this used to call
 * `validateCrmResponse()` (a strict, whole-response, throw-on-mismatch
 * schema) and only shielded the throw during `next build`. A real
 * `GET /public/site` response with `alt: null` on a site image made that
 * throw at RUNTIME too, on every single page, taking the entire site
 * down. Now: every sub-piece is parsed as leniently as the data allows —
 * each image array drops only its own bad entries, and a malformed
 * `settings` object falls back to the hard-coded defaults on its own
 * (logged), without affecting the images — and the whole thing is still
 * wrapped in `withFallback()` so even a completely malformed/non-JSON
 * response falls back to `EMPTY_SITE_RESPONSE` instead of throwing.
 */
export async function getSite(): Promise<CrmSiteResponse> {
  const path = 'GET /public/site';
  return withFallbackAlways(path, EMPTY_SITE_RESPONSE, async () => {
    const body = await fetchCrm<unknown>({ path: '/public/site', tags: ['crm:site'] });
    const raw = (body ?? {}) as Record<string, unknown>;
    const imagesRaw = (raw.images ?? {}) as Record<string, unknown>;

    const parseImageSlot = (slot: string): CrmSiteImage[] => {
      const slotPath = `${path} images.${slot}`;
      const items = Array.isArray(imagesRaw[slot]) ? (imagesRaw[slot] as unknown[]) : [];
      return parseArrayLeniently(slotPath, crmSiteImageSchema, items).parsed;
    };

    const images = {
      HERO_BACKGROUND: parseImageSlot('HERO_BACKGROUND'),
      ABOUT: parseImageSlot('ABOUT'),
      GALLERY: parseImageSlot('GALLERY'),
      FOOTER: parseImageSlot('FOOTER'),
    };

    const settingsResult = crmSiteSettingsSchema.safeParse(raw.settings);
    if (!settingsResult.success) {
      console.error(
        `[crm] ${path} settings: did not match the documented shape — using the hard-coded default settings ` +
          `for this request. ${settingsResult.error.issues
            .slice(0, 3)
            .map((issue: z.ZodIssue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
            .join('; ')}`
      );
    }
    const settings = settingsResult.success ? settingsResult.data : EMPTY_SITE_RESPONSE.settings;

    return { images, settings };
  });
}

export async function getCategories(): Promise<CrmCategoryCount[]> {
  const path = 'GET /public/categories';
  return withBuildPhaseFallback(path, [], async () => {
    const body = await fetchCrm<unknown>({ path: '/public/categories', tags: ['crm:categories'] });
    return parseArrayLeniently(path, crmCategoryCountSchema, Array.isArray(body) ? body : []).parsed;
  });
}

export async function getSitemap(): Promise<CrmSitemapEntry[]> {
  const path = 'GET /public/sitemap';
  // Deliberately NOT tagged with the other content tags — this is its own
  // endpoint on its own rate-limit budget (120/min vs 600/min, per the
  // contract) and nothing revalidates it as a side effect of a tour/place
  // save; the CRM's revalidation hook does not name a `sitemap` path.
  return withBuildPhaseFallback(path, [], async () => {
    const body = await fetchCrm<unknown>({ path: '/public/sitemap', revalidate: 60 });
    return parseArrayLeniently(path, crmSitemapEntrySchema, Array.isArray(body) ? body : []).parsed;
  });
}

// ---------------------------------------------------------------------------
// The one write: enquiries
// ---------------------------------------------------------------------------

export class WebsiteApiKeyNotConfiguredError extends Error {
  constructor() {
    super('WEBSITE_API_KEY is not set — refusing to call POST /public/enquiries without it.');
    this.name = 'WebsiteApiKeyNotConfiguredError';
  }
}

/**
 * `POST /public/enquiries` — the CRM's single write endpoint, and the only
 * one this client ever calls with a mutating method.
 *
 * Refuses to call out at all when `WEBSITE_API_KEY` is unset, rather than
 * sending a request with a missing/empty header the CRM would answer `401`
 * for — the distinction matters for the caller's own logging (misconfigured
 * environment vs. a real CRM rejection).
 *
 * NEVER CALL THIS FROM A TEST AGAINST THE REAL CRM. Every test in this repo
 * must point `CRM_API_URL` at a local fake server (see
 * `src/server/crm/test-support/fake-crm-server.ts`) — this function has no
 * test-mode flag of its own, because a flag is one more thing that could be
 * wired wrong and fire a real enquiry.
 */
export async function submitEnquiry(payload: CrmEnquiryRequest): Promise<CrmEnquiryResponse> {
  const apiKey = getWebsiteApiKey();
  if (!apiKey) throw new WebsiteApiKeyNotConfiguredError();

  return fetchCrm<CrmEnquiryResponse>({
    path: '/public/enquiries',
    method: 'POST',
    body: payload,
    headers: { 'x-website-api-key': apiKey },
    // POSTs are not cached by fetch regardless; `revalidate: false` just
    // documents the intent.
    revalidate: false,
  });
}
