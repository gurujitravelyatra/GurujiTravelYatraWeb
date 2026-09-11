import type { Package } from '@/content/types';
import { PackageCard } from '@/components/cards/PackageCard';
import { gridColumnsForCount } from '@/lib/card-grid';
import { cn } from '@/lib/utils';

export interface FilteredResultsProps {
  /** Every matching tour, already flattened across the four rails. */
  items: Package[];
  /** Human-readable description of what is being shown, e.g. "International journeys". */
  heading: string;
  /** Clears every active filter and returns to the default four-rail view. */
  onClearFilters: () => void;
}

/**
 * ONE consolidated results section, used whenever a filter is active.
 *
 * WHY: the catalogue's default layout is four themed rails (Trending,
 * International, North India, South India). Filtering applied to each rail
 * independently, so a single-destination deep link such as
 * `/tour-packages?destination=goa` rendered the one matching card inside its
 * rail plus THREE "No journeys match this filter yet." boxes for the rails that
 * happened not to contain it — a page that reads as mostly-broken when the
 * filter in fact worked perfectly. The rails are a browsing device for the
 * unfiltered catalogue; they carry no meaning once the visitor has told us
 * exactly what they want.
 *
 * The grid column count comes from `gridColumnsForCount`, the same helper
 * Home's Popular Destinations uses, so a 1- or 2-result filter does not draw a
 * five-column grid with empty trailing columns.
 *
 * The heading is composed from the ACTIVE FILTER VALUES, which are themselves
 * derived from the tour data (`getCategoryChips` / `getDestinationOptions`) and
 * validated server-side — so it can only ever name a category or destination
 * that real listed journeys have. Nothing here is invented copy.
 */
export function FilteredResults({ items, heading, onClearFilters }: FilteredResultsProps) {
  return (
    <section data-testid="packages-filtered-results" className="flex flex-col gap-4 px-gx pb-2 pt-[26px]">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h3 className="text-27 font-extrabold tracking-tightest text-gty-ink">{heading}</h3>
        <button
          type="button"
          onClick={onClearFilters}
          className="flex items-center gap-2 text-14 font-bold text-gty-primary transition-[text-decoration] duration-gty-fast ease-gty hover:underline"
        >
          View All Packages <span aria-hidden="true">→</span>
        </button>
      </div>

      <div data-testid="filtered-results-grid" className={cn('grid gap-5 pb-[14px]', gridColumnsForCount(items.length))}>
        {items.map((item) => (
          <PackageCard key={item.slug} package={item} />
        ))}
      </div>
    </section>
  );
}
