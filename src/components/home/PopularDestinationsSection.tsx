import Link from 'next/link';

import type { CrmTourCard } from '@/server/crm/types';
import { PackageCard } from '@/components/cards/PackageCard';
import { gridColumnsForCount } from '@/lib/card-grid';
import { cn } from '@/lib/utils';

export interface PopularDestinationsSectionProps {
  tours: CrmTourCard[];
}

/**
 * Export lines 190-219, tech spec §4.4 row 6. Despite the section name, the
 * export's own card composition here is the full `PackageCard`
 * (price/duration/savings/heart), not the minimal `DestinationCard` — that
 * one is reserved for the International rail below.
 *
 * Dot pagination is presentational-only per tech spec ("no working pagination
 * logic required this sprint since all fixture items fit on screen") and
 * renders ONE DOT PER CARD ACTUALLY RENDERED — the tech spec's "5 dots" was
 * written when the rail had 5 items and is not a fixed count.
 */
export function PopularDestinationsSection({ tours }: PopularDestinationsSectionProps) {
  return (
    <section data-testid="section-6-popular-destinations" className="flex flex-col gap-[14px] border-t border-gty-border-6 px-gx py-[22px]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-24 font-extrabold tracking-tightest text-gty-ink">
          Popular <span className="text-gty-primary">Destinations</span>
        </h2>
        <Link href="/tour-packages" className="text-14-5 font-medium text-gty-ink-soft transition-colors duration-gty-fast ease-gty hover:text-gty-primary">
          View All Tour Packages →
        </Link>
      </div>

      <div
        data-testid="popular-destinations-grid"
        className={cn('grid gap-[18px]', gridColumnsForCount(tours.length))}
      >
        {tours.map((tour) => (
          <PackageCard key={tour.slug} tour={tour} />
        ))}
      </div>

      <div aria-hidden="true" data-testid="popular-destinations-dots" className="flex justify-center gap-[6px] pt-1">
        {tours.map((tour, index) => (
          <span
            key={tour.slug}
            className={index === 0 ? 'h-[7px] w-[18px] rounded-pill bg-gty-primary' : 'h-[7px] w-[7px] rounded-pill bg-gty-border-3'}
          />
        ))}
      </div>
    </section>
  );
}
