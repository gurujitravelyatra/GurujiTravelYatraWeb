import type { Metadata } from 'next';

import { contentAdapter } from '@/content/content-adapter';
import { departureMonthKeys } from '@/lib/departure-dates';

import { SiteShell } from '@/components/layout/SiteShell';
import { GroupToursHero } from '@/components/group-tours/GroupToursHero';
import { GroupDeparturesList } from '@/components/group-tours/GroupDeparturesList';

/**
 * `/group-tours` — Server Component, product-spec §5.4, `.dc.html` lines
 * 480-559 (`isGroup` screen). Route re-added per BLOCKERS.md Decision G2 (the
 * user reversed Decision G after hitting the 404 in manual testing) and the
 * `GroupDeparture` model documented in `src/content/types.ts`.
 *
 * Description is composed from the export's own hero supporting copy
 * (`.dc.html` line 489), not invented marketing text.
 */
export const metadata: Metadata = {
  title: 'Group Tours',
  description:
    'Fixed departures, great company and unforgettable journeys — join a group of like-minded travellers and explore more, together.',
  alternates: {
    canonical: '/group-tours',
  },
};

/**
 * The month chips are DERIVED from the departures this page actually renders —
 * i.e. the ones the public gate let through (`toPublicDeparture`).
 *
 * *(Changed 2026-09-25. They used to be read from the fixture module, which was
 * correct only while the fixture was the sole source. With the database path, an
 * admin-created batch in a new month got no chip, and a month whose only batch
 * was withheld — its tour archived — kept a chip that emptied the page.)*
 */
export default async function GroupToursPage() {
  const departures = await contentAdapter.getGroupDepartures();

  return (
    <SiteShell activePath="/group-tours" pageLabel="Group Tours">
      <GroupToursHero />
      <GroupDeparturesList departures={departures} months={departureMonthKeys(departures)} />
    </SiteShell>
  );
}
