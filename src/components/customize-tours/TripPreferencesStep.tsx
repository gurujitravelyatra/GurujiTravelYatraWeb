'use client';

import { travelStyles, type TravelStyle } from '@/content/fixtures/places.fixture';
import { cn } from '@/lib/utils';

import { StepHeader } from './StepHeader';
import { TRAVEL_MONTHS } from './trip-constants';

export interface TripPreferencesStepProps {
  travelStyle: TravelStyle;
  onSelectStyle: (style: TravelStyle) => void;
  travelMonth: string;
  onSelectMonth: (month: string) => void;
  adults: number;
  childrenCount: number;
  onChangeAdults: (adults: number) => void;
  onChangeChildren: (children: number) => void;
}

/**
 * Export lines 630-648 ("Trip Preferences"). The export renders Travel Month,
 * Number of Travellers and Budget as three identical `onClick="{{ noop }}"`
 * buttons styled like selects. Per the task brief:
 *  - Travel Month and Number of Travellers are made REAL (product-spec §5.5
 *    asks for travel date/month and traveller count split into adults +
 *    children) — Number of Travellers needed a different control than the
 *    export's single-line button since a split count can't fit one line.
 *  - Budget (Per Person) stays an inert placeholder — the export/spec define
 *    no price bands, and inventing one would fabricate pricing. It reuses the
 *    same dashed "Coming soon" treatment `PackagesFilterBar` already
 *    established for its own unwired Travel Month field.
 */
export function TripPreferencesStep({
  travelStyle,
  onSelectStyle,
  travelMonth,
  onSelectMonth,
  adults,
  childrenCount,
  onChangeAdults,
  onChangeChildren,
}: TripPreferencesStepProps) {
  return (
    <div className="flex flex-col gap-[18px]">
      <StepHeader
        step={3}
        title="Trip Preferences"
        subtitle="Help us understand your travel style so we can plan better."
      />

      <div className="flex flex-wrap items-start gap-[26px]">
        <div className="flex min-w-[280px] flex-1 flex-col gap-3" style={{ flex: '1 1 320px' }}>
          <p className="text-13-5 font-semibold text-gty-ink-soft">How would you like to travel?</p>
          <div role="group" aria-label="Travel style" className="flex flex-wrap gap-[11px]">
            {travelStyles.map((style) => (
              <button
                key={style}
                type="button"
                aria-pressed={style === travelStyle}
                onClick={() => onSelectStyle(style)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-pill border px-[14px] py-[9px] text-13 font-semibold transition-colors duration-gty-fast ease-gty',
                  style === travelStyle
                    ? 'border-gty-primary bg-gty-primary text-gty-white'
                    : 'border-gty-border-3 text-gty-ink-soft hover:border-gty-primary hover:text-gty-primary'
                )}
              >
                <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true" className="flex-none">
                  <path d="M9 3h6v2h3a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h3V3zm2 2v1h2V5h-2z" />
                </svg>
                {style}
              </button>
            ))}
          </div>
        </div>

        <div className="flex min-w-[280px] flex-1 flex-wrap gap-[14px]" style={{ flex: '1 1 340px' }}>
          <FieldSlot label="Travel Month" htmlFor="ct-travel-month">
            <div className="relative flex w-full items-center rounded-11 border border-gty-border-2 bg-gty-white">
              <span aria-hidden="true" className="pointer-events-none absolute left-[13px] flex text-gty-primary">
                <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" className="flex-none">
                  <path d="M7 2h2v2h6V2h2v2h2a1 1 0 0 1 1 1v3H3V5a1 1 0 0 1 1-1h2V2zM3 9h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9zm3 3v2h2v-2H6zm4 0v2h2v-2h-2zm4 0v2h2v-2h-2zm-8 4v2h2v-2H6zm4 0v2h2v-2h-2zm4 0v2h2v-2h-2z" />
                </svg>
              </span>
              <select
                id="ct-travel-month"
                value={travelMonth}
                onChange={(event) => onSelectMonth(event.target.value)}
                className="w-full appearance-none truncate rounded-11 bg-transparent py-[12px] pl-[38px] pr-8 text-13-5 text-gty-ink-soft outline-none focus-visible:ring-2 focus-visible:ring-gty-primary"
              >
                <option value="">Any month</option>
                {TRAVEL_MONTHS.map((month) => (
                  <option key={month} value={month}>
                    {month}
                  </option>
                ))}
              </select>
              <ChevronGlyph className="pointer-events-none absolute right-[13px]" />
            </div>
          </FieldSlot>

          <FieldSlot label="Number of Travellers">
            <div className="flex w-full flex-col gap-[10px] rounded-11 border border-gty-border-2 bg-gty-white px-[13px] py-[10px]">
              <TravellerCounter
                label="Adults"
                value={adults}
                min={1}
                max={20}
                onChange={onChangeAdults}
              />
              <TravellerCounter
                label="Children"
                value={childrenCount}
                min={0}
                max={10}
                onChange={onChangeChildren}
              />
            </div>
          </FieldSlot>

          <FieldSlot label="Budget (Per Person)">
            <span
              aria-disabled="true"
              data-testid="ct-budget-field"
              className="flex w-full items-center justify-between gap-2 rounded-11 border border-dashed border-gty-border-2 bg-gty-surface-3 px-[13px] py-[12px] text-13-5 text-gty-placeholder"
            >
              <span className="truncate">Select budget</span>
              <span className="flex-none text-10 font-bold uppercase tracking-label text-gty-subtle">Coming soon</span>
            </span>
          </FieldSlot>
        </div>
      </div>
    </div>
  );
}

function FieldSlot({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <span className="flex min-w-[170px] flex-1 flex-col gap-2" style={{ flex: '1 1 190px' }}>
      {htmlFor ? (
        <label htmlFor={htmlFor} className="text-13 font-semibold text-gty-ink-soft">
          {label}
        </label>
      ) : (
        <span className="text-13 font-semibold text-gty-ink-soft">{label}</span>
      )}
      {children}
    </span>
  );
}

function TravellerCounter({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-13 text-gty-ink-soft">{label}</span>
      <span className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`Decrease ${label.toLowerCase()}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="flex h-7 w-7 flex-none items-center justify-center rounded-pill border border-gty-border-3 text-14 font-bold text-gty-ink-soft transition-colors duration-gty-fast ease-gty hover:border-gty-primary hover:text-gty-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          &#8722;
        </button>
        <span className="w-5 text-center text-13-5 font-semibold text-gty-ink" aria-live="polite">
          {value}
        </span>
        <button
          type="button"
          aria-label={`Increase ${label.toLowerCase()}`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="flex h-7 w-7 flex-none items-center justify-center rounded-pill border border-gty-border-3 text-14 font-bold text-gty-ink-soft transition-colors duration-gty-fast ease-gty hover:border-gty-primary hover:text-gty-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          +
        </button>
      </span>
    </div>
  );
}

function ChevronGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="15"
      height="15"
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
