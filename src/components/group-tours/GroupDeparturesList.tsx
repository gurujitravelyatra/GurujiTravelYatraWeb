'use client';

import { useMemo, useState } from 'react';

import type { GroupDeparture } from '@/content/types';
import { departureMonthKey } from '@/lib/departure-dates';
import { cn } from '@/lib/utils';
import { GroupDepartureCard, GROUP_DURATION_NOTE_ID, GROUP_PRICE_NOTE_ID } from './GroupDepartureCard';

export interface GroupDeparturesListProps {
  departures: GroupDeparture[];
  /**
   * Month chip keys, e.g. `['May 2026', 'Jun 2026']` — `departureMonthKeys()` over
   * the departures being rendered. Each key is also the chip's visible label.
   */
  months: string[];
}

type MonthFilter = string | 'All';

/**
 * Export `.dc.html` lines 496-557: the floating filter card + the "Upcoming
 * Group Tours" section. A single client component because the month chips
 * (real filter) and the list they filter must share state — same reasoning
 * as `PackagesCatalogue` pairing `PackagesFilterBar` with `FilteredResults`.
 *
 * WHAT IS AND ISN'T WIRED, following the same disclosure convention
 * `PackagesFilterBar` established:
 *  - Month chips — REAL. Filter `departures` live, `role="group"` +
 *    `aria-pressed` + an `aria-live="polite"` result count.
 *  - Search field — NOT WIRED. The export itself renders it as two `<span>`s
 *    with no `<input>` and no handler at all (`.dc.html` lines 501-504) —
 *    there was never a search implementation to port. Rendered here as a
 *    `disabled` input so it is structurally inert, with an accessible label
 *    stating it isn't available yet.
 *  - "Sort by: Earliest Departure" — NOT WIRED (`onClick="{{ noop }}"`,
 *    export line 516). Rendered as a non-interactive, `aria-disabled` span
 *    rather than a clickable-looking button.
 */
export function GroupDeparturesList({ departures, months }: GroupDeparturesListProps) {
  const [selectedMonth, setSelectedMonth] = useState<MonthFilter>('All');

  const filtered = useMemo(
    () => (selectedMonth === 'All'
        ? departures
        : departures.filter((departure) => departureMonthKey(departure) === selectedMonth)),
    [departures, selectedMonth]
  );

  // Both notes are keyed off the FILTERED set, not the full fixture: a footnote
  // explaining a marker no visible card carries is noise.
  const hasUnverifiedDuration = filtered.some((departure) => departure.durationUnverified);
  const hasUnverifiedPrice = filtered.some((departure) => departure.priceUnverified);

  return (
    <div className="flex flex-col gap-5">
      <div className="relative z-[4] -mt-16 px-gx">
        <div className="flex flex-col gap-4 rounded-20 bg-gty-white p-5 shadow-gty-header 860:flex-row 860:items-center">
          <div role="group" aria-label="Filter by departure month" className="flex flex-1 flex-wrap items-center gap-[10px]">
            <MonthChip label="All Departures" isActive={selectedMonth === 'All'} onClick={() => setSelectedMonth('All')} />
            {months.map((month) => (
              <MonthChip
                key={month}
                // The key carries its own year (`departureMonthKey`). This used to
                // append a hard-coded " 2026", which would have mislabelled the
                // first batch an admin added for any other year.
                label={month}
                isActive={selectedMonth === month}
                onClick={() => setSelectedMonth(month)}
              />
            ))}
          </div>

          <SearchFieldPlaceholder />
        </div>

        <p aria-live="polite" className="pt-3 text-12 font-semibold text-gty-subtle">
          {filtered.length} {filtered.length === 1 ? 'departure' : 'departures'} found
        </p>
      </div>

      <section className="flex flex-col gap-5 px-gx pb-16 pt-2">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-[7px]">
            <h2 id="upcoming-group-tours" className="text-27 font-extrabold leading-[1.05] tracking-tightest text-gty-ink 760:text-33">
              Upcoming <span className="text-gty-primary">Group Tours</span>
            </h2>
            <p className="text-14 text-gty-body">Handpicked journeys with confirmed departures. Limited seats — book early!</p>
          </div>

          <div className="flex flex-none items-center gap-3">
            <span className="text-13-5 text-gty-body">Sort by:</span>
            <span
              aria-disabled="true"
              className="flex items-center gap-[14px] rounded-11 border border-gty-border-2 bg-gty-white px-[15px] py-[11px] text-13-5 text-gty-ink-soft"
            >
              Earliest Departure
              <ChevronGlyph />
              <span className="sr-only">(sorting is not available yet)</span>
            </span>
          </div>
        </div>

        {filtered.length > 0 ? (
          <div className="flex flex-col gap-5">
            {filtered.map((departure) => (
              <GroupDepartureCard key={departure.slug} departure={departure} />
            ))}
          </div>
        ) : (
          <p className="rounded-14 border border-dashed border-gty-border-8 bg-gty-surface-3 px-5 py-8 text-center text-14 text-gty-subtle">
            No departures match this month yet.
          </p>
        )}

        {hasUnverifiedDuration && (
          <p id={GROUP_DURATION_NOTE_ID} data-testid="group-duration-note" className="text-11 text-gty-subtle">
            *Duration for this departure is pending confirmation and is shown as reported.
          </p>
        )}

        {hasUnverifiedPrice && (
          <p id={GROUP_PRICE_NOTE_ID} data-testid="group-price-note" className="text-11 text-gty-subtle">
            *Price for this departure is pending confirmation and is shown as reported. Please confirm with a GTY
            planner before booking.
          </p>
        )}
      </section>
    </div>
  );
}

