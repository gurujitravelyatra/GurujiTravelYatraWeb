'use client';

import type { ReactNode } from 'react';

import type { GroupDeparture } from '@/content/types';
import { PhotoPlaceholder } from '@/components/ui/photo-placeholder';
import { Button } from '@/components/ui/button';
import { useModal } from '@/components/modals/modal-context';
import { SoldOutNotice } from './SoldOutNotice';

export interface GroupDepartureCardProps {
  departure: GroupDeparture;
}

/**
 * Export `.dc.html` lines 520-556 (`.gpcard`), tech spec-equivalent for
 * `/group-tours`. One departure per card, horizontal layout: photo panel
 * (category pill + inert heart + script accent) on the left, details +
 * price + CTAs on the right.
 *
 * `id`s for the shared duration- and price-placeholder footnotes, exported so
 * `GroupDeparturesList` can render exactly one footnote of each kind for every
 * card that needs it — same "one shared note, many markers" contract as
 * `StatsBar`/`WhyGtyBand`.
 *
 * Two separate notes rather than one combined one: the copy has to say WHICH
 * figure is unconfirmed, and "Do Dham Yatra" is flagged on both counts, so a
 * single note would have to hedge on both and would point the duration marker
 * at text about price.
 *
 * Heart span: BLOCKERS.md Decision E — the export renders this as a plain
 * `<span>`/`<button style-hover>` with no real handler backing it in this
 * card either (`onClick="{{ noop }}"`, line 524); kept as a non-interactive,
 * `aria-hidden` decoration, never a working favourite toggle (no auth/storage
 * exists to persist one).
 *
 * Sold out (`departure.isSoldOut`): the "Reserve a Seat" CTA is replaced by
 * `SoldOutNotice` (product-spec §5.10's exact pattern). "Get Brochure" stays
 * active — a brochure request is not a seat reservation.
 */
export const GROUP_DURATION_NOTE_ID = 'group-duration-note';
export const GROUP_PRICE_NOTE_ID = 'group-price-note';

/**
 * The three-part unconfirmed-figure treatment `StatsBar`/`WhyGtyBand`/`Hero`
 * established, applied per-card: a real `id` on the footnote, an
 * `aria-describedby` pointing at it from a container that carries a ROLE, and a
 * visible `aria-hidden` asterisk on the figure itself.
 *
 * The role is load-bearing, not decoration — `stats-single-source.test.tsx`
 * records that `aria-describedby` on an unroled element is routinely dropped by
 * assistive tech, which is how the pairing came to be "correct on paper and
 * silent in practice" on the Home surfaces. The duration marker here shipped
 * with the same gap (describedby on a bare `<span>`); routing both flags
 * through this one helper closes it for duration as well as price.
 *
 * Returns props rather than a wrapper element so it can be spread onto the
 * figure's EXISTING span — adding a node inside the price row's flex baseline
 * alignment would risk shifting a pixel-accurate layout.
 */
function unverifiedFigureProps(isUnverified: boolean | undefined, noteId: string, label: string) {
  if (!isUnverified) return {};
  return { role: 'group', 'aria-label': label, 'aria-describedby': noteId } as const;
}

function UnverifiedMarker({ testId, className }: { testId: string; className: string }) {
  return (
    <span aria-hidden="true" data-testid={testId} className={className}>
      *
    </span>
  );
}

