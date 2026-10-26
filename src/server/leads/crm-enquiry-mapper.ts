import 'server-only';

import type { CrmEnquiryKind, CrmEnquiryRequest } from '@/server/crm/types';

import type { LeadSubmissionInput } from './lead-schema';

/**
 * Maps this site's own `LeadSubmissionInput` (the shape `POST /api/leads`
 * validates, unchanged since before the CRM migration) onto
 * `CrmEnquiryRequest` (`POST /public/enquiries`'s body, documentation/
 * technical-specification/public-website.md's own §`POST /public/enquiries`).
 *
 * This is CRM-migration Step 3's whole job: the four `formType`s the modal
 * already collects did not change shape, but the destination contract is a
 * flat, kind-tagged object, not this site's discriminated union — so the
 * translation lives here, in one place, rather than duplicated inside the
 * route handler.
 *
 * ## What has no CRM field, and where it goes instead
 *
 * The CRM's `message` is free text; `Lead.notes` is built server-side from
 * `kind`/`tourSlug`/`departureDate`/`travellers`/`preferredMonth`/
 * `placeSlugs`/`travelStyle`/`message` (the contract's own "Lead creation"
 * section) — it has NO field for "which page the visitor was on" or "which
 * departure's display name they clicked". Those display strings
 * (`pageName`, `packageName`, `departureName`, the custom-trip route
 * summary) are real information a salesperson would want and are folded
 * into `message` as a prefixed context line, never silently dropped.
 *
 * `city` (collected by the modal's own "City" field on every form type) has
 * no CRM equivalent either and is folded into `message` the same way.
 *
 * ## `travelMonth` (custom-trip) is NOT mapped to `preferredMonth`
 *
 * `TripBuilder`'s "Travel Month" select (`trip-constants.ts`'s
 * `TRAVEL_MONTHS`) collects a bare month NAME ("July"), never a year —
 * `preferredMonth` wants `YYYY-MM`. Inventing a year (this year? next year,
 * if the month has already passed?) would be fabricating data the visitor
 * never gave. It is folded into `message` as free text instead, which is
 * not a loss: a human reading "Travel month: July" from the notes loses
 * nothing a guessed year would have added.
 */

/** Fields the FORM never collects — supplied by the modal's security layer (Turnstile, consent, honeypot). */
export interface EnquirySecurityFields {
  consent: true;
  turnstileToken: string;
  /** Empty for a real visitor; the CRM honeypot check runs on whatever is sent. */
  honeypot?: string;
}

function joinNonEmpty(parts: Array<string | undefined>): string | undefined {
  const message = parts.filter((part): part is string => !!part && part.trim().length > 0).join('\n');
  return message.length > 0 ? message : undefined;
}

/** `city`, collected on every form type, has no `CrmEnquiryRequest` field — folded into the context line instead of dropped. */
function cityLine(city: string | undefined): string | undefined {
  return city ? `City: ${city}` : undefined;
}

export function buildCrmEnquiryRequest(
  input: LeadSubmissionInput,
  security: EnquirySecurityFields
): CrmEnquiryRequest {
  const base = {
    name: input.name,
    phone: input.mobile,
    email: input.email,
    consent: security.consent,
    turnstileToken: security.turnstileToken,
    honeypot: security.honeypot,
  };

  switch (input.formType) {
    case 'enquiry': {
      const kind: CrmEnquiryKind = 'ENQUIRY';
      return {
        ...base,
        kind,
        tourSlug: input.tourSlug,
        departureDate: input.travelDate,
        travellers: input.travellers,
        message: joinNonEmpty([input.pageName ? `Page: ${input.pageName}` : undefined, cityLine(input.city), input.message]),
      };
    }

    case 'brochure': {
      const kind: CrmEnquiryKind = 'BROCHURE_REQUEST';
      return {
        ...base,
        kind,
        tourSlug: input.tourSlug,
        departureDate: input.travelDate,
        travellers: input.travellers,
        message: joinNonEmpty([
          input.packageName ? `Package: ${input.packageName}` : undefined,
          cityLine(input.city),
          input.message,
        ]),
      };
    }

    case 'group-tour-reservation': {
      const kind: CrmEnquiryKind = 'RESERVE_SEAT';
      return {
        ...base,
        kind,
        tourSlug: input.tourSlug,
        // `batchDate` is `CrmDeparturesTourCard.departureDate` end-to-end
        // (`GroupDepartureCard.tsx` passes the CRM's own ISO date straight
        // through `openGroupReservation`), so it needs no reformatting —
        // unlike the generic `travelDate` field below, which this form type
        // also collects but does not use for `departureDate`: a confirmed
        // departure date is a stronger, unambiguous signal than a visitor's
        // free-typed one, and sending both would contradict each other.
        departureDate: input.batchDate,
        travellers: input.travellers,
        message: joinNonEmpty([
          input.departureName ? `Departure: ${input.departureName}` : undefined,
          cityLine(input.city),
          input.message,
        ]),
      };
    }

    case 'custom-trip': {
      const kind: CrmEnquiryKind = 'CUSTOM_TRIP';
      const travellers =
        input.travellers ?? ((input.adults ?? 0) + (input.childrenCount ?? 0) > 0
          ? (input.adults ?? 0) + (input.childrenCount ?? 0)
          : undefined);
      return {
        ...base,
        kind,
        // `placeSlugs` caps at 10 per the contract; `TripBuilder` already
        // caps stops well below that (`MAX_STOPS` in lead-schema.ts is 20,
        // which is the MODAL's own cap — slicing here is the CRM's
        // narrower limit, not a duplicate of that one).
        placeSlugs: input.stops.map((stop) => stop.slug).slice(0, 10),
        travelStyle: input.travelStyle,
        travellers,
        message: joinNonEmpty([
          input.stops.length > 0 ? `Route: ${input.stops.map((stop) => stop.name).join(' → ')}` : undefined,
          input.travelMonth ? `Travel month: ${input.travelMonth}` : undefined,
          cityLine(input.city),
          input.notes,
          input.message,
        ]),
      };
    }
  }
}
