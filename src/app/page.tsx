import { contentAdapter } from '@/content/content-adapter';
import { recentTripPlaceholders } from '@/content/fixtures/recent-trips.fixture';

import { SiteShell } from '@/components/layout/SiteShell';
import { Hero } from '@/components/home/Hero';
import { TripFinderBar } from '@/components/home/TripFinderBar';
import { PopularDestinationsSection } from '@/components/home/PopularDestinationsSection';
import { InternationalDestinationsRail } from '@/components/home/InternationalDestinationsRail';
import { JourneyVideoBlock } from '@/components/home/JourneyVideoBlock';
import { WhyGtyBand } from '@/components/home/WhyGtyBand';
import { RecentTripsGallery } from '@/components/home/RecentTripsGallery';
import { StatsBar } from '@/components/home/StatsBar';
import { InstagramStrip } from '@/components/home/InstagramStrip';
import { Newsletter } from '@/components/home/Newsletter';

/**
 * Home (`/`) — Server Component, tech spec §4.4. Built in the exact
 * product-spec §5.1 order, reconciled against the design export per the
 * tech spec's per-row [EXPORT]/[TOKENS] decisions:
 *
 *  1 Navbar               → SiteShell
 *  2 Hero                 → [EXPORT]
 *  3 Trip Finder bar      → [EXPORT]
 *  4 Trust strip          → NOT a separate section — merged into the "Why
 *                            Travel With GTY?" band at its export position
 *                            (row 4 decision), rendered after the video
 *                            block below.
 *  5/8 Featured Video +
 *      "Every Journey..."  → [EXPORT, merged] one `JourneyVideoBlock`
 *  6 Popular Destinations → [EXPORT]
 *  6b International Dest. → [EXPORT] (not in product-spec's numbered list
 *                            by name, but real export content — kept)
 *  7 Domestic Packages    → NOT BUILT — no such section exists in the
 *                            export distinct from Popular Destinations
 *                            (tech spec row 7 decision: do not invent it)
 *  9 Recent Trips gallery → [TOKENS]
 * 10 Testimonials         → REMOVED (placeholder-content decision — see
 *                            memory/project_gty_content_database.md and the
 *                            CRM migration audit: the CRM contract has no
 *                            testimonials endpoint, and the entries here were
 *                            never real customer reviews). Reinstating this
 *                            section is a one-line revert of this commit.
 * 11 Stats bar            → [EXPORT]
 * 12 Instagram strip      → [TOKENS]
 * 13 Newsletter           → [TOKENS]
 * 14 Bottom contact strip → SiteShell
 * 15 Footer               → SiteShell
 */
export default async function HomePage() {
  const [popularDestinations, internationalDestinations, featuredVideos, stats] = await Promise.all([
    contentAdapter.getPopularDestinations(),
    contentAdapter.getInternationalDestinations(),
    contentAdapter.getFeaturedVideos(),
    contentAdapter.getStats(),
  ]);

  return (
    <SiteShell activePath="/" pageLabel="Home">
      {/*
        `Hero` and `StatsBar` below are both fed by the SAME `getStats()`
        result — the hero used to carry its own hardcoded copy of these
        numbers, so one page showed two independently-maintained versions of
        the same figures.
      */}
      <Hero stats={stats} />
      <TripFinderBar />
      <PopularDestinationsSection packages={popularDestinations} />
      <InternationalDestinationsRail destinations={internationalDestinations} />
      <JourneyVideoBlock videos={featuredVideos} />
      <WhyGtyBand />
      <RecentTripsGallery trips={recentTripPlaceholders} />
      <StatsBar stats={stats} />
      <InstagramStrip />
      <Newsletter />
    </SiteShell>
  );
}