export function GroupDepartureCard({ departure }: GroupDepartureCardProps) {
  const { openEnquiry, openBrochure } = useModal();
  const context = { label: 'Group Tour', value: departure.name };
  const firstBoardingPoint = departure.boardingPoints.split('·')[0]?.trim() ?? departure.boardingPoints;
  const scriptLines = departure.scriptAccent.split('\n');

  return (
    <div className="flex flex-wrap items-stretch gap-5 rounded-20 bg-gty-white p-[10px] shadow-gty-card transition-shadow duration-gty-card ease-gty hover:shadow-gty-card-hover">
      <PhotoPlaceholder
        photoKey={departure.photoUrl}
        alt={`${departure.name} — ${departure.destinationName}`}
        className="min-h-[200px] flex-[0_1_340px] rounded-14"
      >
        <span className="absolute left-3 top-3 flex items-center gap-[7px] rounded-pill bg-gty-white/94 py-[6px] pl-2 pr-[14px] text-12-5 font-semibold text-gty-ink-soft shadow-gty-dark-xs">
          <span aria-hidden="true" className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-pill bg-gty-primary text-gty-white">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
              <circle cx="12" cy="8" r="3.4" />
              <path d="M5.5 20c0-3.6 2.9-5.6 6.5-5.6s6.5 2 6.5 5.6z" />
            </svg>
          </span>
          {departure.category}
        </span>
        <span
          aria-hidden="true"
          className="absolute right-3 top-3 flex h-[34px] w-[34px] flex-none items-center justify-center rounded-pill bg-gty-white text-gty-primary shadow-gty-dark-xs"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M12 20s-7.5-4.6-7.5-9.4A4.1 4.1 0 0 1 12 7.6a4.1 4.1 0 0 1 7.5 3C19.5 15.4 12 20 12 20z" />
          </svg>
        </span>
        <span
          className="absolute bottom-[14px] right-[14px] whitespace-pre-line text-right font-script text-25 leading-[1.1] text-gty-white"
          style={{ textShadow: '0 2px 10px rgba(0,0,0,.5)' }}
        >
          {scriptLines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </span>
      </PhotoPlaceholder>

      <div className="flex min-w-[300px] flex-1 flex-col gap-[14px] p-3 pr-0">
        <div className="flex flex-wrap items-start justify-between gap-[14px]">
          <div className="flex min-w-[240px] flex-1 flex-col gap-[9px]">
            <h3 className="text-21 font-extrabold leading-[1.2] text-gty-ink">{departure.name}</h3>
            <div className="flex flex-wrap gap-5 text-13 text-gty-body">
              <MetaItem icon={<CalendarIcon />}>{departure.dateRangeLabel}</MetaItem>
              <MetaItem icon={<ClockIcon />}>
                <span
                  {...unverifiedFigureProps(
                    departure.durationUnverified,
                    GROUP_DURATION_NOTE_ID,
                    `Duration — ${departure.name}`
                  )}
                >
                  {departure.durationLabel}
                  {departure.durationUnverified && (
                    <UnverifiedMarker
                      testId={`group-duration-placeholder-${departure.slug}`}
                      className="align-super text-11 font-bold text-gty-subtle"
                    />
                  )}
                </span>
              </MetaItem>
              <MetaItem icon={<BoardingIcon />}>Ex {firstBoardingPoint}</MetaItem>
            </div>
          </div>
          <span className="flex-none whitespace-nowrap rounded-pill border border-gty-red-300 bg-gty-red-150 px-[18px] py-[9px] text-13 font-bold text-gty-primary">
            {departure.seatsLabel}
          </span>
        </div>

        <div className="flex flex-wrap items-end gap-5">
          <div className="flex min-w-[280px] flex-1 flex-wrap gap-[10px]">
            <AmenityCell icon={<StayIcon />} line1="Stay" line2="(3★ Hotels)" />
            <AmenityCell icon={<VegIcon />} line1="Pure Veg" line2="Meals" />
            <AmenityCell icon={<ManagerIcon />} line1="Tour" line2="Manager" />
            <AmenityCell icon={<TransportIcon />} line1="AC" line2="Transportation" />
          </div>

          <div className="flex min-w-[170px] flex-none flex-col items-end gap-[3px]">
            <span className="flex items-baseline gap-[10px]">
              <span
                className="text-27 font-extrabold text-gty-primary"
                {...unverifiedFigureProps(
                  departure.priceUnverified,
                  GROUP_PRICE_NOTE_ID,
                  `Price per person — ${departure.name}`
                )}
              >
                {departure.priceFrom}
                {departure.priceUnverified && (
                  <UnverifiedMarker
                    testId={`group-price-placeholder-${departure.slug}`}
                    className="align-super text-16 font-bold text-gty-primary/70"
                  />
                )}
              </span>
              <span className="flex flex-col text-left">
                <span className="text-12 text-gty-body">Per Person</span>
                <span className="text-11-5 text-gty-subtle">( Twin Sharing )</span>
              </span>
            </span>
            <div className="flex flex-wrap justify-end gap-[11px] pt-[10px]">
              <Button type="button" variant="default" onClick={() => openBrochure(context)}>
                Get Brochure <span aria-hidden="true">↓</span>
              </Button>
              {departure.isSoldOut ? null : (
                <Button type="button" variant="primary" onClick={() => openEnquiry(context)}>
                  Reserve a Seat <span aria-hidden="true">→</span>
                </Button>
              )}
            </div>
            {departure.isSoldOut && <SoldOutNotice />}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetaItem({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="flex items-center gap-[7px]">
      <span aria-hidden="true" className="flex text-gty-subtle">
        {icon}
      </span>
      {children}
    </span>
  );
}

function AmenityCell({ icon, line1, line2 }: { icon: ReactNode; line1: string; line2: string }) {
  return (
    <span className="flex min-w-[120px] flex-1 items-center gap-[9px] rounded-11 bg-gty-surface-4 px-[13px] py-[9px]">
      <span aria-hidden="true" className="flex h-[27px] w-[27px] flex-none items-center justify-center rounded-8 bg-gty-red-150 text-gty-primary">
        {icon}
      </span>
      <span className="flex flex-col leading-[1.25]">
        <span className="text-12 font-semibold text-gty-ink-soft">{line1}</span>
        <span className="text-11-5 text-gty-subtle">{line2}</span>
      </span>
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

function BoardingIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
      <path d="M3 5h18a1 1 0 0 1 1 1v.4l-10 6.1L2 6.4V6a1 1 0 0 1 1-1zm-1 3.9 10 6.1 10-6.1V18a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z" />
    </svg>
  );
}

function StayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
      <path d="M4 3h9v18H4V3zm11 6h5v12h-5V9zM6 6v2h2V6H6zm3 0v2h2V6H9zm-3 4v2h2v-2H6zm3 0v2h2v-2H9zm-3 4v2h2v-2H6zm3 0v2h2v-2H9z" />
    </svg>
  );
}

function VegIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12c0-2.4 1.6-4 4-4s4 1.6 4 4-1.6 4-4 4-4-1.6-4-4z" fill="#fdeceb" />
    </svg>
  );
}

function ManagerIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5.5 20c0-3.6 2.9-5.6 6.5-5.6s6.5 2 6.5 5.6z" />
    </svg>
  );
}

function TransportIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
      <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8h-2v3h-2v-3H6v3H4v-3H2V6h2zm2 1v4h12V7H6zm0 6.5a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zm12 0a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6z" />
    </svg>
  );
}
