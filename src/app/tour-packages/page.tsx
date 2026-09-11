import type { Metadata } from 'next';

import { contentAdapter } from '@/content/adapters/fixture-content-adapter';
import { getCategoryChips } from '@/content/get-category-chips';
import { getDestinationOptions } from '@/content/public-listing';
import type { DestinationCategory } from '@/content/types';

import { SiteShell } from '@/components/layout/SiteShell';
import { TourPackagesHero } from '@/components/tour-packages/TourPackagesHero';
import { PackagesCatalogue } from '@/components/tour-packages/PackagesCatalogue';

export const metadata: Metadata = {
  title: 'Tour Packages',
  description:
    'Discover handpicked journeys to the most beautiful destinations — trending, international, North India and South India tour packages.',
};

interface TourPackagesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** First value only — `?category=A&category=B` is a malformed link, not a multi-select. */
function firstValue(param: string | string[] | undefined): string | undefined {
  return Array.isArray(param) ? param[0] : param;
}

/**
 * Query params are VALIDATED against the derived option lists, never trusted.
 * An unknown, misspelled or hand-edited value falls back to "All" rather than
 * rendering an empty catalogue that looks broken — and, because both lists are
 * derived from the tour data, a param can only ever select something that has
 * real matching journeys.
 */
function resolveCategory(param: string | undefined, categories: DestinationCategory[]): DestinationCategory | 'All' {
  const value = firstValue(param);
  return categories.find((category) => category === value) ?? 'All';
}

/**
 * `/tour-packages` — Server Component, tech spec §4.4. Close to 1:1 with
 * the export (lines 341-429). Category chips are derived from the fixture
 * data (BLOCKERS.md Decision C, `getCategoryChips`), never hardcoded.
 *
 * Reading `searchParams` makes this route render per-request rather than
 * statically. Accepted deliberately: the alternative (reading the query in the
 * client with `useSearchParams` behind a `<Suspense>` boundary) serves crawlers
 * and first paint a fallback with no journeys in it, which is worse for a
 * catalogue page than losing static generation over fixture data.
 */
export default async function TourPackagesPage({ searchParams }: TourPackagesPageProps) {
  const [rails, query] = await Promise.all([contentAdapter.getPackageRails(), searchParams]);

  const categories = getCategoryChips(rails);
  const destinations = getDestinationOptions(rails.flatMap((rail) => rail.items));

  const initialCategory = resolveCategory(firstValue(query.category), categories);
  const destinationParam = firstValue(query.destination);
  const initialDestination = destinations.some((destination) => destination.slug === destinationParam)
    ? (destinationParam as string)
    : 'All';

  return (
    <SiteShell activePath="/tour-packages" pageLabel="Tour Packages">
      <TourPackagesHero />
      <PackagesCatalogue
        rails={rails}
        categories={categories}
        initialCategory={initialCategory}
        initialDestination={initialDestination}
      />
    </SiteShell>
  );
}
