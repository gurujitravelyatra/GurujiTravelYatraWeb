import 'server-only';

import type { z } from 'zod';

import { getCrmApiUrl, getWebsiteApiKey, isBuildPhase } from './config';
import {
  crmCategoriesResponseSchema,
  crmDeparturesResponseSchema,
  crmPlacesResponseSchema,
  crmSiteResponseSchema,
  crmSitemapResponseSchema,
  crmTourBySlugResponseSchema,
  crmTourListResponseSchema,
} from './schemas';
import type {
  CrmCategory,
  CrmCategoryCount,
  CrmDeparturesResponse,
  CrmEnquiryRequest,
  CrmEnquiryResponse,
  CrmErrorBody,
  CrmPlace,
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
 * Fixes a real production incident (2026-10-27): `next build` on Railway
 * evaluates every statically-renderable page, which calls `getSite()`/
 * `getTours()`/etc for real, during the build step — and Railway's private
 * network (where `gty-crm.railway.internal`, the default `CRM_API_URL`,
 * actually resolves) does not exist yet at build time. The build died with
 * `getaddrinfo ENOTFOUND gty-crm.railway.internal` from this exact file.
 *
 * ## Build-time failure vs. runtime failure are different problems
 *
 * At RUNTIME, a `fetch()` failure during an ISR background revalidation is
 * already safe: Next's own ISR semantics catch a thrown render error and
 * keep serving the last successfully generated page (stale-while-
 * revalidate), logging the error without crashing the running server or
 * handing a visitor a 500. Nothing about that needs to change, and this
 * function does not touch it — `isBuildPhase()` is false at runtime, so
 * every runtime failure still propagates exactly as before.
 *
 * At BUILD time there IS no "last successfully generated page" yet — this
 * may be the very first attempt — so a thrown error has nothing to fall
 * back to and fails the whole `next build` command outright. The fix is
 * each read function's own existing "empty" shape (`{tours: [], total: 0,
 * ...}`, `[]`, `getSite()`'s all-`null` settings, etc.) — exactly the state
 * the UI already renders gracefully (`PackagesCatalogue`'s "No journeys
 * match this filter yet.", `DestinationsRail` returning `null` for an empty
 * `places` array, `resolveSiteContact()` falling back to the static
 * `gty-contact` constants for a `null` phone/email) — so the page the build
 * emits is a real, intentional "we're updating" state, not an error page.
 *
 * ## Why this still revalidates quickly once real traffic arrives
 *
 * Every read already passes `revalidate: 60` (`fetchCrm`'s own default, or
 * `getSitemap()`'s explicit one) — unchanged by this function. A page built
 * with the empty fallback above therefore still revalidates within 60
 * seconds of the first real request after deploy, the same window every
 * other page already uses; nothing here widens it. Reaching for a SHORTER
 * build-time-only `revalidate` was considered and rejected: Next determines
 * a route's cache lifetime from the values present at BUILD time, so a
 * page that only ever sees the fallback path at build enshrines whatever
 * revalidate window this function used for the page's ENTIRE static
 * lifetime, not just its first request — reusing the same 60s every other
 * read already carries keeps that lifetime identical and predictable
 * instead of adding a second, different number to reason about.
 *
 * ## Only `isBuildPhase()` narrows this — not "any network error, ever"
 *
 * This is deliberately NOT a general network-failure retry/fallback layer.
 * Outside the build phase, `withBuildPhaseFallback` is a no-op passthrough
 * that rethrows exactly as `fetchCrm` always has — a real request-time CRM
 * outage is still a real, loud failure to whatever ISR/error-boundary
 * machinery already handles it, by design (the migration's own "CRM is the
 * single source of truth" decision).
 */
async function withBuildPhaseFallback<T>(fallback: T, fn: () => Promise<T>): Promise<T> {
  if (!isBuildPhase()) return fn();

  try {
    return await fn();
  } catch (error) {
    // Expected and tolerated here — `console.warn`, not `console.error`,
    // and the build keeps going. A human reading the build log should be
    // able to tell this apart from a real bug at a glance.
    console.warn(
      '[crm] CRM unreachable during next build (expected if CRM_API_URL resolves only at runtime, ' +
        'e.g. a Railway-internal address) — using the empty fallback for this page; it will revalidate ' +
        'on the first real request:',
      error instanceof Error ? error.message : error
    );
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
  return withBuildPhaseFallback({ tours: [], total: 0, page: params.page ?? 1, pageSize: params.pageSize ?? 12 }, async () => {
    const body = await fetchCrm<unknown>({ path: '/public/tours', query: { ...params }, tags: ['crm:tours'] });
    return validateCrmResponse('GET /public/tours', crmTourListResponseSchema, body);
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
 * NOT wrapped in `withBuildPhaseFallback()`, unlike every other read in
 * this file: the detail page has no `generateStaticParams()` (removed in
 * CRM-migration Step 2 — "resolves on demand"), so this is never called
 * during `next build` at all, only at request time, where a real failure
 * should surface exactly as it always has.
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

/** The all-`null`/all-`false` shape `getSite()` falls back to during `next build` — identical to what the contract itself documents for a site the Owner has never configured ("every settings field is `null` until... saved"), so every existing consumer (`resolveSiteContact()`, `toSiteStatsSummary()`) already renders it correctly with no new code. */
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
  return withBuildPhaseFallback({ departures: [], months: [] }, async () => {
    const body = await fetchCrm<unknown>({ path: '/public/departures', query: { ...params }, tags: ['crm:departures'] });
    return validateCrmResponse('GET /public/departures', crmDeparturesResponseSchema, body);
  });
}

export async function getPlaces(): Promise<CrmPlace[]> {
  return withBuildPhaseFallback([], async () => {
    const body = await fetchCrm<unknown>({ path: '/public/places', tags: ['crm:places'] });
    const places = validateCrmResponse('GET /public/places', crmPlacesResponseSchema, body);

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

export async function getSite(): Promise<CrmSiteResponse> {
  return withBuildPhaseFallback(EMPTY_SITE_RESPONSE, async () => {
    const body = await fetchCrm<unknown>({ path: '/public/site', tags: ['crm:site'] });
    return validateCrmResponse('GET /public/site', crmSiteResponseSchema, body);
  });
}

export async function getCategories(): Promise<CrmCategoryCount[]> {
  return withBuildPhaseFallback([], async () => {
    const body = await fetchCrm<unknown>({ path: '/public/categories', tags: ['crm:categories'] });
    return validateCrmResponse('GET /public/categories', crmCategoriesResponseSchema, body);
  });
}

export async function getSitemap(): Promise<CrmSitemapEntry[]> {
  // Deliberately NOT tagged with the other content tags — this is its own
  // endpoint on its own rate-limit budget (120/min vs 600/min, per the
  // contract) and nothing revalidates it as a side effect of a tour/place
  // save; the CRM's revalidation hook does not name a `sitemap` path.
  return withBuildPhaseFallback([], async () => {
    const body = await fetchCrm<unknown>({ path: '/public/sitemap', revalidate: 60 });
    return validateCrmResponse('GET /public/sitemap', crmSitemapResponseSchema, body);
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
