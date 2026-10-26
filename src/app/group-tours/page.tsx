import type { Metadata } from 'next';

import { getDepartures } from '@/server/crm/client';

import { SiteShell } from '@/components/layout/SiteShell';
import { GroupToursHero } from '@/components/group-tours/GroupToursHero';
import { GroupDeparturesList } from '@/components/group-tours/GroupDeparturesList';

export const metadata: Metadata = {
  title: 'Group Tours',
  description:
    'Fixed departures, great company and unforgettable journeys — join a group of like-minded travellers and explore more, together.',
  alternates: {
    canonical: '/group-tours',
  },
};

/**
 * `/group-tours` — Server Component.
 *
 * CRM-migration Step 2: reads `GET /public/departures` directly — upcoming
 * departures of live tours, soonest first, already server-filtered (the
 * contract guarantees no past-dated departure is ever returned). The CRM's
 * own `months` list drives the month chips, replacing the old
 * `departureMonthKeys()` derivation.
 */
export default async function GroupToursPage() {
  const { departures, months } = await getDepartures();

  return (
    <SiteShell activePath="/group-tours" pageLabel="Group Tours">
      <GroupToursHero />
      <GroupDeparturesList departures={departures} months={months} />
    </SiteShell>
  );
}
