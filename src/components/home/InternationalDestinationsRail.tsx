'use client';

import Link from 'next/link';

import type { CrmTourCard } from '@/server/crm/types';
import { useHorizontalOverflow } from '@/hooks/use-horizontal-overflow';
import { PopularDestinationCard } from './PopularDestinationCard';

export interface DestinationsRailProps {
  tours: CrmTourCard[];
}

/** How far the row scrolls per arrow click — one card width + its gap. */
const SCROLL_AMOUNT_PX = 268;

/**
 * Brief §C2 (2026-11-14), after the audit confirmed `category:
 * 'International'` is the only real domestic/international signal the CRM
 * exposes (no flag on `CrmPlace`): this section — "Explore Destinations",
 * what used to be "International Tours" — now shows the real INTERNATIONAL
 * tours themselves (cover, title, price, duration, seats — the exact same
 * `PopularDestinationCard` the Popular Destinations grid uses, reused
 * rather than re-built), not a generic list of CRM places. Hidden entirely
 * when there are none, never a curated/guessed subset.
 *
 * `use client` only for the scroll-arrow button — the cards themselves stay
 * presentational. The arrow is gated on MEASURED overflow, not just a
 * breakpoint, since the real International-tour count varies with what the
 * CRM has published.
 */
export function DestinationsRail({ tours }: DestinationsRailProps) {
  const { ref: rowRef, hasOverflow: canScroll } = useHorizontalOverflow<HTMLDivElement>([tours]);

  const scrollNext = () => {
    rowRef.current?.scrollBy({ left: SCROLL_AMOUNT_PX, behavior: 'smooth' });
  };

  if (tours.length === 0) return null;

  return (
    <section
      data-testid="section-6b-destinations"
      className="flex flex-col gap-4 border-t border-gty-border-6 bg-gty-surface-5 px-gx py-[26px] 760:py-[30px]"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-24 font-extrabold tracking-tightest text-gty-ink">
          Explore <span className="text-gty-primary">Destinations</span>
        </h2>
        <Link
          href="/tour-packages?scope=international"
          className="text-14-5 font-medium text-gty-ink-soft transition-colors duration-gty-fast ease-gty hover:text-gty-primary"
        >
          View All International Tours →
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <div ref={rowRef} className="no-scrollbar flex gap-4 overflow-x-auto px-px py-1 pb-2">
          {tours.map((tour) => (
            <div key={tour.slug} className="w-[252px] flex-none sm:w-[280px]">
              <PopularDestinationCard tour={tour} />
            </div>
          ))}
        </div>
        {canScroll && (
          <button
            type="button"
            onClick={scrollNext}
            aria-label="Scroll destinations"
            className="hidden h-[38px] w-[38px] flex-none items-center justify-center rounded-pill border border-gty-border-3 text-gty-primary transition-colors duration-gty-fast ease-gty hover:border-gty-primary hover:bg-gty-primary hover:text-gty-white 1180:flex"
          >
            ›
          </button>
        )}
      </div>
    </section>
  );
}
