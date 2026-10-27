import type { Metadata } from 'next';

import { getPlaces, getSite } from '@/server/crm/client';
import { resolveSiteContact } from '@/lib/site-contact';

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
 * Build-time static prerendering fix (2026-10-27) — removes this CRM-
 * reading page from `next build`'s "Generating static pages" phase
 * entirely; renders on request instead. CONFIRMED TRADEOFF: `force-dynamic`
 * also disables fetch-level (Data Cache) caching for this page, not only
 * the static-HTML cache, so the `revalidate: 60` every CRM read already
 * carries is not honoured here anymore — accepted deliberately. Full
 * reasoning, re-verified against this Next version's own docs rather than
 * assumed, lives on `src/app/page.tsx`'s identical export — read it there.
 */
export const dynamic = 'force-dynamic';

/**
 * `/customize-tours` — Server Component.
 *
 * CRM-migration Step 2: place options are `GET /public/places` filtered by
 * `showInCustomBuilder` — the field the contract added specifically to
 * answer "is this place offered in the Customize Tours builder", replacing
 * the old fixture's implicit "every place in this one array is offered".
 *
 * `NeedHelpCard` and `ExploreDestinationsCard` are passed as `children` into
 * the client `TripBuilder` rather than imported by it, so they stay Server
 * Components even though they render inside the same right-hand column as
 * the (necessarily client) trip summary.
 */
export default async function CustomizeToursPage() {
  const [places, site] = await Promise.all([getPlaces(), getSite()]);
  const placeOptions = places.filter((place) => place.showInCustomBuilder);
  const contact = resolveSiteContact(site.settings);

  return (
    <SiteShell activePath="/customize-tours" pageLabel="Customized Tours">
      <CustomizeToursHero />
      <TripBuilder placeOptions={placeOptions} whatsappUrl={contact.whatsappUrl}>
        <NeedHelpCard contact={contact} />
        <ExploreDestinationsCard />
      </TripBuilder>
      <WhyPlanBand />
    </SiteShell>
  );
}
