import Link from 'next/link';

import type { Package } from '@/content/types';
import { PackageCard } from '@/components/cards/PackageCard';

export interface PopularDestinationsSectionProps {
  packages: Package[];
}

/**
 * Export lines 190-219, tech spec §4.4 row 6. Despite the section name, the
 * export's own card composition here is the full `PackageCard`
 * (price/duration/savings/heart), not the minimal `DestinationCard` — that
 * one is reserved for the International rail below.
 *
 * Dot pagination (5 dots, first active) is presentational-only per tech
 * spec: "no working pagination logic required this sprint since all 5
 * fixture items fit on screen."
 */
export function PopularDestinationsSection({ packages }: PopularDestinationsSectionProps) {
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

      <div className="grid grid-cols-2 gap-[18px] 640:grid-cols-3 1080:grid-cols-5">
        {packages.map((pkg) => (
          <PackageCard key={pkg.slug} package={pkg} />
        ))}
      </div>

      <div aria-hidden="true" className="flex justify-center gap-[6px] pt-1">
        {packages.map((pkg, index) => (
          <span
            key={pkg.slug}
            className={index === 0 ? 'h-[7px] w-[18px] rounded-pill bg-gty-primary' : 'h-[7px] w-[7px] rounded-pill bg-gty-border-3'}
          />
        ))}
      </div>
    </section>
  );
}
