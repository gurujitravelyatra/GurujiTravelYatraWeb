import 'server-only';

import { getCrmApiUrl, getWebsiteApiKey } from './config';
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
  return fetchCrm<CrmTourListResponse>({
    path: '/public/tours',
    query: { ...params },
    tags: ['crm:tours'],
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
 * slug that is neither. Every caller (the detail page, `generateStaticParams`,
 * any future API route) must handle all three; none of them may assume
 * `200` means "here is a tour".
 */
export async function getTourBySlug(slug: string): Promise<TourBySlugResult> {
  try {
    const body = await fetchCrm<CrmTourDetail | CrmTourRedirect>({
      path: `/public/tours/${encodeURIComponent(slug)}`,
      tags: ['crm:tours', `crm:tour:${slug}`],
    });
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

export async function getDepartures(params: DeparturesParams = {}): Promise<CrmDeparturesResponse> {
  return fetchCrm<CrmDeparturesResponse>({
    path: '/public/departures',
    query: { ...params },
    tags: ['crm:departures'],
  });
}

export async function getPlaces(): Promise<CrmPlace[]> {
  return fetchCrm<CrmPlace[]>({ path: '/public/places', tags: ['crm:places'] });
}

export async function getSite(): Promise<CrmSiteResponse> {
  return fetchCrm<CrmSiteResponse>({ path: '/public/site', tags: ['crm:site'] });
}

export async function getCategories(): Promise<CrmCategoryCount[]> {
  return fetchCrm<CrmCategoryCount[]>({ path: '/public/categories', tags: ['crm:categories'] });
}

export async function getSitemap(): Promise<CrmSitemapEntry[]> {
  // Deliberately NOT tagged with the other content tags — this is its own
  // endpoint on its own rate-limit budget (120/min vs 600/min, per the
  // contract) and nothing revalidates it as a side effect of a tour/place
  // save; the CRM's revalidation hook does not name a `sitemap` path.
  return fetchCrm<CrmSitemapEntry[]>({ path: '/public/sitemap', revalidate: 60 });
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
 * `src/server/crm/__tests__/`) — this function has no test-mode flag of its
 * own, because a flag is one more thing that could be wired wrong and fire
 * a real enquiry.
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
