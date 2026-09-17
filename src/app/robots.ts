import type { MetadataRoute } from 'next';

/**
 * Generates `/robots.txt`.
 *
 * Did not exist before this phase — until now every route in the app was a public
 * marketing page that we actively wanted indexed, so the absence was correct
 * rather than an oversight. Adding `/admin` changes that.
 *
 * ## What a `Disallow` is and is not
 *
 * It asks well-behaved crawlers not to FETCH a path. It is not access control —
 * `robots.txt` is itself public, so this file is also a list of the paths worth
 * poking at, and a hostile crawler will ignore it entirely. The actual protection
 * for `/admin` is `proxy.ts` plus `requireAdminSession()`; this only keeps the
 * login page out of Google.
 *
 * It is also not an "do not index" instruction — a disallowed URL that is linked
 * from elsewhere can still appear in results, without a snippet, because the
 * crawler never fetched it to read the meta tag. That is why `/admin/login`,
 * `/admin` and the admin layout ALSO set `robots: { index: false }` in their
 * metadata. The two mechanisms cover different cases and neither replaces the
 * other.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          /**
           * Covers `/admin` itself and everything beneath it: a `robots.txt`
           * `Disallow` is a PREFIX match, not an exact one, so this single rule
           * also blocks `/admin/login` and every route Phase B adds under it.
           */
          '/admin',
          /**
           * The public content API (`/api/tours`, `/api/destinations`,
           * `/api/brochures/[slug]`, …) plus `/api/auth/*`.
           *
           * These return JSON, not pages. Indexing them gets a raw payload listed
           * against a query that should have matched the real page, which splits
           * ranking between the two and shows a searcher a blob of JSON. There is
           * nothing secret in the content routes — they are the same data the
           * pages render — so this is an SEO rule, not a security one.
           */
          '/api',
        ],
      },
    ],
    /**
     * No `sitemap` entry: this app has no `sitemap.ts` yet. Pointing at a
     * `/sitemap.xml` that 404s is worse than omitting the line, and inventing one
     * here would be guessing at a route nobody has built.
     */
  };
}
