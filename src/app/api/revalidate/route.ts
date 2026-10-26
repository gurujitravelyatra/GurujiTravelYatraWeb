import { timingSafeEqual } from 'node:crypto';

import { revalidateTag } from 'next/cache';
import type { NextRequest } from 'next/server';

import { getRevalidateSecret } from '@/server/crm/config';

import { apiFailure, apiSuccess, handleRoute } from '../_lib/json';

/**
 * `POST /api/revalidate` — the website side of the CRM's "Website
 * revalidation hook" (documentation/technical-specification/
 * public-website.md). After a save that changes anything the public site
 * reads — a tour, a Place, Site images/settings — the CRM backend POSTs
 * here with a small set of tags so the NEXT visitor sees the change
 * immediately, rather than waiting out the 60s `s-maxage` every `@/server/
 * crm/client` read already carries.
 *
 * ## This is the CRM's call to make, not a public endpoint
 *
 * Every `GET /public/*` route this site reads from is `@Public()`, but THIS
 * direction is the opposite: the CRM is calling US. `x-revalidate-secret`
 * must equal `WEBSITE_REVALIDATE_SECRET` (this site's half of a secret the
 * CRM holds under its own `WEBSITE_REVALIDATE_SECRET` name) — wrong or
 * missing is `401`, and the secret being unset in this environment is `503`
 * rather than silently accepting an unauthenticated revalidation request
 * (the same `getWebsiteApiKey()`/`submitEnquiry()` pattern, applied to the
 * other direction of this relationship).
 *
 * ## `paths` → tags, with a `crm:` prefix this route owns alone
 *
 * The contract's own examples — `"tours"`, `"tour:kashmir-paradise"`,
 * `"departures"`, `"places"`, `"site"` — are bare names. `@/server/crm/
 * client`'s `getTours()`/`getTourBySlug()`/etc. tag their Next `fetch()`
 * calls `crm:tours`, `crm:tour:<slug>`, `crm:departures`, `crm:places`,
 * `crm:site`, `crm:categories` — the `crm:` prefix exists so this site's own
 * cache tags can never collide with an unrelated tag some other part of the
 * app might use. Prefixing happens HERE, the one place that has to know
 * both names, rather than asking the CRM to know this site's internal
 * naming convention. `revalidateTag()` is a no-op for a tag nothing was
 * ever fetched with, so an unrecognised path is harmless, not an error —
 * the contract's own "e.g." wording means this list is not exhaustive and
 * is not this route's place to enforce.
 *
 * `GET /public/sitemap` is deliberately NOT tagged with `crm:` anything
 * (`client.ts`'s own comment on `getSitemap()` — it is on its own 60s
 * revalidate window with no tag, and the contract's own hook does not name
 * a `sitemap` path), so there is no corresponding case here either.
 *
 * ## Best-effort on the CRM's side; this route is simply fast and quiet
 *
 * The contract states the CRM gives this call a 3-second timeout and
 * swallows any failure after logging the paths once — this route owes it
 * nothing more than answering quickly and correctly. There is no retry,
 * no queue, and no state kept here: a missed revalidation self-heals the
 * moment the next request re-populates the cache after the existing
 * `revalidate: 60` window, same as it always would have.
 */

const MAX_PATHS = 50;
const MAX_PATH_LENGTH = 100;

function isValidPathsBody(body: unknown): body is { paths: string[] } {
  if (typeof body !== 'object' || body === null) return false;
  const paths = (body as Record<string, unknown>).paths;
  if (!Array.isArray(paths) || paths.length === 0 || paths.length > MAX_PATHS) return false;
  return paths.every((path) => typeof path === 'string' && path.length > 0 && path.length <= MAX_PATH_LENGTH);
}

/**
 * Constant-time comparison so a wrong secret cannot be distinguished, by
 * response latency, from a slightly-less-wrong one. `timingSafeEqual`
 * itself throws on mismatched buffer lengths rather than returning `false`,
 * so the length check runs first — on two secrets this is not the leak that
 * matters (an attacker who can already measure microsecond timing
 * differences has far better signals than "is the length equal"), and
 * skipping it would just crash the request instead of rejecting it cleanly.
 */
function secretsMatch(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(providedBuffer, expectedBuffer);
}

export async function POST(request: NextRequest) {
  return handleRoute('POST /api/revalidate', async () => {
    const expectedSecret = getRevalidateSecret();
    if (!expectedSecret) {
      return apiFailure(503, 'WEBSITE_REVALIDATE_SECRET is not configured in this environment.');
    }

    const provided = request.headers.get('x-revalidate-secret');
    if (!provided || !secretsMatch(provided, expectedSecret)) {
      return apiFailure(401, 'Invalid or missing x-revalidate-secret.');
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiFailure(400, 'Expected a JSON request body.');
    }

    if (!isValidPathsBody(body)) {
      return apiFailure(400, 'Expected { paths: string[] } with 1-50 non-empty entries.');
    }

    for (const path of body.paths) {
      // `revalidateTag` now requires a second argument (this Next.js
      // version's docs, node_modules/next/dist/docs/.../revalidateTag.md —
      // the single-argument form is deprecated). `{ expire: 0 }` is the
      // documented choice for exactly this caller shape ("the invalidation
      // comes from outside a Server Action, ... a webhook ... calling a
      // Route Handler") and matches the whole point of this hook — the
      // CRM already waited for its own save to commit, so the NEXT
      // visitor should see fresh data immediately, not a stale-while-
      // revalidate window.
      revalidateTag(`crm:${path}`, { expire: 0 });
    }

    return apiSuccess({ revalidated: true, paths: body.paths });
  });
}
