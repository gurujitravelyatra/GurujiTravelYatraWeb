import type { Metadata } from 'next';

import { contentAdapter } from '@/content/content-adapter';
import { departureMonths } from '@/content/fixtures/group-departures.fixture';

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
 * `departureMonths` is read directly from the fixture module rather than
 * through `ContentPort` — it is a derived filter-chip list (like
 * `getCategoryChips` for `/tour-packages`), not a content record, and
 * `GroupDeparture` fixtures are its only possible source. `ContentPort`
 * exposes `getGroupDepartures()` for the records themselves.
 */
export default async function GroupToursPage() {
  const departures = await contentAdapter.getGroupDepartures();

  return (
    <SiteShell activePath="/group-tours" pageLabel="Group Tours">
      <GroupToursHero />
      <GroupDeparturesList departures={departures} months={departureMonths} />
    </SiteShell>
  );
}
