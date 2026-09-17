import { buildLeadRequest, type LeadContactValues } from '../build-lead-request';
import type { LeadDetails } from '../lead-details';
import { buildSourceTag, leadSubmissionSchema } from '@/server/leads/lead-schema';

/**
 * The seam BLOCKERS.md item 0 was about: what the visitor typed + what the page
 * knew -> the exact discriminated-union member `POST /api/leads` validates.
 *
 * Every case here is asserted TWICE, and the second assertion is the one that
 * matters:
 *
 *  1. `toEqual` on the built object — pins the field mapping.
 *  2. `leadSubmissionSchema.safeParse(...)` against the SERVER'S OWN schema —
 *     proves the object would actually be accepted.
 *
 * (1) alone is the trap this codebase already fell into once: a payload that
 * matches what the author believed the contract to be, asserted against a
 * hand-written copy of that belief, passing forever while the endpoint 400s.
 * Re-running the real validator means a schema change breaks these tests
 * instead of breaking a visitor's submission.
 */

const values: LeadContactValues = {
  name: 'Asha Patel',
  mobile: '9876543210',
  email: 'asha@example.com',
  travelDate: '2026-05-12',
  travellers: 4,
  city: 'Ahmedabad',
  message: 'Prefer a morning departure.',
};

const BASE_URL = 'https://gurujitravelyatra.com/customize-tours';

function build(details: LeadDetails, overrides: Partial<Parameters<typeof buildLeadRequest>[0]> = {}) {
  return buildLeadRequest({ details, values, sourcePageUrl: BASE_URL, ...overrides });
}

/** Fails loudly WITH the field paths, rather than a bare `false`. */
function expectServerAccepts(request: unknown) {
  const parsed = leadSubmissionSchema.safeParse(request);
  if (!parsed.success) {
    throw new Error(`Server schema rejected the built request: ${JSON.stringify(parsed.error.issues, null, 2)}`);
  }
  return parsed.data;
}

describe('buildLeadRequest — common fields', () => {
  it('carries every collected contact field through unchanged', () => {
    const request = build({ formType: 'enquiry' });

    expect(request).toMatchObject({
      name: 'Asha Patel',
      mobile: '9876543210',
      email: 'asha@example.com',
      travelDate: '2026-05-12',
      travellers: 4,
      city: 'Ahmedabad',
      message: 'Prefer a morning departure.',
      sourcePageUrl: BASE_URL,
    });
    expectServerAccepts(request);
  });

  it('normalises untouched ("") inputs to absent rather than sending empty strings', () => {
    const request = build(
      { formType: 'enquiry' },
      { values: { name: 'Asha Patel', mobile: '9876543210', email: '', travelDate: '', city: '', message: '' } }
    );

    expect(request.email).toBeUndefined();
    expect(request.travelDate).toBeUndefined();
    expect(request.city).toBeUndefined();
    expect(request.message).toBeUndefined();
    expect(request.travellers).toBeUndefined();
    expectServerAccepts(request);
  });

  it('passes utm through and omits it entirely when the visitor arrived without one', () => {
    const utm = { source: 'google', medium: 'cpc', campaign: 'spiti-2026' };

    expect(build({ formType: 'enquiry' }, { utm }).utm).toEqual(utm);
    expect(build({ formType: 'enquiry' }).utm).toBeUndefined();
    expectServerAccepts(build({ formType: 'enquiry' }, { utm }));
  });

  /**
   * Both are server-owned. `source` especially: this endpoint is public and
   * unauthenticated, so a client-chosen CRM routing key would be a caller
   * picking which bucket its lead lands in.
   */
  it('sends neither `source` nor `timestamp` — the server owns both', () => {
    const request = build({ formType: 'enquiry' }) as Record<string, unknown>;

    expect(request).not.toHaveProperty('source');
    expect(request).not.toHaveProperty('timestamp');
  });
});

describe('buildLeadRequest — enquiry', () => {
  it('tags `enquiry` and carries the page name', () => {
    const request = build({ formType: 'enquiry', pageName: 'Home' }, { interestedIn: 'Home' });

    expect(request).toMatchObject({ formType: 'enquiry', pageName: 'Home', interestedIn: 'Home' });
    expect(buildSourceTag(expectServerAccepts(request))).toBe('Enquire Now – Home');
  });

  it('a contextless enquiry (the Navbar CTA) is still valid, and the SERVER supplies the fallback tag', () => {
    const request = build({ formType: 'enquiry', pageName: undefined });

    // Narrowed rather than cast: `build` returns the full union, and the
    // discriminant is exactly what this case is asserting about.
    if (request.formType !== 'enquiry') throw new Error(`expected an enquiry, got ${request.formType}`);
    expect(request.pageName).toBeUndefined();
    expect(request.interestedIn).toBeUndefined();
    expect(buildSourceTag(expectServerAccepts(request))).toBe('Enquire Now – General enquiry');
  });
});

describe('buildLeadRequest — brochure', () => {
  it('tags `brochure` and carries the package name', () => {
    const request = build(
      { formType: 'brochure', packageName: 'Spiti Valley Circuit' },
      { interestedIn: 'Spiti Valley Circuit' }
    );

    expect(request).toMatchObject({ formType: 'brochure', packageName: 'Spiti Valley Circuit' });
    expect(buildSourceTag(expectServerAccepts(request))).toBe('Brochure Download – Spiti Valley Circuit');
  });
});

