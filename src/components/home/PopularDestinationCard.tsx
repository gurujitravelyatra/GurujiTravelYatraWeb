import Link from 'next/link';
import { ArrowRight, Clock } from 'lucide-react';

import type { CrmTourCard } from '@/server/crm/types';
import { formatTourDuration } from '@/lib/duration';
import { formatCrmPrice } from '@/lib/rupees';
import { PhotoPlaceholder } from '@/components/ui/photo-placeholder';
import { PriceOnRequest } from '@/components/ui/price-on-request';

export interface PopularDestinationCardProps {
  tour: CrmTourCard;
}

/**
 * "Redux" redesign (brief §6) tour card, Home's Popular Destinations grid
 * ONLY — a deliberate SEPARATE component from `@/components/cards/PackageCard`,
 * not a restyle of it: `PackageCard` is also used by `/tour-packages`'
 * results grid, which is explicitly out of scope for this round ("restyle
 * the existing home page (and the shared header/footer)" — not every page).
 * Changing `PackageCard` directly would have restyled that page too.
 *
 * Scaled down from the brief's own card sizing (its reference is built for
 * a 2-up grid; brief §6 asks for 4-up at ≥1280px, hence the smaller image
 * height / padding / type sizes already written into this component rather
 * than the reference's larger ones).
 *
 * The reference's meta row also shows a "Group friendly" badge (Users icon)
 * "only when true for that tour" — `CrmTourCard` has no such field (no
 * group-size/group-friendly flag anywhere in the contract), so it is
 * omitted entirely rather than invented or always-shown.
 */
export function PopularDestinationCard({ tour }: PopularDestinationCardProps) {
  const priceLabel = formatCrmPrice(tour.price);
  const durationLabel = formatTourDuration(tour.durationDays, tour.durationNights);

  return (
    <Link
      href={`/tour-packages/${tour.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-stone-200/80 bg-white shadow-[0_20px_50px_-30px_rgba(28,25,23,0.25)] transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_35px_70px_-30px_rgba(127,18,22,0.45)]"
    >
      {/*
        Round 3 (2026-11-17): below 768px the card now sits in a ~66vw scroll
        row instead of a full-width column, so a fixed image height would
        change the photo's shape — 39:20 is the ratio the full-width mobile
        card had (343 x 176). From 768px up the fixed 208px height is exactly
        what it was.
      */}
      <span className="relative block aspect-[39/20] overflow-hidden md:aspect-auto md:h-52">
        <PhotoPlaceholder
          photoKey={tour.name}
          imageUrl={tour.coverImageUrl}
          // Production incident 2026-10-27: `tour.primaryPlace` is really
          // `null` for a tour the CRM has no place assigned to yet — this
          // crashed `/` and `/tour-packages` in production with a bare
          // `tour.primaryPlace.name` read. Falls back to just the tour
          // name rather than inventing a place.
          alt={tour.primaryPlace ? `${tour.name} — ${tour.primaryPlace.name}` : tour.name}
          className="h-full w-full transition-transform duration-700 ease-out group-hover:scale-[1.06]"
        />
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold text-redux-crimson shadow backdrop-blur">
          {tour.category}
        </span>
        {/* User decision (2026-11-14, Trip Finder business rules, item 1): seats/availability only ever shows for Group tours. */}
        {tour.category === 'Group' && tour.nextDeparture && (
          <span className="absolute bottom-3 right-3 rounded-full bg-redux-crimson px-3 py-1 text-[11px] font-bold text-white shadow-lg">
            {tour.nextDeparture.seatsLeft > 0 ? `${tour.nextDeparture.seatsLeft} seats left` : 'Sold out'}
          </span>
        )}
      </span>

      <span className="flex flex-1 flex-col p-4 sm:p-5">
        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-redux-ink-mute">
          <Clock size={14} className="text-redux-crimson" />
          {durationLabel}
        </span>
        <span className="mt-2 line-clamp-2 font-redux-display text-xl font-semibold leading-snug text-stone-900 transition-colors duration-300 group-hover:text-redux-crimson">
          {tour.name}
        </span>
        <span className="mt-1.5 line-clamp-2 text-sm text-redux-ink-mute">{tour.shortDescription}</span>
        <span className="mt-auto flex items-center justify-between border-t border-stone-100 pt-4">
          {priceLabel ? (
            <span className="font-redux-display text-xl font-semibold tracking-tight text-redux-crimson">{priceLabel}</span>
          ) : (
            // The card is already one whole-card <Link> (BLOCKERS.md Decision
            // E keeps every other element non-interactive) — a nested <a>
            // would be invalid DOM, so this renders plain text here.
            <PriceOnRequest interactive={false} />
          )}
          <span
            aria-hidden="true"
            className="grid h-9 w-9 flex-none place-items-center rounded-full border border-redux-crimson/30 text-redux-crimson transition-all duration-300 group-hover:bg-redux-crimson group-hover:text-white"
          >
            <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-0.5" />
          </span>
        </span>
      </span>
    </Link>
  );
}
