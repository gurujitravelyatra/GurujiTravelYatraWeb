'use client';

import Link from 'next/link';

import type { CrmPlace } from '@/server/crm/types';
import { DestinationCard } from '@/components/cards/DestinationCard';
import { useHorizontalOverflow } from '@/hooks/use-horizontal-overflow';

export interface DestinationsRailProps {
  places: CrmPlace[];
}

/** How far the row scrolls per arrow click — one card width + its gap. */
const SCROLL_AMOUNT_PX = 268;

/**
 * CRM-migration Step 2: this used to be the "International Destinations"
 * rail, selected by a fixture-only `isInternational` flag with no CRM
 * equivalent. `GET /public/places` has no such flag — only
 * `showInCustomBuilder`, which answers a different question (is this place
 * offered in the Customize Tours builder, not "is it international"). So
 * this renders every active place the CRM returns, in the CRM's own saved
 * display order, under a neutral heading instead of a curation this site
 * can no longer make.
 *
 * `use client` only for the scroll-arrow button — `DestinationCard` itself
 * stays presentational. The arrow is gated on MEASURED overflow, not just a
 * breakpoint, since the real place count varies with what the CRM has
 * configured.
 */
export function DestinationsRail({ places }: DestinationsRailProps) {
  const { ref: rowRef, hasOverflow: canScroll } = useHorizontalOverflow<HTMLDivElement>([places]);

  const scrollNext = () => {
    rowRef.current?.scrollBy({ left: SCROLL_AMOUNT_PX, behavior: 'smooth' });
  };

  if (places.length === 0) return null;

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
          href="/tour-packages"
          className="text-14-5 font-medium text-gty-ink-soft transition-colors duration-gty-fast ease-gty hover:text-gty-primary"
        >
          View All Tour Packages →
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <div ref={rowRef} className="no-scrollbar flex gap-4 overflow-x-auto px-px py-1 pb-2">
          {places.map((place) => (
            <DestinationCard key={place.slug} place={place} />
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
