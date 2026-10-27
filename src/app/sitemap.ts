import type { MetadataRoute } from 'next';

import { getSitemap } from '@/server/crm/client';

/**
 * Generates `/sitemap.xml` from `GET /public/sitemap` — did not exist
 * before this (`robots.ts` used to say so explicitly: "this app has no
 * `sitemap.ts` yet"). The CRM is now the single source of truth for which
 * tour/place slugs are live, so the sitemap reads directly from it rather
 * than being derived from a locally-known tour list.
 *
 * Static routes (`/`, `/tour-packages`, `/group-tours`, `/customize-tours`,
 * `/about-us`) are listed explicitly — the CRM's sitemap endpoint only
 * covers content it owns (tours, places), not this site's own fixed pages.
 */
// Same fallback `src/app/layout.tsx` uses for `metadataBase` — never a guessed
// production domain of this file's own invention.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

const STATIC_ROUTES = ['', '/tour-packages', '/group-tours', '/customize-tours', '/about-us'];

/**
 * Build-time static prerendering fix (2026-10-27) — removes this CRM-
 * reading metadata route from `next build`'s "Generating static pages"
 * phase entirely; it generates on request instead. Documented as
 * supported for `sitemap.ts` specifically: node_modules/next/dist/docs/
 * 01-app/03-api-reference/03-file-conventions/01-metadata/sitemap.md —
 * "sitemap.js is a special Route Handler that is cached by default unless
 * it uses ... [dynamic config] option." CONFIRMED TRADEOFF:
 * `force-dynamic` also disables fetch-level (Data Cache) caching, so the
 * `revalidate: 60` `getSitemap()` passes explicitly is not honoured
 * anymore — accepted deliberately; a crawler re-fetching `/sitemap.xml`
 * is infrequent and low-stakes compared to a reliable deploy. Full
 * reasoning, re-verified against this Next version's own docs rather than
 * assumed, lives on `src/app/page.tsx`'s identical export — read it
 * there.
 */
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries = await getSitemap();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
  }));

  const crmEntries: MetadataRoute.Sitemap = entries.map((entry) => ({
    url: entry.type === 'tour' ? `${SITE_URL}/tour-packages/${entry.slug}` : `${SITE_URL}/tour-packages?place=${entry.slug}`,
    lastModified: new Date(entry.updatedAt),
  }));

  return [...staticEntries, ...crmEntries];
}
