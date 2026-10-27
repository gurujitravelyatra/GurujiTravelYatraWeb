'use client';

import type { CrmDeparturesTourCard } from '@/server/crm/types';
import { PhotoPlaceholder } from '@/components/ui/photo-placeholder';
import { PriceOnRequest } from '@/components/ui/price-on-request';
import { Button } from '@/components/ui/button';
import { useModal } from '@/components/modals/modal-context';
import { formatCrmPrice } from '@/lib/rupees';
import { SoldOutNotice } from './SoldOutNotice';

export interface GroupDepartureCardProps {
  departure: CrmDeparturesTourCard;
}

/**
 * CRM-migration Step 2: `GET /public/departures` returns a tour CARD
 * (`CrmTourCard`) plus a `departureDate`, not the old richly-detailed
 * `GroupDeparture` model. Boarding points, tour-manager text, the script-
 * accent overlay, per-amenity icons and the `durationUnverified`/
 * `priceUnverified` markers are all GONE for good — none of them have a CRM
 * field, and the whole mark-as-unconfirmed mechanism they used was already
 * retired by CRM-migration decision 1. This card shows exactly what the
 * contract provides: the tour, its category/price/duration, the departure
 * date, and seats left or sold out.
 */
export function GroupDepartureCard({ departure }: GroupDepartureCardProps) {
  const { openGroupReservation, openBrochure } = useModal();
  const brochureContext = { label: 'Group Tour', value: departure.name, tourSlug: departure.slug };
  const priceLabel = formatCrmPrice(departure.price);
  const soldOut = departure.nextDeparture ? departure.nextDeparture.seatsLeft <= 0 : false;

  return (
    <div
      data-testid={`group-departure-${departure.slug}`}
      className="flex flex-wrap items-stretch gap-5 rounded-20 bg-gty-white p-[10px] shadow-gty-card transition-shadow duration-gty-card ease-gty hover:shadow-gty-card-hover"
    >
      <PhotoPlaceholder
        photoKey={departure.name}
        imageUrl={departure.coverImageUrl}
        // Production incident 2026-10-27: `primaryPlace` can be `null` —
        // see `CrmTourCard.primaryPlace`'s own comment. No departure has
        // hit this yet (the real CRM's departures list was empty at the
        // time), but it shares the exact same card shape as the tours that
        // did crash, so it gets the same fix.
        alt={departure.primaryPlace ? `${departure.name} — ${departure.primaryPlace.name}` : departure.name}
        className="min-h-[200px] flex-[0_1_340px] rounded-14"
      >
        <span className="absolute left-3 top-3 flex items-center gap-[7px] rounded-pill bg-gty-white/94 py-[6px] pl-2 pr-[14px] text-12-5 font-semibold text-gty-ink-soft shadow-gty-dark-xs">
          {departure.category}
        </span>
      </PhotoPlaceholder>

      <div className="flex min-w-[300px] flex-1 flex-col gap-[14px] p-3 pr-0">
        <div className="flex flex-wrap items-start justify-between gap-[14px]">
          <div className="flex min-w-[240px] flex-1 flex-col gap-[9px]">
            <h3 className="text-21 font-extrabold leading-[1.2] text-gty-ink">{departure.name}</h3>
            <div className="flex flex-wrap gap-5 text-13 text-gty-body">
              <MetaItem icon={<CalendarIcon />}>{departure.departureDate}</MetaItem>
              <MetaItem icon={<ClockIcon />}>
                {departure.durationDays} Days {departure.durationNights} Nights
              </MetaItem>
            </div>
          </div>
          <span className="flex-none whitespace-nowrap rounded-pill border border-gty-red-300 bg-gty-red-150 px-[18px] py-[9px] text-13 font-bold text-gty-primary">
            {soldOut ? 'Sold out' : `${departure.nextDeparture?.seatsLeft ?? 0} seats left`}
          </span>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-5">
          <p className="min-w-[280px] flex-1 text-13-5 leading-[1.5] text-gty-body">{departure.shortDescription}</p>

          <div className="flex min-w-[170px] flex-none flex-col items-end gap-[3px]">
            {priceLabel ? (
              <span className="flex items-baseline gap-[10px]">
                <span className="text-27 font-extrabold text-gty-primary">{priceLabel}</span>
                <span className="flex flex-col text-left">
                  <span className="text-12 text-gty-body">Per Person</span>
                </span>
              </span>
            ) : (
              <PriceOnRequest />
            )}
            <div className="flex flex-wrap justify-end gap-[11px] pt-[10px]">
              <Button type="button" variant="default" onClick={() => openBrochure(brochureContext)}>
                Get Brochure <span aria-hidden="true">↓</span>
              </Button>
              {!soldOut && (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() =>
                    openGroupReservation({
                      departureName: departure.name,
                      batchDate: departure.departureDate,
                      tourSlug: departure.slug,
                    })
                  }
                >
                  Reserve a Seat <span aria-hidden="true">→</span>
                </Button>
              )}
            </div>
            {soldOut && <SoldOutNotice />}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetaItem({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-[7px]">
      <span aria-hidden="true" className="flex text-gty-subtle">
        {icon}
      </span>
      {children}
    </span>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
      <path d="M7 2h2v2h6V2h2v2h2a1 1 0 0 1 1 1v3H3V5a1 1 0 0 1 1-1h2V2zM3 9h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9zm3 3v2h2v-2H6zm4 0v2h2v-2h-2zm4 0v2h2v-2h-2zm-8 4v2h2v-2H6zm4 0v2h2v-2h-2z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
      <path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm1 5h-2v6l4.7 2.8 1-1.7-3.7-2.2z" />
    </svg>
  );
}
