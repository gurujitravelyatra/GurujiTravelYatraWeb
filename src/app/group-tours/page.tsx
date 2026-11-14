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
 * `/group-tours` — Server Component.
 *
 * CRM-migration Step 2: reads `GET /public/departures` directly — upcoming
 * departures of live tours, soonest first, already server-filtered (the
 * contract guarantees no past-dated departure is ever returned).
 *
 * User decision (2026-11-14, Trip Finder business rules, item 6): "Group
 * Tours page keeps listing tours of category Group only" — `getDepartures()`
 * itself returns upcoming departures of EVERY category (any tour can carry
 * a `CrmDeparturesTourCard`), so this page now filters to `category ===
 * 'Group'` itself rather than trusting the endpoint's own unfiltered mix.
 * The month-chip list is recomputed from that same filtered set, instead of
 * the CRM's own `months` (which covers every category) — a month with only
 * non-Group departures would otherwise offer a chip that always shows zero
 * results here.
 */
export default async function GroupToursPage() {
  const { departures } = await getDepartures();
  const groupDepartures = departures.filter((departure) => departure.category === 'Group');
  const months = Array.from(new Set(groupDepartures.map((departure) => departure.departureDate.slice(0, 7)))).sort();

  return (
    <SiteShell activePath="/group-tours" pageLabel="Group Tours">
      <GroupToursHero />
      <GroupDeparturesList departures={groupDepartures} months={months} />
    </SiteShell>
  );
}
