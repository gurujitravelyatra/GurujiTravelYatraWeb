import type { CrmTourCard } from '@/server/crm/types';
import { TourRailSection } from './TourRailSection';

export interface DestinationsRailProps {
  tours: CrmTourCard[];
  /** True when the CRM has more International tours than `tours` holds — the row then ends with a "View all tours" card. */
  hasMore?: boolean;
}

/**
 * Brief §C2 (2026-11-14), after the audit confirmed `category:
 * 'International'` is the only real domestic/international signal the CRM
 * exposes (no flag on `CrmPlace`): this section — "Explore Destinations" —
 * shows the real INTERNATIONAL tours themselves, with the exact same card
 * the Popular Destinations row uses. Hidden entirely when there are none,
 * never a curated/guessed subset.
 *
 * Round 3 (2026-11-17), Part 2: this used to be its own layout — a
 * full-bleed grey band (`px-gx`, no max-width container) with fixed
 * 252/280px cards in a scroller whose 4px/8px vertical padding clipped the
 * card shadow into a visible box. It now renders through the SAME
 * `TourRailSection` as Popular Destinations, in the same 1320px container
 * on the same white background, so both rows line up card for card and the
 * shadow, radius and hover state are literally the same code.
 *
 * No top padding of its own: it sits directly under Popular Destinations
 * (also white), whose bottom padding already provides the gap.
 */
export function DestinationsRail({ tours, hasMore = false }: DestinationsRailProps) {
  if (tours.length === 0) return null;

  return (
    <TourRailSection
      title={
        <>
          Explore <em className="italic text-redux-crimson">Destinations</em>
        </>
      }
      railLabel="International tours"
      viewAllLabel="View All International Tours"
      viewAllHref="/tour-packages?scope=international"
      tours={tours}
      hasMore={hasMore}
      sectionTestId="section-6b-destinations"
      className="bg-white px-4 pb-16 sm:px-6 sm:pb-24 lg:px-8"
    />
  );
}
