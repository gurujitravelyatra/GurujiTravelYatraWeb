'use client';

import { useMemo, useState } from 'react';

import type { TripPlaceOption } from '@/content/types';
import { defaultTravelStyle, type TravelStyle } from '@/content/fixtures/places.fixture';
import { useModal } from '@/components/modals/modal-context';
import { GTY_WHATSAPP_URL } from '@/lib/gty-contact';

import { TripPlacesStep } from './TripPlacesStep';
import { TripRouteStep } from './TripRouteStep';
import { TripPreferencesStep } from './TripPreferencesStep';
import { AdditionalPreferencesStep } from './AdditionalPreferencesStep';
import { TripSummaryCard } from './TripSummaryCard';

export interface TripStop {
  slug: string;
  name: string;
  region: string;
  nights: number;
}

export interface TripBuilderProps {
  placeOptions: TripPlaceOption[];
  /** Server-rendered cards for the rest of the right column (Need Help / Explore Destinations) — kept as Server Components by passing them in as children rather than importing them into this client module. */
  children?: React.ReactNode;
}

const MIN_NIGHTS = 1;
const MAX_NIGHTS = 9;
const DEFAULT_NIGHTS = 2;
const DEFAULT_ADULTS = 2;

function travellersLabel(adults: number, childrenCount: number): string {
  const parts: string[] = [`${adults} ${adults === 1 ? 'Adult' : 'Adults'}`];
  if (childrenCount > 0) {
    parts.push(`${childrenCount} ${childrenCount === 1 ? 'Child' : 'Children'}`);
  }
  return parts.join(', ');
}

/**
 * Owns all trip-builder state (export's `state.trip` / `state.tstyle` plus
 * the newly-real travel month and traveller count, product-spec §5.5) — one
 * client boundary so the builder steps and the summary card stay in sync,
 * same pattern as `PackagesCatalogue` owning the filter state for
 * `PackagesFilterBar` + the rails.
 *
 * Nights: added at 2 (export line 1146), clamp 1..9 (export lines 1148-1149).
 * Dedupe is by `slug` (the export dedupes by `name`; slug is the same
 * uniqueness guarantee and is what the rest of the codebase keys places by).
 */
export function TripBuilder({ placeOptions, children }: TripBuilderProps) {
  const [trip, setTrip] = useState<TripStop[]>([]);
  const [travelStyle, setTravelStyle] = useState<TravelStyle>(defaultTravelStyle);
  const [travelMonth, setTravelMonth] = useState('');
  const [adults, setAdults] = useState(DEFAULT_ADULTS);
  const [childrenCount, setChildrenCount] = useState(0);
  const [notes, setNotes] = useState('');
  const { openEnquiry } = useModal();

  const addPlace = (place: TripPlaceOption) => {
    setTrip((current) =>
      current.some((stop) => stop.slug === place.slug)
        ? current
        : current.concat([{ slug: place.slug, name: place.name, region: place.region, nights: DEFAULT_NIGHTS }])
    );
  };

  const removePlace = (slug: string) => {
    setTrip((current) => current.filter((stop) => stop.slug !== slug));
  };

  const changeNights = (slug: string, delta: number) => {
    setTrip((current) =>
      current.map((stop) =>
        stop.slug === slug
          ? { ...stop, nights: Math.min(MAX_NIGHTS, Math.max(MIN_NIGHTS, stop.nights + delta)) }
          : stop
      )
    );
  };

  const clearTrip = () => setTrip([]);

  const totalNights = useMemo(() => trip.reduce((sum, stop) => sum + stop.nights, 0), [trip]);
  const routeSummary = useMemo(() => trip.map((stop) => stop.name).join(' → '), [trip]);

  const tripHeadline = trip.length
    ? `${totalNights} ${totalNights === 1 ? 'night' : 'nights'} / ${totalNights + 1} days`
    : 'Empty Trip';
  const tripRouteLabel = trip.length ? routeSummary : 'Your selected places will appear here in order.';
  const travelMonthLabel = travelMonth || 'Any month';
  const travellersText = travellersLabel(adults, childrenCount);

  const handleGetQuote = () => {
    openEnquiry(trip.length ? { label: 'Custom trip', value: routeSummary } : { label: 'Custom trip', value: 'Custom trip' });
  };

  const whatsappHref = useMemo(() => {
    const message = trip.length
      ? `Hi Guruji Travel Yatra, I'd like a custom trip quote.\nRoute: ${routeSummary}\nDuration: ${tripHeadline}\nTravel style: ${travelStyle}\nTravel month: ${travelMonthLabel}\nTravellers: ${travellersText}`
      : "Hi Guruji Travel Yatra, I'd like help planning a custom trip.";
    return `${GTY_WHATSAPP_URL}?text=${encodeURIComponent(message)}`;
  }, [trip.length, routeSummary, tripHeadline, travelStyle, travelMonthLabel, travellersText]);

  return (
    <div className="flex flex-wrap items-start gap-[22px] px-gx pb-[26px] pt-[18px]">
      <div
        className="flex min-w-[320px] flex-col gap-[30px] rounded-18 bg-gty-white p-[26px] shadow-gty-md"
        style={{ flex: '1.9 1 560px' }}
      >
        <TripPlacesStep placeOptions={placeOptions} trip={trip} onAdd={addPlace} />
        <TripRouteStep
          trip={trip}
          onClearAll={clearTrip}
          onMoreNights={(slug) => changeNights(slug, 1)}
          onLessNights={(slug) => changeNights(slug, -1)}
          onRemove={removePlace}
        />
        <TripPreferencesStep
          travelStyle={travelStyle}
          onSelectStyle={setTravelStyle}
          travelMonth={travelMonth}
          onSelectMonth={setTravelMonth}
          adults={adults}
          childrenCount={childrenCount}
          onChangeAdults={setAdults}
          onChangeChildren={setChildrenCount}
        />
        <AdditionalPreferencesStep notes={notes} onChangeNotes={setNotes} />
      </div>

      <div className="flex min-w-[300px] flex-col gap-[18px]" style={{ flex: '1 1 330px' }}>
        <TripSummaryCard
          totalStops={trip.length}
          tripHeadline={tripHeadline}
          tripRouteLabel={tripRouteLabel}
          travelStyleLabel={travelStyle}
          travelMonthLabel={travelMonthLabel}
          travellersLabel={travellersText}
          onGetQuote={handleGetQuote}
          whatsappHref={whatsappHref}
        />
        {children}
      </div>
    </div>
  );
}
