'use client';

import { useMemo, useState } from 'react';

import type { CrmDeparturesTourCard } from '@/server/crm/types';
import { cn } from '@/lib/utils';
import { GroupDepartureCard } from './GroupDepartureCard';

export interface GroupDeparturesListProps {
  departures: CrmDeparturesTourCard[];
  /** `GET /public/departures`'s own `months` list (`YYYY-MM`), independent of any filter already applied. */
  months: string[];
}

type MonthFilter = string | 'All';

/**
 * CRM-migration Step 2: month chips now filter by `departure.departureDate`'s
 * `YYYY-MM` prefix, matching the CRM's own `months` shape exactly — no more
 * `departureMonthKey()`/year-guessing logic, since the CRM already resolves
 * that. The `durationUnverified`/`priceUnverified` footnotes are gone with
 * the rest of the old safety-flag system (CRM-migration decision 1).
 */
export function GroupDeparturesList({ departures, months }: GroupDeparturesListProps) {
  const [selectedMonth, setSelectedMonth] = useState<MonthFilter>('All');

  const filtered = useMemo(
    () =>
      selectedMonth === 'All' ? departures : departures.filter((departure) => departure.departureDate.startsWith(selectedMonth)),
    [departures, selectedMonth]
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="relative z-[4] -mt-16 px-gx">
        <div className="flex flex-col gap-4 rounded-20 bg-gty-white p-5 shadow-gty-header 860:flex-row 860:items-center">
          <div role="group" aria-label="Filter by departure month" className="flex flex-1 flex-wrap items-center gap-[10px]">
            <MonthChip label="All Departures" isActive={selectedMonth === 'All'} onClick={() => setSelectedMonth('All')} />
            {months.map((month) => (
              <MonthChip key={month} label={month} isActive={selectedMonth === month} onClick={() => setSelectedMonth(month)} />
            ))}
          </div>
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
        </div>

        {filtered.length > 0 ? (
          <div className="flex flex-col gap-5">
            {filtered.map((departure) => (
              <GroupDepartureCard key={`${departure.slug}-${departure.departureDate}`} departure={departure} />
            ))}
          </div>
        ) : (
          <p className="rounded-14 border border-dashed border-gty-border-8 bg-gty-surface-3 px-5 py-8 text-center text-14 text-gty-subtle">
            No departures match this month yet.
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
