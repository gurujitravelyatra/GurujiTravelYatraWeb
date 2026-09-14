import type { Metadata } from 'next';

import { contentAdapter } from '@/content/content-adapter';

import { SiteShell } from '@/components/layout/SiteShell';
import { CustomizeToursHero } from '@/components/customize-tours/CustomizeToursHero';
import { TripBuilder } from '@/components/customize-tours/TripBuilder';
import { NeedHelpCard } from '@/components/customize-tours/NeedHelpCard';
import { ExploreDestinationsCard } from '@/components/customize-tours/ExploreDestinationsCard';
import { WhyPlanBand } from '@/components/customize-tours/WhyPlanBand';

export const metadata: Metadata = {
  title: 'Customize Tours',
  description:
    "Build your own yatra. Tell us the places, pace and people — Guruji Travel Yatra will shape a personalized journey around your selections.",
  alternates: {
    canonical: '/customize-tours',
  },
};

/**
 * `/customize-tours` — Server Component, product-spec §5.5, design export
 * `isCustom` screen (`.dc.html` lines 561-722).
 *
 * `NeedHelpCard` and `ExploreDestinationsCard` are passed as `children` into
 * the client `TripBuilder` rather than imported by it, so they stay Server
 * Components even though they render inside the same right-hand column as
 * the (necessarily client) trip summary — Next.js keeps Server Component
 * children server-rendered when composed this way.
 */
export default async function CustomizeToursPage() {
  const placeOptions = await contentAdapter.getTripPlaceOptions();

  return (
    <SiteShell activePath="/customize-tours" pageLabel="Customized Tours">
      <CustomizeToursHero />
      <TripBuilder placeOptions={placeOptions}>
        <NeedHelpCard />
        <ExploreDestinationsCard />
      </TripBuilder>
      <WhyPlanBand />
    </SiteShell>
  );
}
