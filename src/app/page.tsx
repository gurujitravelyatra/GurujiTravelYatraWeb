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
