'use client';

import type { TripStop } from './TripBuilder';
import { StepHeader } from './StepHeader';

export interface TripRouteStepProps {
  trip: TripStop[];
  onClearAll: () => void;
  onMoreNights: (slug: string) => void;
  onLessNights: (slug: string) => void;
  onRemove: (slug: string) => void;
}

/**
 * Export lines 607-628 ("Your Route"). Nights start at 2 and clamp 1..9 —
 * clamping happens in `TripBuilder` (the state owner); this component only
 * disables the −/+ chips at the clamp boundaries so the limits are visible,
 * not just silently enforced.
 */
export function TripRouteStep({ trip, onClearAll, onMoreNights, onLessNights, onRemove }: TripRouteStepProps) {
  return (
    <div className="flex flex-col gap-4">
      <StepHeader
        step={2}
        title="Your Route"
        subtitle="Places you add will appear here. You can reorder, edit or remove them."
        trailing={
          <button
            type="button"
            onClick={onClearAll}
            disabled={trip.length === 0}
            className="inline-flex flex-none items-center gap-[9px] whitespace-nowrap rounded-pill border border-gty-red-300 bg-gty-red-150 px-[17px] py-[9px] text-12-5 font-semibold text-gty-primary transition-colors duration-gty-fast ease-gty hover:bg-gty-red-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true" className="flex-none">
              <path d="M9 3h6l1 2h4v2H4V5h4l1-2zM6 8h12l-1 12a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 8z" />
            </svg>
            Clear All
          </button>
        }
      />

      {trip.length === 0 ? (
        <div className="flex flex-col items-center gap-[9px] rounded-14 border border-dashed border-gty-border-8 px-6 py-[34px] text-center">
          <span aria-hidden="true" className="flex text-gty-faint">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.6" className="flex-none">
              <path d="M6 3a3 3 0 0 1 3 3c0 2-3 5-3 5S3 8 3 6a3 3 0 0 1 3-3zm12 10a3 3 0 0 1 3 3c0 2-3 5-3 5s-3-3-3-5a3 3 0 0 1 3-3zM9 6h5a4 4 0 0 1 0 8h-4a2 2 0 0 0 0 4h5" />
            </svg>
          </span>
          <p className="text-15 font-semibold text-gty-ink-soft">No places added yet</p>
          <p className="text-13 text-gty-placeholder">Add destinations above and they will appear here in your route.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {trip.map((stop, index) => (
            <li
              key={stop.slug}
              className="flex flex-wrap items-center gap-[14px] rounded-14 border border-gty-border-4 px-4 py-[14px] shadow-gty-xs"
            >
              <span
                aria-hidden="true"
                className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-pill bg-gty-primary text-12-5 font-bold text-gty-white"
              >
                {index + 1}
              </span>
              <span className="flex min-w-[140px] flex-1 flex-col gap-[2px]">
                <b className="text-15 font-bold text-gty-ink">{stop.name}</b>
                <span className="text-12-5 text-gty-subtle">
                  {stop.region} · {stop.nights} {stop.nights === 1 ? 'night' : 'nights'}
                </span>
              </span>
              <span className="flex flex-wrap gap-[9px]">
                <RouteChip
                  onClick={() => onLessNights(stop.slug)}
                  disabled={stop.nights <= 1}
                  ariaLabel={`Remove one night from ${stop.name}`}
                >
                  <span aria-hidden="true">&#8722;</span> night
                </RouteChip>
                <RouteChip
                  onClick={() => onMoreNights(stop.slug)}
                  disabled={stop.nights >= 9}
                  ariaLabel={`Add one night to ${stop.name}`}
                >
                  + night
                </RouteChip>
                <RouteChip onClick={() => onRemove(stop.slug)} ariaLabel={`Remove ${stop.name} from your trip`}>
                  Remove
                </RouteChip>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RouteChip({
  onClick,
  disabled,
  ariaLabel,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className="rounded-pill border border-gty-border-3 px-[14px] py-[8px] text-12-5 font-semibold text-gty-ink-soft transition-colors duration-gty-fast ease-gty hover:border-gty-primary hover:text-gty-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gty-border-3 disabled:hover:text-gty-ink-soft"
    >
      {children}
    </button>
  );
}