function MonthChip({ label, isActive, onClick }: { label: string; isActive: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={cn(
        'inline-flex items-center gap-2 whitespace-nowrap rounded-pill border px-[18px] py-[10px] text-13-5 font-semibold transition-colors duration-gty-fast ease-gty',
        isActive
          ? 'border-gty-primary bg-gty-primary text-gty-white shadow-gty-btn'
          : 'border-gty-border-2 bg-gty-white text-gty-ink-soft hover:border-gty-primary hover:text-gty-primary'
      )}
    >
      <span aria-hidden="true" className="flex">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
          <path d="M7 2h2v2h6V2h2v2h2a1 1 0 0 1 1 1v3H3V5a1 1 0 0 1 1-1h2V2zM3 9h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9zm3 3v2h2v-2H6zm4 0v2h2v-2h-2zm4 0v2h2v-2h-2zm-8 4v2h2v-2H6zm4 0v2h2v-2h-2z" />
        </svg>
      </span>
      {label}
    </button>
  );
}

/**
 * The export's own search field (`.dc.html` lines 501-504) is two `<span>`s —
 * an icon and a placeholder-styled label — with no `<input>`, no `onInput`,
 * no handler of any kind. There was nothing "noop" to port because there was
 * never a working (or fake-working) field to begin with. Rendered here as a
 * genuinely `disabled` input so assistive tech and sighted users alike get an
 * honest signal that it does nothing, while keeping the exact visual the
 * export specifies.
 */
function SearchFieldPlaceholder() {
  return (
    <div className="flex min-w-[230px] flex-none items-center gap-[11px] rounded-pill border border-gty-border-2 px-5 py-3 860:w-[340px]">
      <span aria-hidden="true" className="flex flex-none text-gty-subtle">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round">
          <circle cx="11" cy="11" r="6.5" />
          <path d="M16 16l4.5 4.5" />
        </svg>
      </span>
      <label htmlFor="group-tours-search" className="sr-only">
        Search destination or tour — not available yet
      </label>
      <input
        id="group-tours-search"
        type="text"
        disabled
        placeholder="Search destination or tour…"
        aria-describedby="group-tours-search-note"
        className="w-full min-w-0 bg-transparent text-14 text-gty-placeholder outline-none placeholder:text-gty-placeholder disabled:cursor-not-allowed"
      />
      <span id="group-tours-search-note" className="sr-only">
        This field is not wired up yet — use the month chips above to filter departures.
      </span>
    </div>
  );
}

function ChevronGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="17"
      height="17"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="flex-none text-gty-subtle"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
