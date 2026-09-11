'use client';

import { useMemo, useRef, useState } from 'react';

import type { DestinationCategory, PackageRail as PackageRailData } from '@/content/types';
import { getDestinationOptions, getPriceRange } from '@/content/public-listing';
import { PackagesFilterBar, type CategoryFilter, type DestinationFilter } from './PackagesFilterBar';
import { PackageRail } from './PackageRail';
import { FilteredResults } from './FilteredResults';

export interface PackagesCatalogueProps {
  rails: PackageRailData[];
  categories: DestinationCategory[];
  /** From `?category=` — already validated server-side. */
  initialCategory?: CategoryFilter;
  /** From `?destination=` — already validated server-side. */
  initialDestination?: DestinationFilter;
}

/**
 * Owns the filter state shared between `PackagesFilterBar` and the 4
 * `PackageRail`s (tech spec §4.4: "wire the category chip row to real
 * client-side filtering of the fixture data"). One client boundary so both
 * pieces stay in sync without lifting state into a Server Component.
 *
 * DEEP LINKS: the initial category/destination come from the page's
 * `searchParams`, so `/tour-packages?category=International` and
 * `?destination=maldives` land on real filtered results. That is what makes
 * the destination cards, the "View All International Tours" link and the
 * footer's Top Destinations column honest — they used to send every visitor to
 * the same unfiltered catalogue regardless of what they clicked.
 *
 * TWO LAYOUTS, chosen by whether anything is filtered:
 *  - nothing filtered → the four themed rails (Trending / International /
 *    North India / South India), which is the browsing surface they exist for;
 *  - anything filtered → ONE consolidated `FilteredResults` section.
 * The rails filtered independently, so `?destination=goa` used to draw the one
 * matching card in its rail and three empty-state boxes beside it. The rails
 * carry no meaning once a visitor has named what they want.
 *
 * Known limitation, stated rather than hidden: subsequent filter changes are
 * local state only and do NOT rewrite the URL, so the address bar can lag
 * behind the on-screen filter after the visitor clicks a chip. Incoming deep
 * links are correct; shareable-URL-on-every-click would mean a router push per
 * chip click, which is a bigger change than this pass warrants.
 */
export function PackagesCatalogue({ rails, categories, initialCategory, initialDestination }: PackagesCatalogueProps) {
  const [selected, setSelected] = useState<CategoryFilter>(initialCategory ?? 'All');
  const [selectedDestination, setSelectedDestination] = useState<DestinationFilter>(initialDestination ?? 'All');
  const resultsRef = useRef<HTMLDivElement>(null);

  const allItems = useMemo(() => rails.flatMap((rail) => rail.items), [rails]);
  const destinations = useMemo(() => getDestinationOptions(allItems), [allItems]);

  const filteredRails = useMemo(
    () =>
      rails.map((rail) => ({
        ...rail,
        items: rail.items.filter(
          (item) =>
            (selected === 'All' || item.category === selected) &&
            (selectedDestination === 'All' || item.destinationSlug === selectedDestination)
        ),
      })),
    [rails, selected, selectedDestination]
  );

  const visibleItems = useMemo(() => filteredRails.flatMap((rail) => rail.items), [filteredRails]);
  const visibleCount = visibleItems.length;

  const isFiltered = selected !== 'All' || selectedDestination !== 'All';

  /**
   * What the consolidated section calls itself, composed from the active
   * filters. Both values are derived from the tour data and validated before
   * they reach this component, so this can only name a real category and a
   * real destination — see `FilteredResults`.
   */
  const resultsHeading = useMemo(() => {
    const destinationName = destinations.find((option) => option.slug === selectedDestination)?.name;
    if (selected !== 'All' && destinationName) return `${selected} journeys in ${destinationName}`;
    if (destinationName) return `Journeys in ${destinationName}`;
    return `${selected} journeys`;
  }, [selected, selectedDestination, destinations]);

  // Reports the real bounds of what is currently listed, so the readout can
  // never contradict the cards on screen (it used to be a hardcoded band).
  const priceRangeLabel = useMemo(
    () => getPriceRange(visibleCount > 0 ? visibleItems : allItems)?.label,
    [visibleItems, visibleCount, allItems]
  );

  const scrollToResults = () => {
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /**
   * "Search Tours" applies the current selections and takes the visitor to the
   * results. Both wired filters (category chips, destination select) already
   * apply as they change, so there is nothing further to commit — the button's
   * real job is the navigation, and it does it. It is deliberately NOT a
   * `<button>` with no handler, which is what it was: focusable, announced as
   * actionable, and completely inert. If a future unwired field (travel month)
   * becomes real and needs an explicit apply step, commit it here.
   */
  const handleSearch = () => {
    scrollToResults();
  };

  /** "View All Packages" on a rail: drop every filter, then return to that rail. */
  const handleViewAll = () => {
    setSelected('All');
    setSelectedDestination('All');
    scrollToResults();
  };

  return (
    <div>
      <div className="relative z-[4] -mt-[70px] px-gx">
        <PackagesFilterBar
          categories={categories}
          selected={selected}
          onSelect={setSelected}
          visibleCount={visibleCount}
          destinations={destinations}
          selectedDestination={selectedDestination}
          onSelectDestination={setSelectedDestination}
          onSearch={handleSearch}
          priceRangeLabel={priceRangeLabel}
        />
      </div>

      <div ref={resultsRef} data-testid="packages-results" className="flex flex-col gap-[2px] py-[26px]">
        {visibleCount === 0 ? (
          <p className="mx-gx rounded-16 border border-dashed border-gty-border-8 bg-gty-surface-3 px-4 py-8 text-center text-14 text-gty-subtle">
            No journeys match this filter yet.
          </p>
        ) : isFiltered ? (
          /*
            FILTERED → ONE section. Keeping the four-rail split here rendered
            the matching card in its own rail plus a "No journeys match this
            filter yet." box for each of the other three, so a deep link that
            worked looked like a page that did not. See `FilteredResults`.
          */
          <FilteredResults items={visibleItems} heading={resultsHeading} onClearFilters={handleViewAll} />
        ) : (
          /* UNFILTERED → the four themed rails, which is what they are for. */
          filteredRails.map((rail, index) => (
            <PackageRail
              key={rail.title}
              title={rail.title}
              items={rail.items}
              background={index % 2 === 0 ? 'white' : 'cream'}
              onViewAll={handleViewAll}
            />
          ))
        )}
      </div>
    </div>
  );
}
