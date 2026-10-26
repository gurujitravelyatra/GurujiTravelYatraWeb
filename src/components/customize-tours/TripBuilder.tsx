'use client';

import { useMemo, useState } from 'react';

import type { CrmPlace } from '@/server/crm/types';
import { useModal } from '@/components/modals/modal-context';
import { tripRouteSummary, type LeadTripStop } from '@/components/modals/lead-details';

import { TripPlacesStep } from './TripPlacesStep';
import { TripRouteStep } from './TripRouteStep';
import { TripPreferencesStep } from './TripPreferencesStep';
import { AdditionalPreferencesStep } from './AdditionalPreferencesStep';
import { TripSummaryCard } from './TripSummaryCard';
import { defaultTravelStyle, type TravelStyle } from './trip-constants';

/**
 * Aliased to the lead payload's own stop type rather than re-declared, so the
 * builder's UI state and what a `custom-trip` submission carries cannot drift
 * apart. Re-exported because `TripPlacesStep`/`TripRouteStep` import it from
 * here.
 */
export type TripStop = LeadTripStop;

export interface TripBuilderProps {
  placeOptions: CrmPlace[];
  /** Resolved by the page from `GET /public/site` (with a static fallback) — see `resolveSiteContact`. */
  whatsappUrl: string;
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
export function TripBuilder({ placeOptions, whatsappUrl, children }: TripBuilderProps) {
  const [trip, setTrip] = useState<TripStop[]>([]);
  const [travelStyle, setTravelStyle] = useState<TravelStyle>(defaultTravelStyle);
  const [travelMonth, setTravelMonth] = useState('');
  const [adults, setAdults] = useState(DEFAULT_ADULTS);
  const [childrenCount, setChildrenCount] = useState(0);
  const [notes, setNotes] = useState('');
  const { openCustomTrip } = useModal();

  const addPlace = (place: CrmPlace) => {
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
  const routeSummary = useMemo(() => tripRouteSummary(trip), [trip]);

  const tripHeadline = trip.length
    ? `${totalNights} ${totalNights === 1 ? 'night' : 'nights'} / ${totalNights + 1} days`
    : 'Empty Trip';
  const tripRouteLabel = trip.length ? routeSummary : 'Your selected places will appear here in order.';
  const travelMonthLabel = travelMonth || 'Any month';
  const travellersText = travellersLabel(adults, childrenCount);

  /**
   * Opens the same enquiry modal it always has — the visitor still has to give
   * a name and mobile, and the builder collects neither — but the trip now
   * travels with it as a `custom-trip` payload.
   *
   * This previously called `openEnquiry({ value: routeSummary })`, which
   * flattened everything below into one display string and dropped the rest:
   * nights per stop, style, month, adults, children and notes reached no
   * payload at all, and the lead arrived tagged `Enquire Now – Manali → Kasol`
   * rather than `Custom Trip Request` (BLOCKERS.md item 0).
   *
   * Note what is NOT here: a budget. The "Budget (Per Person)" control in this
   * builder is `aria-disabled` with a visible "coming soon" and holds no state,
   * so `travelStyle` is the only price-tier signal there is to send.
   */
  const handleGetQuote = () => {
    openCustomTrip({
      stops: trip,
      travelStyle,
      // `''` means the visitor never chose one (displayed as "Any month"); the
      // payload says nothing rather than guessing a month.
      travelMonth: travelMonth || undefined,
      adults,
      childrenCount,
      notes: notes || undefined,
    });
  };

  const whatsappHref = useMemo(() => {
    const message = trip.length
      ? `Hi Guruji Travel Yatra, I'd like a custom trip quote.\nRoute: ${routeSummary}\nDuration: ${tripHeadline}\nTravel style: ${travelStyle}\nTravel month: ${travelMonthLabel}\nTravellers: ${travellersText}`
      : "Hi Guruji Travel Yatra, I'd like help planning a custom trip.";
    return `${whatsappUrl}?text=${encodeURIComponent(message)}`;
  }, [trip.length, routeSummary, tripHeadline, travelStyle, travelMonthLabel, travellersText, whatsappUrl]);

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
