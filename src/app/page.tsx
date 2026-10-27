import { getPlaces, getSite, getTours } from '@/server/crm/client';
import { toSiteStatsSummary } from '@/lib/site-stats';
import { resolveSiteContact } from '@/lib/site-contact';

import { SiteShell } from '@/components/layout/SiteShell';
import { Hero } from '@/components/home/Hero';
import { TripFinderBar } from '@/components/home/TripFinderBar';
import { PopularDestinationsSection } from '@/components/home/PopularDestinationsSection';
import { DestinationsRail } from '@/components/home/InternationalDestinationsRail';
import { JourneyVideoBlock } from '@/components/home/JourneyVideoBlock';
import { WhyGtyBand } from '@/components/home/WhyGtyBand';
import { StatsBar } from '@/components/home/StatsBar';
import { InstagramStrip } from '@/components/home/InstagramStrip';
import { Newsletter } from '@/components/home/Newsletter';

/**
 * Build-time static prerendering fix (2026-10-27) — capping
 * `experimental.cpus`/`staticGenerationMaxConcurrency` to 1 (next.config.ts)
 * was not enough on its own: Railway's build still died silently during
 * "Generating static pages", on a builder too small to hold even a single
 * worker's full generation pass for the CRM-reading pages. Decision: stop
 * attempting to statically prerender this page at all — render it on
 * request instead. `force-dynamic` removes it from `next build`'s
 * "Generating static pages" phase entirely: no CRM call, no network
 * access, nothing happens here until a real request arrives.
 *
 * CONFIRMED TRADEOFF — re-verified directly against node_modules/next/
 * dist/docs/01-app/02-guides/caching-without-cache-components.md for THIS
 * exact Next version rather than assumed from memory (AGENTS.md's own
 * warning: this build has real breaking changes from training-data
 * Next.js): that doc states `force-dynamic` is equivalent to forcing
 * EVERY `fetch()` in the page to `{ cache: 'no-store', next: { revalidate:
 * 0 } }`. It disables fetch-level caching (the Data Cache) too, not only
 * the page-level static-HTML cache (the Full Route Cache) — so the
 * `revalidate: 60`/`crm:*` tags every `@/server/crm/client` read still
 * carries (`fetchCrm`'s own default) are NOT honoured on this page
 * anymore: every real visit now calls the CRM fresh rather than reusing a
 * cached result for up to 60 seconds. Accepted deliberately: the CRM's
 * own general rate limit (600/min, documentation/technical-specification/
 * public-website.md) has ample headroom for this site's traffic, and a
 * build that reliably succeeds is worth more than this page's read
 * efficiency. `revalidateTag()` (the Step 4 webhook,
 * src/app/api/revalidate/route.ts) still runs without error against this
 * page's reads — it simply has nothing left to invalidate here, since
 * nothing is cached for it to expire early; the next real visit always
 * sees current data regardless.
 *
 * Every other CRM-reading page (about-us, customize-tours, group-tours,
 * both legal pages, sitemap.ts) carries the same two paragraphs, not
 * copied by accident — each is independently load-bearing at its own
 * route, and a future reader of any ONE of them should not have to find
 * this file to understand why.
 */
export const dynamic = 'force-dynamic';

/**
 * Home (`/`) — Server Component.
 *
 * CRM-migration Step 2: every section below now reads from the CRM
 * (`GET /public/tours`, `/public/places`, `/public/site`) instead of the
 * old fixture/database content layer. Sections with no CRM-sourced
 * equivalent were removed rather than kept rendering stale/fixture data:
 *
 *  - "International Destinations" (a fixture-only curation flag with no
 *    CRM field) → replaced by `DestinationsRail`, every active place the
 *    CRM returns, under a neutral heading.
 *  - The 4 themed catalogue rails on the old Home/Tour-Packages model have
 *    no CRM concept of "rail membership" either — Popular Destinations
 *    here is simply the CRM's own first page of tours.
 *  - Recent Trips gallery — pure fixture placeholders, no real photos and
 *    no CRM field to source them from. Removed outright.
 *  - Testimonials / About milestones — removed in the earlier CRM-migration
 *    decisions (no CRM endpoint for either).
 */
export default async function HomePage() {
  const [site, places, popularTours] = await Promise.all([
    getSite(),
    getPlaces(),
    getTours({ pageSize: 8 }),
  ]);

  const contact = resolveSiteContact(site.settings);
  const stats = toSiteStatsSummary(site.settings);
  const exploreDestinations = places.filter((place) => place.liveTourCount > 0).slice(0, 6);
  const heroImageUrl = site.images.HERO_BACKGROUND[0]?.url;

  return (
    <SiteShell activePath="/" pageLabel="Home">
      {/*
        `Hero` and `StatsBar` are both fed by the SAME `site.settings` —
        one source, never two independently-maintained copies of a figure.
      */}
      <Hero headline={contact.heroHeadline} subtext={contact.heroSubtext} heroImageUrl={heroImageUrl} stats={stats} />
      <TripFinderBar />
      <PopularDestinationsSection tours={popularTours.tours} />
      <DestinationsRail places={exploreDestinations} />
      <JourneyVideoBlock profileVideoUrl={contact.profileVideoUrl} />
      <WhyGtyBand yearsExperienceLabel={stats.yearsExperience ?? null} />
      <StatsBar stats={stats} />
      <InstagramStrip instagramUrl={contact.instagramUrl} />
      <Newsletter />
    </SiteShell>
  );
}
