import type { Metadata } from 'next';
import { Suspense } from 'react';

import { getCategories, getDepartures, getPlaces, getTours } from '@/server/crm/client';
import type { CrmCategory } from '@/server/crm/types';

import { SiteShell } from '@/components/layout/SiteShell';
import { TourPackagesHero } from '@/components/tour-packages/TourPackagesHero';
import { PackagesCatalogue } from '@/components/tour-packages/PackagesCatalogue';

/**
 * CANONICAL — every filtered view of this route points back at the plain
 * `/tour-packages`. Deliberately a STATIC object rather than
 * `generateMetadata({ searchParams })`: a static export cannot read the
 * query string at all, so it is structurally impossible for a filtered
 * variant to emit a canonical pointing at itself.
 */
export const metadata: Metadata = {
  title: 'Tour Packages',
  description: 'Discover handpicked journeys across India and abroad — filter by category, destination and travel month.',
  alternates: {
    canonical: '/tour-packages',
  },
};

const PAGE_SIZE = 12;

interface TourPackagesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(param: string | string[] | undefined): string | undefined {
  return Array.isArray(param) ? param[0] : param;
}

const CRM_CATEGORIES: CrmCategory[] = ['Spiritual', 'Adventure', 'International', 'Family', 'Group'];

function resolveCategory(value: string | undefined): CrmCategory | undefined {
  return CRM_CATEGORIES.find((category) => category === value);
}

type TourScope = 'Domestic' | 'International' | 'All';

/**
 * Brief §C2 (2026-11-14), after the audit: the CRM contract has no
 * domestic/international flag anywhere (not on `CrmPlace`, not a separate
 * site setting) — the ONLY real signal is the `category: 'International'`
 * value itself. So "Domestic" is defined as "not categorised
 * International", never guessed from a place's `region` (that field holds
 * Indian state names even for places with no international tours at all).
 */
function resolveScope(value: string | undefined): TourScope {
  return value === 'domestic' ? 'Domestic' : value === 'international' ? 'International' : 'All';
}

/** A larger-than-displayed page, so filtering out International tours after the fact still usually fills a full page. No CRM "exclude category" query exists to do this server-side. */
const DOMESTIC_OVERFETCH_PAGE_SIZE = PAGE_SIZE * 2;

/**
 * `/tour-packages` — Server Component.
 *
 * CRM-migration Step 2: REDESIGNED around `GET /public/tours`'s real query
 * parameters (`category`, `place`, `month`, `page`) — see
 * `PackagesCatalogue` for why the old "4 themed rails" model is gone. An
 * unrecognised `category`/`place`/`month` value is dropped rather than sent
 * to the CRM (which would 400 an unknown category) or silently shown as
 * "All" with no indication anything was ignored; the chosen behaviour here
 * is the same "fall back to the unfiltered view" the old page used, now
 * applied before the request rather than after.
 *
 * Reading `searchParams` makes this route render per-request — unavoidable
 * once filtering is a real server-side query rather than client-side array
 * filtering over a statically-fetched set.
 */
export default async function TourPackagesPage({ searchParams }: TourPackagesPageProps) {
  const query = await searchParams;

  const scope = resolveScope(firstValue(query.scope));
  // `scope=International` IS the same thing as `category=International` —
  // the CRM's own query param already does exactly this filter server-side,
  // so scope just drives it directly rather than reinventing it.
  const category = scope === 'International' ? 'International' : resolveCategory(firstValue(query.category));
  const place = firstValue(query.place);
  const month = firstValue(query.month);
  const pageParam = Number(firstValue(query.page));
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
  // Domestic has no server-side equivalent (no "exclude category" CRM
  // query) — overfetch a page, then drop any International tour below.
  const pageSize = scope === 'Domestic' ? DOMESTIC_OVERFETCH_PAGE_SIZE : PAGE_SIZE;

  const [toursResponse, categoryCounts, places, departures] = await Promise.all([
    getTours({ category, place, month, page, pageSize }),
    getCategories(),
    getPlaces(),
    getDepartures(),
  ]);

  const tours =
    scope === 'Domestic'
      ? toursResponse.tours.filter((tour) => tour.category !== 'International').slice(0, PAGE_SIZE)
      : toursResponse.tours;
  // Honest best-effort count for the "Domestic" post-filter — not the real
  // CRM total (which has no domestic-only concept to report), but at least
  // not a stale pre-filter number either.
  const total = scope === 'Domestic' ? toursResponse.total - (toursResponse.tours.length - tours.length) : toursResponse.total;

  return (
    <SiteShell activePath="/tour-packages" pageLabel="Tour Packages">
      <TourPackagesHero />
      <Suspense fallback={null}>
        <PackagesCatalogue
          tours={tours}
          total={total}
          page={toursResponse.page}
          pageSize={PAGE_SIZE}
          categories={categoryCounts.map((entry) => entry.category)}
          places={places}
          months={departures.months}
          selectedCategory={category ?? 'All'}
          selectedPlace={place ?? 'All'}
          selectedMonth={month ?? 'All'}
          selectedScope={scope}
        />
      </Suspense>
    </SiteShell>
  );
}
