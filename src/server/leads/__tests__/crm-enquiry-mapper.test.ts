import { buildCrmEnquiryRequest } from '../crm-enquiry-mapper';
import type { LeadSubmissionInput } from '../lead-schema';

/**
 * `buildCrmEnquiryRequest` is CRM-migration Step 3's actual translation
 * layer — `LeadSubmissionInput` (this site's own discriminated union, long
 * predating the CRM migration) onto `CrmEnquiryRequest` (`POST
 * /public/enquiries`'s flat, `kind`-tagged body). Each case here is the
 * mapping rule documented in `crm-enquiry-mapper.ts`'s own header, pinned
 * so a future edit that silently drops a field fails a test rather than a
 * visitor's enquiry.
 */

const security = { consent: true as const, turnstileToken: 'test-turnstile-token', honeypot: '' };

/**
 * `LeadSubmissionInput` itself requires `consent`/`turnstileToken` (the Zod
 * schema's own `commonFields`), independent of the `security` object
 * `buildCrmEnquiryRequest` takes as its second argument — the route reads
 * both off the SAME validated submission in practice (see `route.ts`), but
 * the two are separate parameters here so the function has no hidden
 * dependency on `LeadSubmissionInput` carrying security fields at all.
 */
const commonFields = {
  name: 'Rahul Sharma',
  mobile: '+91 98765 43210',
  email: 'rahul@example.com',
  sourcePageUrl: 'https://gurujitravelyatra.com/tour-packages/spiti-valley-circuit',
  consent: true as const,
  turnstileToken: 'test-turnstile-token',
};

describe('buildCrmEnquiryRequest — security fields', () => {
  it('carries consent, turnstileToken and honeypot through unchanged', () => {
    const input: LeadSubmissionInput = { formType: 'enquiry', ...commonFields };
    const request = buildCrmEnquiryRequest(input, security);

    expect(request.consent).toBe(true);
    expect(request.turnstileToken).toBe('test-turnstile-token');
    expect(request.honeypot).toBe('');
  });

  it('maps name to name and mobile to phone', () => {
    const input: LeadSubmissionInput = { formType: 'enquiry', ...commonFields };
    const request = buildCrmEnquiryRequest(input, security);

    expect(request.name).toBe('Rahul Sharma');
    expect(request.phone).toBe('+91 98765 43210');
  });
});

describe('buildCrmEnquiryRequest — enquiry', () => {
  it('tags kind ENQUIRY, carries tourSlug/travellers, and folds pageName + city into message', () => {
    const input: LeadSubmissionInput = {
      formType: 'enquiry',
      ...commonFields,
      pageName: 'Spiti Valley Circuit',
      tourSlug: 'spiti-valley-circuit',
      travellers: 4,
      travelDate: '2026-09-15',
      city: 'Ahmedabad',
      message: 'Interested in a September departure.',
    };
    const request = buildCrmEnquiryRequest(input, security);

    expect(request.kind).toBe('ENQUIRY');
    expect(request.tourSlug).toBe('spiti-valley-circuit');
    expect(request.travellers).toBe(4);
    expect(request.departureDate).toBe('2026-09-15');
    expect(request.message).toContain('Page: Spiti Valley Circuit');
    expect(request.message).toContain('City: Ahmedabad');
    expect(request.message).toContain('Interested in a September departure.');
  });

  it('a contextless enquiry (no pageName/tourSlug) still builds a valid, message-less-if-empty request', () => {
    const input: LeadSubmissionInput = { formType: 'enquiry', ...commonFields };
    const request = buildCrmEnquiryRequest(input, security);

    expect(request.kind).toBe('ENQUIRY');
    expect(request.tourSlug).toBeUndefined();
    expect(request.message).toBeUndefined();
  });
});

describe('buildCrmEnquiryRequest — brochure', () => {
  it('tags kind BROCHURE_REQUEST and folds packageName into message', () => {
    const input: LeadSubmissionInput = {
      formType: 'brochure',
      ...commonFields,
      packageName: 'Spiti Valley Circuit',
      tourSlug: 'spiti-valley-circuit',
    };
    const request = buildCrmEnquiryRequest(input, security);

    expect(request.kind).toBe('BROCHURE_REQUEST');
    expect(request.tourSlug).toBe('spiti-valley-circuit');
    expect(request.message).toContain('Package: Spiti Valley Circuit');
  });
});

