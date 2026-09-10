import type { Metadata } from 'next';

import { contentAdapter } from '@/content/adapters/fixture-content-adapter';
import { getCategoryChips } from '@/content/get-category-chips';

import { SiteShell } from '@/components/layout/SiteShell';
import { TourPackagesHero } from '@/components/tour-packages/TourPackagesHero';
import { PackagesCatalogue } from '@/components/tour-packages/PackagesCatalogue';

export const metadata: Metadata = {
  title: 'Tour Packages',
  description:
    'Discover handpicked journeys to the most beautiful destinations — trending, international, North India and South India tour packages.',
};

/**
 * `/tour-packages` — Server Component, tech spec §4.4. Close to 1:1 with
 * the export (lines 341-429). Category chips are derived from the fixture
 * data (BLOCKERS.md Decision C, `getCategoryChips`), never hardcoded.
 */
export default async function TourPackagesPage() {
  const rails = await contentAdapter.getPackageRails();
  const categories = getCategoryChips(rails);

  return (
    <SiteShell activePath="/tour-packages" pageLabel="Tour Packages">
      <TourPackagesHero />
      <PackagesCatalogue rails={rails} categories={categories} />
    </SiteShell>
  );
}
