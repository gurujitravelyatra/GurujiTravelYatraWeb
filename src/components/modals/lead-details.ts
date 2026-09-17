import type { TravelStyle } from '@/content/fixtures/places.fixture';

/**
 * The per-`formType` context a trigger hands to the lead modal, on top of the
 * display chip (`ModalContext`).
 *
 * ## Why this exists at all
 *
 * `POST /api/leads` validates a discriminated union on `formType`
 * (`src/server/leads/lead-schema.ts`) with four members. Until now the client
 * could only ever produce two of them: every trigger went through
 * `openEnquiry(context)`/`openBrochure(context)`, whose only payload is a
 * single display string. So "Reserve a Seat" transmitted a departure NAME and
 * never its date, and "Get My Custom Quote" threw away the entire trip —
 * nights per stop, style, month, travellers, notes. That was BLOCKERS.md item
 * 0's second half: not missing plumbing, actively discarded data.
 *
 * This type is the missing channel. The chip (`ModalContext.value`) stays what
 * it always was — something to SHOW the visitor — and this carries what to
 * SEND.
 *
 * ## Deliberately mirrors the server union, and is checked against it
 *
 * No structural validation lives here. `buildLeadRequest` (build-lead-request.ts)
 * assigns these fields into a `LeadSubmissionInput`, so if a member here drifts
 * from the Zod schema — a renamed field, a travel style the enum does not list —
 * the build fails rather than a 400 appearing at runtime in front of a visitor.
 *
 * ## No `budget`
 *
 * `TripBuilder` renders a "Budget (Per Person)" control that is `aria-disabled`
 * with a visible "coming soon" and collects nothing. `travelStyle` is the only
 * price-tier signal that exists. A `budget` field here would be inventing data
 * the app never asks for.
 */

/** One stop in a custom trip. Structurally identical to `TripBuilder`'s own `TripStop`, which aliases this. */
export interface LeadTripStop {
  slug: string;
  name: string;
  region: string;
  nights: number;
}

export type LeadDetails =
  | { formType: 'enquiry'; pageName?: string }
  | { formType: 'brochure'; packageName?: string }
  | {
      formType: 'group-tour-reservation';
      /**
       * REQUIRED — the server builds `Group Tour Reservation – [Batch Date]`
       * from it and rejects a submission without one. Comes from
       * `GroupDeparture.dateRangeLabel` (e.g. `"12 — 18 May 2026"`).
       */
      batchDate: string;
      departureName?: string;
    }
  | {
      formType: 'custom-trip';
      stops: readonly LeadTripStop[];
      travelStyle?: TravelStyle;
      /** `''` in `TripBuilder` means "Any month" — normalised to `undefined` when sent. */
      travelMonth?: string;
      adults?: number;
      childrenCount?: number;
      /** `AdditionalPreferencesStep`'s "Any special requests?" — distinct from the modal's own `message`. */
      notes?: string;
    };

/**
 * The route display string, e.g. `"Rishikesh → Manali"`.
 *
 * Shared by `TripBuilder` (summary card, WhatsApp deep link) and
 * `openCustomTrip` (the modal's context chip) so the chip a visitor reads and
 * the `stops` array actually submitted can never describe different trips.
 */
export function tripRouteSummary(stops: readonly LeadTripStop[]): string {
  return stops.map((stop) => stop.name).join(' → ');
}

/**
 * What `LeadModal` shows in the chip when a custom-trip enquiry starts from an
 * empty route. "Get My Custom Quote" is NOT disabled on an empty trip, and an
 * empty `stops` array is valid server-side — "I want a custom trip but haven't
 * picked anywhere yet" is a real lead — so this needs a label rather than a
 * blank chip.
 */
export const EMPTY_TRIP_LABEL = 'Custom trip';
