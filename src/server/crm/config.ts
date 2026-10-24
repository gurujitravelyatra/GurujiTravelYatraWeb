import 'server-only';

/**
 * CRM connection config — read lazily (per call), never at module load.
 *
 * `next build` runs with `NODE_ENV=production` and evaluates every page
 * module, so anything that throws on missing config at IMPORT time breaks
 * the BUILD rather than the request — the exact trap
 * `memory/project_gty_admin_auth.md` records for `AUTH_SECRET`. These
 * functions are called from inside a request/render, never from top-level
 * module code, so a misconfiguration surfaces as a request-time error with a
 * real stack trace instead of an opaque build failure.
 */

/**
 * The CRM's own `/api/public/*` base — e.g.
 * `http://gty-crm.railway.internal:8080/api`. The `/public/...` segment is
 * appended by each client function; this is everything BEFORE that.
 *
 * Defaults to the Railway-internal address (same project, private network,
 * no public-internet hop — faster and avoids counting against any public
 * rate limit on server-to-server calls). Override with
 * `https://crm.gurujitravelyatra.com/api` for local development against the
 * real deployed CRM, or if the internal DNS name is ever unavailable.
 *
 * No default is silently substituted for a MISSING scheme/host shape — a
 * malformed value fails loudly the first time a client function tries to
 * build a URL from it (`new URL()` throwing), which is the right failure: a
 * wrong CRM address is a deployment error, not something to paper over.
 */
const DEFAULT_CRM_API_URL = 'http://gty-crm.railway.internal:8080/api';

export function getCrmApiUrl(): string {
  const url = process.env.CRM_API_URL;
  return url && url.trim().length > 0 ? url.trim().replace(/\/+$/, '') : DEFAULT_CRM_API_URL;
}

/**
 * Sent as `x-website-api-key` on `POST /public/enquiries` ONLY — every GET
 * route under `/public/*` is `@Public()` per the contract and needs no key.
 *
 * `undefined` is a SUPPORTED state locally/in CI (there is nothing to post
 * to without a real CRM anyway); `submitEnquiry()` in `client.ts` refuses to
 * call out without it rather than sending a request the CRM would 401 or
 * that would send an empty header. This is a server secret: it must never
 * be read through a `NEXT_PUBLIC_` name and must never appear in a response
 * body, a log line, or a client bundle.
 */
export function getWebsiteApiKey(): string | undefined {
  const key = process.env.WEBSITE_API_KEY;
  return key && key.trim().length > 0 ? key.trim() : undefined;
}