describe('buildLeadRequest — group-tour-reservation', () => {
  const details: LeadDetails = {
    formType: 'group-tour-reservation',
    batchDate: '12 — 18 May 2026',
    departureName: 'Spiti Valley Circuit',
  };

  it('tags `group-tour-reservation` and carries BOTH the batch date and the departure name', () => {
    const request = build(details, { interestedIn: 'Spiti Valley Circuit' });

    expect(request).toMatchObject({
      formType: 'group-tour-reservation',
      batchDate: '12 — 18 May 2026',
      departureName: 'Spiti Valley Circuit',
    });
    expectServerAccepts(request);
  });

  /**
   * The regression this whole change exists to prevent. Before, "Reserve a
   * Seat" sent `openEnquiry({ value: departure.name })`: the lead was tagged
   * `Enquire Now – Spiti Valley Circuit` and the date appeared nowhere, so a
   * time-sensitive seat request could not be tied to a departure.
   */
  it('builds the batch-date source tag the old name-only payload could not', () => {
    const request = build(details);

    expect(buildSourceTag(expectServerAccepts(request))).toBe('Group Tour Reservation – 12 — 18 May 2026');
  });

  it('does NOT quietly drop a blank batch date — the server rejects it by name', () => {
    // Blanking it is not reachable from `GroupDepartureCard` (every fixture
    // departure has a `dateRangeLabel`), but silently omitting it would
    // downgrade a loud, fixable 400 into an unroutable lead.
    const request = build({ formType: 'group-tour-reservation', batchDate: '', departureName: 'X' });

    expect(request).toHaveProperty('batchDate', '');
    const parsed = leadSubmissionSchema.safeParse(request);
    expect(parsed.success).toBe(false);
    expect(parsed.success === false && parsed.error.issues.some((issue) => issue.path.join('.') === 'batchDate')).toBe(
      true
    );
  });
});

describe('buildLeadRequest — custom-trip', () => {
  const details: LeadDetails = {
    formType: 'custom-trip',
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

  /**
   * The other half of item 0: `handleGetQuote` used to collapse all of this
   * into the single string `"Rishikesh → Manali"` and discard the rest.
   */
  it('carries the whole trip — nights PER STOP, style, month, travellers and notes', () => {
    const request = build(details, { interestedIn: 'Rishikesh → Manali' });

    expect(request).toEqual(
      expect.objectContaining({
        formType: 'custom-trip',
        stops: [
          { slug: 'rishikesh', name: 'Rishikesh', region: 'Uttarakhand', nights: 3 },
          { slug: 'manali', name: 'Manali', region: 'Himachal', nights: 2 },
        ],
        travelStyle: 'Luxury',
        travelMonth: 'November',
        adults: 3,
        childrenCount: 1,
        notes: 'Ground floor rooms please.',
        interestedIn: 'Rishikesh → Manali',
      })
    );
    expect(buildSourceTag(expectServerAccepts(request))).toBe('Custom Trip Request');
  });

  it('keeps `notes` separate from the modal\'s own `message` — they are different questions', () => {
    const request = build(details, { values: { ...values, message: 'Call after 6pm.' } });

    expect(request).toMatchObject({ notes: 'Ground floor rooms please.', message: 'Call after 6pm.' });
    expectServerAccepts(request);
  });

  /**
   * "Get My Custom Quote" is not disabled on an empty route, so this is a real
   * path — and a valuable lead ("I want a custom trip, help me plan it"),
   * not an error.
   */
  it('accepts an empty route', () => {
    const request = build({ formType: 'custom-trip', stops: [], travelStyle: 'Comfort', adults: 2, childrenCount: 0 });

    expect(request).toMatchObject({ formType: 'custom-trip', stops: [] });
    expect(buildSourceTag(expectServerAccepts(request))).toBe('Custom Trip Request');
  });

  it('omits a never-chosen travel month rather than guessing one', () => {
    const request = build({ ...details, travelMonth: '' } as LeadDetails);

    expect(request).toMatchObject({ travelMonth: undefined });
    expectServerAccepts(request);
  });

  it('transmits no budget field — the builder collects none', () => {
    // `TripBuilder`'s "Budget (Per Person)" control is aria-disabled and holds
    // no state; `travelStyle` is the only price-tier signal that exists.
    const request = build(details) as Record<string, unknown>;

    expect(request).not.toHaveProperty('budget');
    expect(request).toHaveProperty('travelStyle', 'Luxury');
  });

  it('copies only the four payload keys, so extra UI state on a stop cannot leak into a lead', () => {
    const request = build({
      ...details,
      stops: [
        {
          slug: 'rishikesh',
          name: 'Rishikesh',
          region: 'Uttarakhand',
          nights: 3,
          // A field a future builder step might add to UI state.
          internalNote: 'do not send',
        } as never,
      ],
    } as LeadDetails);

    expect(request).toMatchObject({
      stops: [{ slug: 'rishikesh', name: 'Rishikesh', region: 'Uttarakhand', nights: 3 }],
    });
    expect(Object.keys((request as { stops: object[] }).stops[0])).toEqual(['slug', 'name', 'region', 'nights']);
  });
});
