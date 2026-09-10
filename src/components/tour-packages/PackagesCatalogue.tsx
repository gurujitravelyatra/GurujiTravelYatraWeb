'use client';

import { useMemo, useState } from 'react';

import type { DestinationCategory, PackageRail as PackageRailData } from '@/content/types';
import { PackagesFilterBar, type CategoryFilter } from './PackagesFilterBar';
import { PackageRail } from './PackageRail';

export interface PackagesCatalogueProps {
  rails: PackageRailData[];
  categories: DestinationCategory[];
}

/**
 * Owns the category-filter state shared between `PackagesFilterBar` and the
 * 4 `PackageRail`s (tech spec §4.4: "wire the category chip row to real
 * client-side filtering of the fixture data"). One client boundary so both
 * pieces stay in sync without lifting state into a Server Component.
 */
export function PackagesCatalogue({ rails, categories }: PackagesCatalogueProps) {
  const [selected, setSelected] = useState<CategoryFilter>('All');

  const filteredRails = useMemo(
    () =>
      rails.map((rail) => ({
        ...rail,
        items: selected === 'All' ? rail.items : rail.items.filter((item) => item.category === selected),
      })),
    [rails, selected]
  );

  const visibleCount = useMemo(
    () => filteredRails.reduce((total, rail) => total + rail.items.length, 0),
    [filteredRails]
  );

  return (
    <div>
      <div className="relative z-[4] -mt-[70px] px-gx">
        <PackagesFilterBar categories={categories} selected={selected} onSelect={setSelected} visibleCount={visibleCount} />
      </div>

      <div className="flex flex-col gap-[2px] py-[26px]">
        {visibleCount === 0 ? (
          <p className="mx-gx rounded-16 border border-dashed border-gty-border-8 bg-gty-surface-3 px-4 py-8 text-center text-14 text-gty-subtle">
            No journeys match this filter yet.
          </p>
        ) : (
          filteredRails.map((rail, index) => (
            <PackageRail key={rail.title} title={rail.title} items={rail.items} background={index % 2 === 0 ? 'white' : 'cream'} />
          ))
        )}
      </div>
    </div>
  );
}
