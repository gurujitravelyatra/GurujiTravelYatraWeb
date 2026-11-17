import { getPlaces, getSite, getTours } from '@/server/crm/client';
import { toSiteStatsSummary } from '@/lib/site-stats';
import { resolveSiteContact } from '@/lib/site-contact';

import { SiteShell } from '@/components/layout/SiteShell';
import { Hero } from '@/components/home/Hero';
import { RouteMarquee } from '@/components/home/RouteMarquee';
import { TripFinderBar } from '@/components/home/TripFinderBar';
import { PopularDestinationsSection } from '@/components/home/PopularDestinationsSection';
import { DestinationsRail } from '@/components/home/InternationalDestinationsRail';
import { JourneyVideoBlock } from '@/components/home/JourneyVideoBlock';
import { WhyGtyBand } from '@/components/home/WhyGtyBand';
import { InstagramStrip } from '@/components/home/InstagramStrip';

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
 *  - The 4 themed catalogue rails on the old Home/Tour-Packages model have
 *    no CRM concept of "rail membership" either — Popular Destinations
 *    here is simply the CRM's own first page of tours.
 *  - Recent Trips gallery — pure fixture placeholders, no real photos and
 *    no CRM field to source them from. Removed outright.
 *  - Testimonials / About milestones — removed in the earlier CRM-migration
 *    decisions (no CRM endpoint for either).
 *  - "Let's Travel Together" newsletter signup — removed per design review
 *    2026-11-01 (never connected to a real backend; see the deleted
 *    `src/lib/newsletter-adapter.ts`'s own header for why).
 *
 * Brief §C1/C2 (2026-11-14), after a fresh CRM-contract audit: "Popular
 * Destinations" now shows DOMESTIC tours only, and "International
 * Destinations" is back (renamed "Explore Destinations") showing real
 * International tours — `category: 'International'` turned out to be the
 * one real domestic/international signal the contract has, superseding
 * the "no such field exists" note the bullet above used to carry (`CrmPlace`
 * genuinely has none; `CrmTourCard.category` does). See
 * `InternationalDestinationsRail`'s own header for the rest of that story.
 */
/**
 * Round 3 (2026-11-17), Part 1b: each home tour row shows every published
 * tour of its section, up to 12 — past that the row ends with a "View all
 * tours" card instead (see `TourRailSection`). Was 8.
 */
const TOUR_ROW_CAP = 12;
/** The CRM has no "exclude category" query — overfetch, filter out International client-side, then slice back to the real cap. */
const POPULAR_TOURS_OVERFETCH = TOUR_ROW_CAP * 2;

export default async function HomePage() {
  const [site, places, domesticPageTours, internationalTours] = await Promise.all([
    getSite(),
    getPlaces(),
    getTours({ pageSize: POPULAR_TOURS_OVERFETCH }),
    // Brief §C2 (2026-11-14): "Explore Destinations" now shows real
    // International tours (see `InternationalDestinationsRail`'s header) —
    // `category: 'International'` is the only domestic/international signal
    // the CRM audit found anywhere in the contract.
    // One more than the cap, so "there are more than 12" is known without a second call.
    getTours({ category: 'International', pageSize: TOUR_ROW_CAP + 1 }),
  ]);

  const contact = resolveSiteContact(site.settings);
  const stats = toSiteStatsSummary(site.settings);
  const exploreDestinations = places.filter((place) => place.liveTourCount > 0).slice(0, 6);
  const domesticTours = domesticPageTours.tours.filter((tour) => tour.category !== 'International');
  const popularTours = domesticTours.slice(0, TOUR_ROW_CAP);
  // More domestic tours than the row shows: either already in hand, or the
  // CRM has further pages this overfetch did not reach.
  const hasMorePopularTours =
    domesticTours.length > TOUR_ROW_CAP || domesticPageTours.total > domesticPageTours.tours.length;
  const hasMoreInternationalTours =
    internationalTours.tours.length > TOUR_ROW_CAP || internationalTours.total > TOUR_ROW_CAP;
  const heroImageUrl = site.images.HERO_BACKGROUND[0]?.url;
  // Brief §B item 3 (2026-11-14): Trip Finder destination suggestions are
  // real CRM place names + states (`region`) — no tour titles (would need
  // a separate, unbounded fetch; see `resolveTripFinder`'s own header).
  const destinationSuggestions = Array.from(new Set(places.flatMap((place) => [place.name, place.region])));

  return (
    <SiteShell activePath="/" pageLabel="Home">
      {/*
        `Hero` and `WhyGtyBand`'s stats band are both fed by the SAME
        `site.settings` — one source, never two independently-maintained
        copies of a figure.
      */}
      <Hero headline={contact.heroHeadline} subtext={contact.heroSubtext} heroImageUrl={heroImageUrl} stats={stats} />
      {/*
        Filtered to the same liveTourCount > 0 rule this page has always
        applied to place promotion — not every CRM place — since this
        scrolling strip is promotional, not a neutral directory. (As of
        brief §C2, 2026-11-14, `DestinationsRail` further down no longer
        shares this filter — it reads International TOURS now, not places —
        but the "don't promote a place with nothing live" rule stays here.
        See home.fake-server.test.tsx's "a place with zero live tours does
        not crash the route marquee".)

        Only rendered with NO real destinations when the CRM has configured
        NO places at all (`places.length === 0`) — `RouteMarquee` then shows
        its static fallback list. If the CRM has places but every one of
        them is filtered out for having zero live tours right now, this
        renders nothing rather than a fallback list unrelated to what the
        CRM actually has configured.
      */}
      {(exploreDestinations.length > 0 || places.length === 0) && (
        <RouteMarquee places={exploreDestinations.map((place) => place.name)} />
      )}
      <TripFinderBar destinationSuggestions={destinationSuggestions} />
      <PopularDestinationsSection tours={popularTours} hasMore={hasMorePopularTours} />
      <DestinationsRail tours={internationalTours.tours.slice(0, TOUR_ROW_CAP)} hasMore={hasMoreInternationalTours} />
      <JourneyVideoBlock profileVideoUrl={contact.profileVideoUrl} />
      {/*
        "Redux" redesign (brief §8, 2026-11-14): the stats band that used to
        be the separate `<StatsBar>` section is now part of `WhyGtyBand`
        itself (same `stats` object — still one source, never two). `StatsBar`
        the component is untouched and still renders on `/about-us`.
      */}
      <WhyGtyBand stats={stats} />
      {/*
        New brief (2026-11-15): the inline enquiry card this section used to
        hold (`InlineEnquiryForm`, brief Part 4A, 2026-11-14) is removed —
        the redesigned lead form now lives ONLY in the "Enquire Now" /
        "Download brochure" popup (`LeadModal.tsx`), which both triggers
        share. Two separate, drifting copies of the same form was exactly
        the thing that brief's own `Field`/`extract-utm` extraction out of
        `LeadModal.tsx` was trying to avoid.
      */}
      <InstagramStrip instagramUrl={contact.instagramUrl} />
      {/* Round 3 (2026-11-17), Part 3: the WhatsApp contact box now comes from `SiteShell`, once, for every route. */}
    </SiteShell>
  );
}
