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

interface CustomizeToursPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(param: string | string[] | undefined): string | undefined {
  return Array.isArray(param) ? param[0] : param;
}

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
 *
 * Brief §B (2026-11-14): when the Trip Finder falls back here (no matching
 * ready-made tour) or a visitor arrives via a Group-tab redirect, this page
 * reads `?destination=&month=&travellers=` and prefills the builder below —
 * visible and editable, never auto-submitted. See `TripBuilder`'s own
 * header for how each field maps (`destination` is only auto-selected as a
 * place when it matches a REAL `placeOptions` entry; otherwise it is
 * carried into the notes field rather than inventing a place pick).
 */
export default async function CustomizeToursPage({ searchParams }: CustomizeToursPageProps) {
  const query = await searchParams;
  const [places, site] = await Promise.all([getPlaces(), getSite()]);
  const placeOptions = places.filter((place) => place.showInCustomBuilder);
  const contact = resolveSiteContact(site.settings);

  const prefill = {
    destination: firstValue(query.destination),
    month: firstValue(query.month),
    travellers: firstValue(query.travellers),
  };

  return (
    <SiteShell activePath="/customize-tours" pageLabel="Customized Tours">
      <CustomizeToursHero />
      <TripBuilder placeOptions={placeOptions} whatsappUrl={contact.whatsappUrl} prefill={prefill}>
        <NeedHelpCard contact={contact} />
        <ExploreDestinationsCard />
      </TripBuilder>
      <WhyPlanBand />
    </SiteShell>
  );
}
