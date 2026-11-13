import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

import type { CrmTourCard } from '@/server/crm/types';
import { PopularDestinationCard } from './PopularDestinationCard';
import { Reveal } from './Reveal';

export interface PopularDestinationsSectionProps {
  tours: CrmTourCard[];
}

/**
 * Export lines 190-219, tech spec §4.4 row 6. Despite the section name, the
 * card composition here is the full `PopularDestinationCard`
 * (price/duration/seats/heart), not the minimal `DestinationCard` — that
 * one is reserved for the International rail below.
 *
 * "Redux" redesign (brief §6, 2026-11-14): REQUIRED CHANGE — a fixed
 * responsive grid (1 col / 2 / 3 / 4 at ≥1280px) replaces the old
 * `gridColumnsForCount` item-count-driven ladder (still used, unchanged,
 * by `/tour-packages`' own grid via `PackagesCatalogue.tsx` — that page is
 * out of scope this round). `page.tsx` already caps `tours` at 8
 * (`getTours({ pageSize: 8 })`), matching the brief's "if more than 4
 * tours, show the first 8 as rows" — nothing to slice here.
 *
 * Dot pagination (export's own, presentational-only) was dropped per the
 * brief: "Dots under the grid in the reference are decorative; omit them
 * unless a real carousel is used" — this grid is not a carousel.
 */
export function PopularDestinationsSection({ tours }: PopularDestinationsSectionProps) {
  return (
    <section className="bg-white px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-[1320px]">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <Reveal>
            <span className="inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-widest2 text-redux-crimson">
              <span aria-hidden="true" className="h-1.5 w-1.5 rotate-45 bg-redux-crimson" />
              Handpicked for you
            </span>
            <h2 className="mt-3 font-redux-display text-4xl font-medium tracking-tight text-stone-900 sm:text-5xl">
              Popular <em className="italic text-redux-crimson">Destinations</em>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <Link
              href="/tour-packages"
              className="group inline-flex items-center gap-2 rounded-full border border-stone-300 px-5 py-2.5 text-sm font-bold text-stone-800 transition-all duration-300 hover:-translate-y-0.5 hover:border-redux-crimson hover:bg-redux-crimson hover:text-white"
            >
              View All Tour Packages
              <ArrowUpRight size={16} className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </Reveal>
        </div>

        <div data-testid="popular-destinations-grid" className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tours.map((tour, index) => (
            <Reveal key={tour.slug} delay={Math.min(index * 0.12, 0.4)} className="h-full">
              <PopularDestinationCard tour={tour} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