describe('buildCrmEnquiryRequest — group-tour-reservation', () => {
  it('tags kind RESERVE_SEAT and maps batchDate straight onto departureDate', () => {
    const input: LeadSubmissionInput = {
      formType: 'group-tour-reservation',
      ...commonFields,
      batchDate: '2026-05-12',
      departureName: 'Char Dham Yatra',
      tourSlug: 'char-dham-yatra',
    };
    const request = buildCrmEnquiryRequest(input, security);

    expect(request.kind).toBe('RESERVE_SEAT');
    expect(request.departureDate).toBe('2026-05-12');
    expect(request.tourSlug).toBe('char-dham-yatra');
    expect(request.message).toContain('Departure: Char Dham Yatra');
  });

  it('prefers batchDate over the generic travelDate field for departureDate', () => {
    const input: LeadSubmissionInput = {
      formType: 'group-tour-reservation',
      ...commonFields,
      batchDate: '2026-05-12',
      departureName: 'Char Dham Yatra',
      travelDate: '2026-11-01',
    };
    const request = buildCrmEnquiryRequest(input, security);

    expect(request.departureDate).toBe('2026-05-12');
  });
});

describe('buildCrmEnquiryRequest — custom-trip', () => {
  // Narrowed to the one union member, not the full `LeadSubmissionInput` —
  // several cases below spread this with a modified `stops`/`adults`, which
  // needs TS to already know this object IS the custom-trip member.
  const tripInput: Extract<LeadSubmissionInput, { formType: 'custom-trip' }> = {
    formType: 'custom-trip',
    ...commonFields,
    stops: [
      { slug: 'rishikesh', name: 'Rishikesh', region: 'Uttarakhand', nights: 3 },
      { slug: 'manali', name: 'Manali', region: 'Himachal', nights: 2 },
    ],
    travelStyle: 'Luxury',
    travelMonth: 'November',
    adults: 3,
    childrenCount: 1,
    notes: 'Ground floor rooms please.',
  };

  it('tags kind CUSTOM_TRIP and maps stop slugs onto placeSlugs', () => {
    const request = buildCrmEnquiryRequest(tripInput, security);

    expect(request.kind).toBe('CUSTOM_TRIP');
    expect(request.placeSlugs).toEqual(['rishikesh', 'manali']);
    expect(request.travelStyle).toBe('Luxury');
  });

  it('sums adults + childrenCount into travellers when the modal\'s own travellers field is absent', () => {
    const request = buildCrmEnquiryRequest(tripInput, security);
    expect(request.travellers).toBe(4);
  });

  it('prefers the modal\'s own travellers field over adults+childrenCount when both are present', () => {
    const request = buildCrmEnquiryRequest({ ...tripInput, travellers: 7 }, security);
    expect(request.travellers).toBe(7);
  });

  it('caps placeSlugs at 10 even though the modal allows up to 20 stops', () => {
    const manyStops = Array.from({ length: 15 }, (_, i) => ({
      slug: `place-${i}`,
      name: `Place ${i}`,
      region: 'Region',
      nights: 1,
    }));
    const request = buildCrmEnquiryRequest({ ...tripInput, stops: manyStops }, security);

    expect(request.placeSlugs).toHaveLength(10);
  });

  /**
   * `travelMonth` is a bare month NAME ("November"), not `YYYY-MM` —
   * `preferredMonth` is deliberately left unset rather than guessing a
   * year. See `crm-enquiry-mapper.ts`'s own header for why.
   */
  it('does NOT map travelMonth onto preferredMonth — it folds into message as free text instead', () => {
    const request = buildCrmEnquiryRequest(tripInput, security);

    expect(request.preferredMonth).toBeUndefined();
    expect(request.message).toContain('Travel month: November');
  });

  it('folds the route summary and notes into message', () => {
    const request = buildCrmEnquiryRequest(tripInput, security);

    expect(request.message).toContain('Rishikesh');
    expect(request.message).toContain('Manali');
    expect(request.message).toContain('Ground floor rooms please.');
  });

  it('an empty route still builds a valid request — TripBuilder does not require one', () => {
    const request = buildCrmEnquiryRequest({ ...tripInput, stops: [], adults: undefined, childrenCount: undefined }, security);

    expect(request.placeSlugs).toEqual([]);
    expect(request.travellers).toBeUndefined();
  });
});
