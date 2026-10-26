'use client';

import type { CrmCategory, CrmPlace } from '@/server/crm/types';
import { cn } from '@/lib/utils';

export interface PackagesFilterBarProps {
  categories: CrmCategory[];
  selectedCategory: CrmCategory | 'All';
  onSelectCategory: (category: CrmCategory | 'All') => void;
  places: CrmPlace[];
  selectedPlace: string | 'All';
  onSelectPlace: (place: string | 'All') => void;
  months: string[];
  selectedMonth: string | 'All';
  onSelectMonth: (month: string | 'All') => void;
  visibleCount: number;
  totalCount: number;
  onClear: () => void;
}

/**
 * CRM-migration Step 2 — every filter here is now REAL and server-backed,
 * each mapping 1:1 to a `GET /public/tours` query parameter (`category`,
 * `place`, `month`). The month picker used to be permanently disabled
 * ("there is no departure-date or availability data anywhere in the
 * system") — the CRM provides exactly that (`GET /public/departures`'s
 * `months` list), so it is wired for real now, not a visual stub.
 *
 * The parent page is the one that actually re-fetches on a change (these
 * callbacks update the URL query string, which re-renders the Server
 * Component page with new `getTours()` params) — this component only
 * reports selections, it does not filter anything itself.
 */
export function PackagesFilterBar({
  categories,
  selectedCategory,
  onSelectCategory,
  places,
  selectedPlace,
  onSelectPlace,
  months,
  selectedMonth,
  onSelectMonth,
  visibleCount,
  totalCount,
  onClear,
}: PackagesFilterBarProps) {
  return (
    <div className="rounded-20 bg-gty-white shadow-gty-header">
      <div className="flex flex-wrap items-center gap-5 p-6">
        <FieldFrame
          label="Destination"
          htmlFor="packages-place"
          iconPath="M12 2c3.9 0 7 3.1 7 7 0 5.3-7 13-7 13S5 14.3 5 9c0-3.9 3.1-7 7-7zm0 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"
        >
          <div className="relative flex w-full items-center rounded-11 border border-gty-border-2 bg-gty-white">
            <select
              id="packages-place"
              value={selectedPlace}
              onChange={(event) => onSelectPlace(event.target.value)}
              className="w-full appearance-none truncate rounded-11 bg-transparent px-[13px] py-[11px] pr-9 text-14 text-gty-ink-soft outline-none focus-visible:ring-2 focus-visible:ring-gty-primary"
            >
              <option value="All">All destinations</option>
              {places.map((place) => (
                <option key={place.slug} value={place.slug}>
                  {place.name}
                </option>
              ))}
            </select>
            <ChevronGlyph className="pointer-events-none absolute right-[13px]" />
          </div>
        </FieldFrame>

        <FieldFrame
          label="Travel month"
          htmlFor="packages-month"
          iconPath="M7 2h2v2h6V2h2v2h2a1 1 0 0 1 1 1v3H3V5a1 1 0 0 1 1-1h2V2zM3 9h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9zm3 3v2h2v-2H6zm4 0v2h2v-2h-2zm4 0v2h2v-2h-2zm-8 4v2h2v-2H6zm4 0v2h2v-2h-2z"
        >
          <div className="relative flex w-full items-center rounded-11 border border-gty-border-2 bg-gty-white">
            <select
              id="packages-month"
              value={selectedMonth}
              onChange={(event) => onSelectMonth(event.target.value)}
              className="w-full appearance-none truncate rounded-11 bg-transparent px-[13px] py-[11px] pr-9 text-14 text-gty-ink-soft outline-none focus-visible:ring-2 focus-visible:ring-gty-primary"
            >
              <option value="All">Any month</option>
              {months.map((month) => (
                <option key={month} value={month}>
                  {month}
                </option>
              ))}
            </select>
            <ChevronGlyph className="pointer-events-none absolute right-[13px]" />
          </div>
        </FieldFrame>

        <div className="flex flex-none items-center gap-3 border-gty-border-6 860:border-l 860:pl-5">
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-2 rounded-pill border border-gty-border-2 px-[22px] py-[13px] text-14 font-bold text-gty-ink-soft transition-colors duration-gty-fast ease-gty hover:border-gty-primary hover:text-gty-primary"
          >
            Clear <span aria-hidden="true" className="text-16 text-gty-subtle">×</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t border-gty-border-5 px-6 py-4">
        <span className="flex items-center gap-[9px] text-11-5 font-extrabold uppercase tracking-eyebrow-3 text-gty-ink-soft">
          <span aria-hidden="true" className="text-gty-primary">▦</span> Travel Category
        </span>

        <div role="group" aria-label="Filter by travel category" className="flex flex-1 flex-wrap gap-[10px]">
          <CategoryChip label="All" isActive={selectedCategory === 'All'} onClick={() => onSelectCategory('All')} />
          {categories.map((category) => (
            <CategoryChip
              key={category}
              label={category}
              isActive={selectedCategory === category}
              onClick={() => onSelectCategory(category)}
            />
          ))}
        </div>

        <p aria-live="polite" className="text-12 font-semibold text-gty-subtle">
          {visibleCount} of {totalCount} {totalCount === 1 ? 'journey' : 'journeys'}
        </p>
      </div>
    </div>
  );
}

function ChevronGlyph({ className }: { className?: string }) {
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
      className={cn('flex-none text-gty-subtle', className)}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function FieldFrame({
  label,
  htmlFor,
  iconPath,
  children,
}: {
  label: string;
  htmlFor?: string;
  iconPath: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-[230px] flex-1 items-center gap-[14px] border-gty-border-6 860:border-r 860:pr-5">
      <span aria-hidden="true" className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-14 bg-gty-red-150 text-gty-primary">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d={iconPath} />
        </svg>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-[7px]">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="text-11 font-extrabold uppercase tracking-eyebrow-3 text-gty-subtle">
            {label}
          </label>
        ) : (
          <span className="text-11 font-extrabold uppercase tracking-eyebrow-3 text-gty-subtle">{label}</span>
        )}
        {children}
      </span>
    </div>
  );
}

function CategoryChip({ label, isActive, onClick }: { label: string; isActive: boolean; onClick: () => void }) {
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
      {label}
    </button>
  );
}
