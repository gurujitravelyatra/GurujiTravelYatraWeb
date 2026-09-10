'use client';

import { useRef } from 'react';
import Link from 'next/link';

import type { Destination } from '@/content/types';
import { DestinationCard } from '@/components/cards/DestinationCard';

export interface InternationalDestinationsRailProps {
  destinations: Destination[];
}

/** How far the row scrolls per arrow click — one card width + its gap. */
const SCROLL_AMOUNT_PX = 268;

/**
 * Export lines 221-238, tech spec §4.4 row 6b. `use client` only because of
 * the scroll-arrow button (§4.5 "rail scroll-arrow buttons" is client) —
 * `DestinationCard` itself stays a plain presentational component.
 */
export function InternationalDestinationsRail({ destinations }: InternationalDestinationsRailProps) {
  const rowRef = useRef<HTMLDivElement>(null);

  const scrollNext = () => {
    rowRef.current?.scrollBy({ left: SCROLL_AMOUNT_PX, behavior: 'smooth' });
  };

  return (
    <section
      data-testid="section-6b-international-destinations"
      className="flex flex-col gap-4 border-t border-gty-border-6 bg-gty-surface-5 px-gx py-[26px] 760:py-[30px]"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-24 font-extrabold tracking-tightest text-gty-ink">
          International <span className="text-gty-primary">Destinations</span>
        </h2>
        <Link href="/tour-packages" className="text-14-5 font-medium text-gty-ink-soft transition-colors duration-gty-fast ease-gty hover:text-gty-primary">
          View All International Tours →
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <div ref={rowRef} className="no-scrollbar flex gap-4 overflow-x-auto px-px py-1 pb-2">
          {destinations.map((destination) => (
            <DestinationCard key={destination.slug} destination={destination} />
          ))}
        </div>
        <button
          type="button"
          onClick={scrollNext}
          aria-label="Scroll international destinations"
          className="hidden h-[38px] w-[38px] flex-none items-center justify-center rounded-pill border border-gty-border-3 text-gty-primary transition-colors duration-gty-fast ease-gty hover:border-gty-primary hover:bg-gty-primary hover:text-gty-white 1180:flex"
        >
          ›
        </button>
      </div>
    </section>
  );
}
