import type { LeadSubmissionInput } from '@/server/leads/lead-schema';

import type { LeadDetails } from './lead-details';

/**
 * Builds the `POST /api/leads` request body from the modal's form values plus
 * the trigger's `formType` context.
 *
 * ## Why this is a separate, pure module
 *
 * It is the one place where "what the visitor typed" and "what the page knew"
 * are merged into the exact discriminated-union member the server validates.
 * That merge is the whole of BLOCKERS.md item 0, and it is worth being able to
 * assert on directly — a test here proves a custom-trip lead carries its nights
 * per stop without mounting a modal, typing into seven inputs and intercepting
 * a fetch.
 *
 * ## The return type is the contract
 *
 * `LeadSubmissionInput` is `z.infer` of the server's own schema, imported
 * TYPE-ONLY (so nothing under `src/server` is pulled into the client bundle —
 * `import type` is erased entirely at compile time). Because this function's
 * return type is that schema's type, a field renamed on the server, a required
 * field left unset, or a `travelStyle` outside the server's enum all fail
 * `tsc` here rather than surfacing as a 400 in front of a visitor.
 *
 * ## What it deliberately does NOT send
 *
 * - `source` — the CRM routing tag. The server rebuilds it from the structured
 *   context, because a public unauthenticated endpoint must not let a caller
 *   choose its own routing key. Sending one would be silently ignored anyway.
 * - `timestamp` — the server stamps `receivedAt` off its own clock.
 */

/** The seven fields the modal form actually collects, already normalised out of RHF's string-y values. */
export interface LeadContactValues {
  name: string;
  mobile: string;
  email?: string;
  travelDate?: string;
  travellers?: number;
  city?: string;
  message?: string;
}

export interface BuildLeadRequestArgs {
  details: LeadDetails;
  values: LeadContactValues;
  /**
   * The display string the context chip shows, e.g.
   * `"Spiti Valley Circuit"` — resolved from the page, never re-asked of the
   * visitor. Absent for a contextless trigger (the Navbar's persistent
   * "Enquire Now").
   */
  interestedIn?: string;
  sourcePageUrl: string;
  utm?: LeadSubmissionInput['utm'];
}

/** `''` is what an untouched input submits; the server treats it as absent, so send absent. */
function blankToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function buildLeadRequest({
  details,
  values,
  interestedIn,
  sourcePageUrl,
  utm,
}: BuildLeadRequestArgs): LeadSubmissionInput {
  const common = {
    name: values.name,
    mobile: values.mobile,
    email: blankToUndefined(values.email),
    interestedIn: blankToUndefined(interestedIn),
    travelDate: blankToUndefined(values.travelDate),
    travellers: values.travellers,
    city: blankToUndefined(values.city),
    message: blankToUndefined(values.message),
    sourcePageUrl,
    utm,
  };

  switch (details.formType) {
    case 'enquiry':
      return { formType: 'enquiry', ...common, pageName: blankToUndefined(details.pageName) };

    case 'brochure':
      return { formType: 'brochure', ...common, packageName: blankToUndefined(details.packageName) };

    case 'group-tour-reservation':
      return {
        formType: 'group-tour-reservation',
        ...common,
        // NOT passed through `blankToUndefined`: it is the one required context
        // field, and quietly dropping a blank one would turn a fixable 400 into
        // an unroutable lead. If it is empty the server says so, by name.
        batchDate: details.batchDate,
        departureName: blankToUndefined(details.departureName),
      };

    case 'custom-trip':
      return {
        formType: 'custom-trip',
        ...common,
        // Copied field-by-field rather than spread: `TripStop` is UI state and
        // may grow a field (a per-stop note, a reorder index) that has no place
        // in a lead payload. Listing the four keys means such a field has to be
        // added here on purpose to be transmitted.
        stops: details.stops.map((stop) => ({
          slug: stop.slug,
          name: stop.name,
          region: stop.region,
          nights: stop.nights,
        })),
        travelStyle: details.travelStyle,
        travelMonth: blankToUndefined(details.travelMonth),
        adults: details.adults,
        childrenCount: details.childrenCount,
        notes: blankToUndefined(details.notes),
      };
  }
}
