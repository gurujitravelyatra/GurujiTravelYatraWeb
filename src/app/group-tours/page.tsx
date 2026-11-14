import type { Metadata } from 'next';

import { getDepartures, getPlaces } from '@/server/crm/client';
import { matchesDestination } from '@/server/trip-finder/resolve';

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
 *
 * Brief §B (2026-11-14): the Trip Finder's Group tab lands here (via
 * `?destination=`) when several Group tours match what the visitor typed —
 * `matchesDestination` is the exact same rule `resolveTripFinder` used to
 * find them, so this listing can never show a different set than what the
 * visitor was told matched. `?note=` carries the Group-tab month-mismatch
 * message (rule 2) — a banner, never a reason to hide anything.
 */
interface GroupToursPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(param: string | string[] | undefined): string | undefined {
  return Array.isArray(param) ? param[0] : param;
}

export default async function GroupToursPage({ searchParams }: GroupToursPageProps) {
  const query = await searchParams;
  const destination = firstValue(query.destination)?.trim();
  const note = firstValue(query.note);

  const [{ departures }, places] = await Promise.all([getDepartures(), destination ? getPlaces() : Promise.resolve([])]);
  const groupDepartures = departures.filter((departure) => departure.category === 'Group');

  const visibleDepartures = destination
    ? groupDepartures.filter((departure) =>
        matchesDestination(departure, new Map(places.map((place) => [place.slug, place])), destination.toLowerCase())
      )
    : groupDepartures;
  const months = Array.from(new Set(visibleDepartures.map((departure) => departure.departureDate.slice(0, 7)))).sort();

  return (
    <SiteShell activePath="/group-tours" pageLabel="Group Tours">
      <GroupToursHero />
      {note && (
        <div className="relative z-[4] -mt-8 px-gx">
          <p role="status" className="rounded-14 border border-gty-border-2 bg-gty-red-150 px-5 py-3 text-13-5 font-semibold text-gty-primary">
            {note}
          </p>
        </div>
      )}
      <GroupDeparturesList departures={visibleDepartures} months={months} />
    </SiteShell>
  );
}
