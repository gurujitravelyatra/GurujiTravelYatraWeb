'use client';

import type { DestinationCategory } from '@/content/types';
import { cn } from '@/lib/utils';

export type CategoryFilter = DestinationCategory | 'All';

export interface PackagesFilterBarProps {
  categories: DestinationCategory[];
  selected: CategoryFilter;
  onSelect: (category: CategoryFilter) => void;
  visibleCount: number;
}

/**
 * Export lines 355-393, tech spec §4.4 "Filter card" + BLOCKERS.md Decision
 * C. Floats up over the hero's bottom edge via a negative margin applied by
 * the parent (`PackagesCatalogue`).
 *
 * Destination / Travel month / Price range fields and the Clear/Search
 * buttons are presentational, matching the export's own `onClick="{{ noop
 * }}"` wiring exactly (Open Question Q2: real querying is a later sprint).
 * Only the category chip row is functionally wired — the one piece the
 * export itself makes interactive (`pick`/`cls`).
 */
export function PackagesFilterBar({ categories, selected, onSelect, visibleCount }: PackagesFilterBarProps) {
  return (
    <div className="rounded-20 bg-gty-white shadow-gty-header">
      <div className="flex flex-wrap items-center gap-5 p-6">
        <PresentationalField label="Destination" value="All destinations" iconPath="M12 2c3.9 0 7 3.1 7 7 0 5.3-7 13-7 13S5 14.3 5 9c0-3.9 3.1-7 7-7zm0 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
        <PresentationalField
          label="Travel month"
          value="Any month"
          iconPath="M7 2h2v2h6V2h2v2h2a1 1 0 0 1 1 1v3H3V5a1 1 0 0 1 1-1h2V2zM3 9h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9zm3 3v2h2v-2H6zm4 0v2h2v-2h-2zm4 0v2h2v-2h-2zm-8 4v2h2v-2H6zm4 0v2h2v-2h-2z"
        />
        <PresentationalField label="Price range" value="₹15,000 — ₹75,000" iconPath="M6 4h12M6 9h12M6 4c5 0 8 1.6 8 5s-3 5-8 5l9 7" />

        <div className="flex flex-none items-center gap-3 border-gty-border-6 860:border-l 860:pl-5">
          <button
            type="button"
            onClick={() => onSelect('All')}
            className="inline-flex items-center gap-2 rounded-pill border border-gty-border-2 px-[22px] py-[13px] text-14 font-bold text-gty-ink-soft transition-colors duration-gty-fast ease-gty hover:border-gty-primary hover:text-gty-primary"
          >
            Clear <span aria-hidden="true" className="text-16 text-gty-subtle">×</span>
          </button>
          <button
            type="button"
            className="inline-flex min-h-[42px] items-center gap-[9px] whitespace-nowrap rounded-pill border-[1.5px] border-gty-primary bg-gty-primary px-[26px] py-[14px] text-14 font-bold text-gty-white shadow-gty-btn transition-[background-color,transform] duration-gty-fast ease-gty hover:-translate-y-px hover:bg-gty-primary-deep"
          >
            Search Tours <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t border-gty-border-5 px-6 py-4">
        <span className="flex items-center gap-[9px] text-11-5 font-extrabold uppercase tracking-eyebrow-3 text-gty-ink-soft">
          <span aria-hidden="true" className="text-gty-primary">▦</span> Travel Category
        </span>

        <div role="group" aria-label="Filter by travel category" className="flex flex-1 flex-wrap gap-[10px]">
          <CategoryChip label="All" isActive={selected === 'All'} onClick={() => onSelect('All')} />
          {categories.map((category) => (
            <CategoryChip
              key={category}
              label={category}
              isActive={selected === category}
              onClick={() => onSelect(category)}
            />
          ))}
        </div>

        <p aria-live="polite" className="text-12 font-semibold text-gty-subtle">
          {visibleCount} {visibleCount === 1 ? 'journey' : 'journeys'} found
        </p>

        <span
          aria-hidden="true"
          className="hidden items-center gap-3 border-l border-gty-border-5 pl-[18px] 1080:flex"
        >
          <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-gty-subtle">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3c2.6 2.6 2.6 15 0 18M12 3c-2.6 2.6-2.6 15 0 18" />
          </svg>
          <span className="whitespace-nowrap -rotate-3 font-script text-23 leading-[1.15] text-gty-ink-soft">
            Not Just Trips
            <br />
            But Lifelong Memories
            <span className="mt-[2px] block h-[2px] w-[150px] rounded-[2px] bg-gty-primary" />
          </span>
        </span>
      </div>
    </div>
  );
}

function PresentationalField({ label, value, iconPath }: { label: string; value: string; iconPath: string }) {
  return (
    <div className="flex min-w-[230px] flex-1 items-center gap-[14px] border-gty-border-6 860:border-r 860:pr-5">
      <span aria-hidden="true" className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-14 bg-gty-red-150 text-gty-primary">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d={iconPath} />
        </svg>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-[7px]">
        <span className="text-11 font-extrabold uppercase tracking-eyebrow-3 text-gty-subtle">{label}</span>
        <span className="flex w-full items-center justify-between rounded-11 border border-gty-border-2 bg-gty-white px-[13px] py-[11px] text-14 text-gty-ink-soft">
          <span className="truncate">{value}</span>
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="flex-none text-gty-subtle">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
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
