import type { CrmTourCard } from '@/server/crm/types';
import { TourRailSection } from './TourRailSection';

export interface PopularDestinationsSectionProps {
  tours: CrmTourCard[];
  /** True when the CRM has more domestic tours than `tours` holds — the row then ends with a "View all tours" card. */
  hasMore?: boolean;
}

/**
 * Home's "Popular Destinations" row — the full `PopularDestinationCard`
 * (price/duration/seats), domestic tours only (`page.tsx` filters).
 *
 * Round 3 (2026-11-17), Parts 1 / 1b: the fixed wrapping grid (1 / 2 / 3 / 4
 * columns) is now ONE horizontal scroll row at every width, shared with the
 * International row through `TourRailSection` — see that file's header for
 * the layout, arrows and shadow-room rules. The first view on desktop is the
 * same 4 (xl) / 3 (lg) / 2 (md) cards at the same width and gap as the grid.
 *
 * `/tour-packages` still uses its own grid (`PackagesCatalogue.tsx`) and is
 * untouched.
 */
export function PopularDestinationsSection({ tours, hasMore = false }: PopularDestinationsSectionProps) {
  return (
    <TourRailSection
      eyebrow="Handpicked for you"
      title={
        <>
          Popular <em className="italic text-redux-crimson">Destinations</em>
        </>
      }
      railLabel="Popular Destinations tours"
      viewAllLabel="View All Tour Packages"
      viewAllHref="/tour-packages"
      tours={tours}
      hasMore={hasMore}
      railTestId="popular-destinations-grid"
      className="bg-white px-4 py-16 sm:px-6 sm:py-24 lg:px-8"
    />
  );
}
