import type { Metadata } from 'next';

import { contentAdapter } from '@/content/content-adapter';
import { SiteShell } from '@/components/layout/SiteShell';
import { StatsBar } from '@/components/home/StatsBar';
import { AboutStory } from '@/components/about/AboutStory';
import { AboutTravellers } from '@/components/about/AboutTravellers';
import { AboutCta } from '@/components/about/AboutCta';

export const metadata: Metadata = {
  title: 'About Us | Guruji Travel Yatra',
  description:
    "Learn about Guruji Travel Yatra's journey so far and the travellers who have joined our yatras, then start planning your own trip.",
};

/**
 * `/about-us` — design export `GTY Wireframe Prototype.dc.html` lines
 * 724-738 (the `isAbout` screen), product-spec §5.8.
 *
 * Unlike every other in-scope screen, the export renders this one's brand
 * story as unlabelled `.ln` skeleton bars rather than real copy, and §5.8
 * itself is two lines long with no story text. So this page invents no
 * founder note, company history, team roster or certifications/badges —
 * §5.8's "team section (optional)" and "certifications ... if applicable"
 * are both skipped outright rather than rendered as empty shells, per
 * BLOCKERS.md Decision H (never fabricate content for a real travel brand).
 * See `AboutStory` for exactly how the missing brand story is disclosed.
 *
 * §5.8's "repeated trust stats" reuse the existing `StatsBar` composed from
 * `contentAdapter.getStats()` — the same source and the same `isPlaceholder`
 * flags Home's stats bar renders, not a second stats implementation.
 *
 * The "Our Journey" milestone timeline that used to render here has been
 * REMOVED (placeholder-content decision, CRM migration audit): every entry
 * quoted the same unconfirmed traveller/destination figures as the stats
 * bar, and the CRM contract has no milestone/timeline equivalent to source
 * real ones from. The page's main story/traveller/CTA copy is unaffected.
 * Reinstating the timeline is a one-line revert of this commit.
 */
export default async function AboutUsPage() {
  const stats = await contentAdapter.getSiteStatsSummary();

  return (
    <SiteShell activePath="/about-us" pageLabel="About Us">
      <AboutStory />
      <AboutTravellers />
      <StatsBar stats={stats} />
      <AboutCta />
    </SiteShell>
  );
}
