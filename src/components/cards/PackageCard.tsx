import Link from 'next/link';

import type { CrmTourCard } from '@/server/crm/types';
import { formatTourDuration } from '@/lib/duration';
import { formatCrmPrice } from '@/lib/rupees';
import { PhotoPlaceholder } from '@/components/ui/photo-placeholder';
import { PriceOnRequest } from '@/components/ui/price-on-request';

export interface PackageCardProps {
  tour: CrmTourCard;
}

/**
 * `.tcard`/`.pcard` — the tour card used on Home's Popular Destinations grid
 * and the Tour Packages results grid.
 *
 * CRM-migration Step 2: this now takes the CRM's own `CrmTourCard` shape
 * directly, not the old fixture/database-era `Package` type. Two fields the
 * old card rendered have no CRM equivalent and are gone for good, not
 * merely unset:
 *  - the struck-through "was" price / "Save ₹X" badge — the CRM's `price`
 *    is a single GST-inclusive figure, never a pair to diff (CRM-migration
 *    decision 3);
 *  - the "N Photos" badge — the tour-list response carries no gallery
 *    count; that only exists on the detail response's `gallery[]`.
 *
 * Per BLOCKERS.md Decision D, the card is a `<Link>` to the detail route.
 * Per Decision E, the heart/category pill stay non-interactive `<span>`s —
 * that is what makes wrapping the whole card in one `<Link>` valid DOM.
 */
export function PackageCard({ tour }: PackageCardProps) {
  const priceLabel = formatCrmPrice(tour.price);
  const durationLabel = formatTourDuration(tour.durationDays, tour.durationNights);

  return (
    <Link
      href={`/tour-packages/${tour.slug}`}
      className="group flex w-full flex-col overflow-hidden rounded-18 bg-gty-white p-[6px] pb-[14px] text-left shadow-gty-card transition-[box-shadow,transform] duration-gty-card ease-gty hover:-translate-y-[3px] hover:shadow-gty-card-hover"
    >
      <span className="relative block w-full">
        <PhotoPlaceholder
          photoKey={tour.name}
          imageUrl={tour.coverImageUrl}
          // Production incident 2026-10-27: `tour.primaryPlace` is really
          // `null` for a tour the CRM has no place assigned to yet — this
          // crashed `/` and `/tour-packages` in production with a bare
          // `tour.primaryPlace.name` read. Falls back to just the tour
          // name rather than inventing a place.
          alt={tour.primaryPlace ? `${tour.name} — ${tour.primaryPlace.name}` : tour.name}
          className="h-[250px] w-full rounded-14"
        />
        <span className="absolute left-[10px] top-[10px] flex items-center gap-[6px] rounded-pill bg-gty-white/94 py-[6px] pl-[9px] pr-3 text-12-5 font-semibold text-gty-ink-soft shadow-gty-dark-sm">
          <span aria-hidden="true" className="flex text-gty-primary">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
              <path d="M9 3h6v2h3a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h3V3zm2 2v1h2V5h-2zm-1 5v2h4v-2h-4z" />
            </svg>
          </span>
          {tour.category}
        </span>
        <span
          aria-hidden="true"
          className="absolute right-[10px] top-[10px] flex h-[30px] w-[30px] items-center justify-center rounded-pill bg-gty-white text-gty-primary shadow-gty-dark-sm"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
            <path d="M12 20s-7.5-4.6-7.5-9.4A4.1 4.1 0 0 1 12 7.6a4.1 4.1 0 0 1 7.5 3C19.5 15.4 12 20 12 20z" />
          </svg>
        </span>
        {tour.nextDeparture && (
          <span className="absolute bottom-3 right-[10px] flex items-center gap-[6px] rounded-8 bg-gty-overlay-dark px-[10px] py-[5px] text-12 font-semibold text-gty-white">
            {tour.nextDeparture.seatsLeft > 0 ? `${tour.nextDeparture.seatsLeft} seats left` : 'Sold out'}
          </span>
        )}
      </span>

      <span className="flex w-full flex-col gap-2 px-[10px] pb-[6px] pt-[14px]">
        <span className="flex items-center gap-[7px] text-13-5 text-gty-body">
          <span aria-hidden="true" className="flex text-gty-subtle">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
              <path d="M7 2h2v2h6V2h2v2h2a1 1 0 0 1 1 1v3H3V5a1 1 0 0 1 1-1h2V2zM3 9h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9zm3 3v2h2v-2H6zm4 0v2h2v-2h-2zm4 0v2h2v-2h-2zm-8 4v2h2v-2H6zm4 0v2h2v-2h-2z" />
            </svg>
          </span>
          {durationLabel}
        </span>
        <span className="text-19 font-extrabold leading-[1.2] tracking-tightest text-gty-ink">{tour.name}</span>
        <span className="text-14 leading-[1.4] text-gty-body">{tour.shortDescription}</span>
        <span className="mt-1 h-px bg-gty-border-4" />
        <span className="flex items-center justify-between gap-[10px] pt-2">
          {priceLabel ? (
            <span className="flex items-baseline gap-[9px]">
              <span className="text-23 font-extrabold text-gty-primary">{priceLabel}</span>
            </span>
          ) : (
            // The card is already one whole-card <Link> (BLOCKERS.md Decision
            // E keeps every other element non-interactive) — a nested <a>
            // would be invalid DOM, so this renders plain text here.
            <PriceOnRequest interactive={false} />
          )}
          <span
            aria-hidden="true"
            className="flex h-9 w-9 flex-none items-center justify-center rounded-pill bg-gty-red-200 text-gty-primary"
          >
            <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor">
              <path d="M13 5l7 7-7 7-1.4-1.4L16.2 13H4v-2h12.2l-4.6-4.6z" />
            </svg>
          </span>
        </span>
      </span>
    </Link>
  );
}
