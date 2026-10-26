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

  const category = resolveCategory(firstValue(query.category));
  const place = firstValue(query.place);
  const month = firstValue(query.month);
  const pageParam = Number(firstValue(query.page));
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;

  const [toursResponse, categoryCounts, places, departures] = await Promise.all([
    getTours({ category, place, month, page, pageSize: PAGE_SIZE }),
    getCategories(),
    getPlaces(),
    getDepartures(),
  ]);

  return (
    <SiteShell activePath="/tour-packages" pageLabel="Tour Packages">
      <TourPackagesHero />
      <Suspense fallback={null}>
        <PackagesCatalogue
          tours={toursResponse.tours}
          total={toursResponse.total}
          page={toursResponse.page}
          pageSize={toursResponse.pageSize}
          categories={categoryCounts.map((entry) => entry.category)}
          places={places}
          months={departures.months}
          selectedCategory={category ?? 'All'}
          selectedPlace={place ?? 'All'}
          selectedMonth={month ?? 'All'}
        />
      </Suspense>
    </SiteShell>
  );
}
