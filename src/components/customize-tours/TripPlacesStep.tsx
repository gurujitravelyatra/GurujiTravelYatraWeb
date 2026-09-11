'use client';

import type { TripPlaceOption } from '@/content/types';
import { PhotoPlaceholder } from '@/components/ui/photo-placeholder';
import { cn } from '@/lib/utils';

import type { TripStop } from './TripBuilder';
import { StepHeader } from './StepHeader';

export interface TripPlacesStepProps {
  placeOptions: TripPlaceOption[];
  trip: TripStop[];
  onAdd: (place: TripPlaceOption) => void;
}

/**
 * Export lines 584-605 ("Add Places to Your Trip"). The search field + "Add"
 * button are `onClick="{{ noop }}"` in the export — per the task brief this
 * stays inert, rendered as disabled native controls (screen readers announce
 * the disabled state) rather than invented search behaviour. "Popular
 * Destinations" is a plain `<span>` badge in the export (no handler), kept
 * that way here. The place grid comes from `tripPlaceOptions`
 * (places.fixture.ts) — real data, not invented.
 */
export function TripPlacesStep({ placeOptions, trip, onAdd }: TripPlacesStepProps) {
  return (
    <div className="flex flex-col gap-4">
      <StepHeader
        step={1}
        title="Add Places to Your Trip"
        subtitle="Search destinations, temples, cities or attractions you want to include."
        trailing={
          <span className="inline-flex flex-none items-center whitespace-nowrap rounded-pill border border-gty-red-300 bg-gty-red-150 px-4 py-[9px] text-12-5 font-semibold text-gty-primary">
            Popular Destinations
          </span>
        }
      />

      <div className="flex items-center gap-3 rounded-14 border border-dashed border-gty-border-8 bg-gty-surface-2 py-[7px] pl-[18px] pr-[7px]">
        <span aria-hidden="true" className="flex flex-none text-gty-primary">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="flex-none">
            <circle cx="11" cy="11" r="6.5" />
            <path d="M16 16l4.5 4.5" />
          </svg>
        </span>
        <input
          type="text"
          disabled
          aria-label="Search a place — temple, hill station or city (coming soon)"
          placeholder="Search a place — temple, hill station, city…"
          className="min-w-0 flex-1 bg-transparent text-14 text-gty-placeholder outline-none disabled:cursor-not-allowed"
        />
        <button
          type="button"
          disabled
          className="flex flex-none cursor-not-allowed items-center gap-[9px] rounded-11 bg-gty-border-9 px-5 py-[11px] text-14 font-bold text-gty-white opacity-60"
        >
          Add <span aria-hidden="true" className="text-16">+</span>
        </button>
        <span className="flex-none pr-2 text-10 font-bold uppercase tracking-label text-gty-subtle">Coming soon</span>
      </div>

      <div className="grid grid-cols-2 gap-3 640:grid-cols-3 860:grid-cols-4">
        {placeOptions.map((place) => {
          const isAdded = trip.some((stop) => stop.slug === place.slug);
          return (
            <button
              key={place.slug}
              type="button"
              aria-pressed={isAdded}
              aria-label={isAdded ? `${place.name} added to your trip` : `Add ${place.name} to your trip`}
              onClick={() => onAdd(place)}
              className="flex flex-col overflow-hidden rounded-12 border border-gty-border-4 bg-gty-white text-left transition-shadow duration-gty-fast ease-gty hover:shadow-gty-sm"
            >
              <span className="relative block h-[88px] w-full flex-none">
                <PhotoPlaceholder photoKey={place.photoUrl} alt="" className="h-full w-full" />
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-pill text-14 font-bold',
                    isAdded ? 'bg-gty-primary text-gty-white' : 'bg-gty-white/90 text-gty-primary shadow-gty-xs'
                  )}
                >
                  +
                </span>
              </span>
              <span className="truncate px-2 py-3 text-center text-13 font-semibold text-gty-ink">{place.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
