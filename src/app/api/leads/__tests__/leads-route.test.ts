/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

/**
 * `POST /api/leads` — tech spec / CLAUDE.md §5, now rebuilt (CRM-migration
 * Step 3) to hand off to the CRM's real `POST /public/enquiries`.
 *
 * Route handlers need the WHATWG `Request`/`Response` globals, so this runs in
 * the `node` environment rather than the project-wide `jsdom` default — same
 * reason as the old content-route suites (now removed with those routes).
 *
 * ## The CRM client IS mocked
 *
 * `@/server/crm/client`'s `submitEnquiry` is the one real network call this
 * route can make, and the whole point of this suite is how the route reacts
 * when that call succeeds, fails, or is rejected by the CRM outright — never
 * an actual `fetch` to a real or fake CRM (that lives in Step 6's
 * `src/server/crm/__tests__/` fake-server suite). `CrmApiError`/
 * `WebsiteApiKeyNotConfiguredError` are kept as the REAL classes
 * (`jest.requireActual`) so this route's own `instanceof` checks are
 * exercised against the real thing, not a mock's shadow of it.
 */
jest.mock('@/server/crm/client', () => ({
  ...jest.requireActual('@/server/crm/client'),
  submitEnquiry: jest.fn(),
}));

import { CrmApiError, submitEnquiry, WebsiteApiKeyNotConfiguredError } from '@/server/crm/client';

import { POST } from '../route';

const mockSubmitEnquiry = submitEnquiry as jest.MockedFunction<typeof submitEnquiry>;

let infoSpy: jest.SpyInstance;

beforeEach(() => {
  mockSubmitEnquiry.mockReset();
  mockSubmitEnquiry.mockResolvedValue({ ok: true });
  // Silenced AND captured: several tests assert on what was logged, because the
  // log is the only record of a lead the CRM never ends up storing.
  infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  infoSpy.mockRestore();
});

function post(body: unknown): NextRequest {
  return new NextRequest('https://gurujitravelyatra.com/api/leads', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

/**
 * The ten fields every form type sends, taken verbatim from what
 * `LeadModal.runSubmit`/`buildLeadRequest` build — `mobile` (not `phone`,
 * which is the CRM's own name for it), `interestedIn` as a display string,
 * the `sourcePageUrl`/`utm` pair read off `window` at submit time, and the
 * three CRM-migration Step 3 security fields every submission now carries.
 */
const commonPayload = {
  name: 'Rahul Sharma',
  mobile: '+91 98765 43210',
  email: 'rahul@example.com',
  interestedIn: 'Spiti Valley Circuit · 9 Nights / 10 Days',
  travelDate: '2026-10-12',
  travellers: 2,
  city: 'Ahmedabad',
  message: 'Prefer a window seat.',
  sourcePageUrl: 'https://gurujitravelyatra.com/tour-packages/spiti-valley-circuit',
  utm: { source: 'google', medium: 'cpc', campaign: 'spiti-oct' },
  consent: true,
  turnstileToken: 'real-turnstile-response-token',
};

/** Every `console.info` line this request produced, joined. */
function loggedText(): string {
  return infoSpy.mock.calls.map((call) => call.join(' ')).join('\n');
}

describe('POST /api/leads — the four reachable form types map to the CRM\'s four `kind`s', () => {
  /**
   * `Contact Page` and `Service Enquiry` are absent on purpose: `/contact-us`
   * and `/our-services` do not exist, so nothing can send them.
   */
  it.each([
    ['enquiry', { formType: 'enquiry', pageName: 'Spiti Valley Circuit' }, 'Enquire Now – Spiti Valley Circuit', 'ENQUIRY'],
    [
      'brochure',
      { formType: 'brochure', packageName: 'Spiti Valley Circuit' },
      'Brochure Download – Spiti Valley Circuit',
      'BROCHURE_REQUEST',
    ],
    [
      'group-tour-reservation',
      { formType: 'group-tour-reservation', batchDate: '2026-05-12', departureName: 'Char Dham Yatra' },
      'Group Tour Reservation – 2026-05-12',
      'RESERVE_SEAT',
    ],
    ['custom-trip', { formType: 'custom-trip' }, 'Custom Trip Request', 'CUSTOM_TRIP'],
  ])('accepts %s, builds the documented source tag, and submits CRM kind %s', async (_label, extra, expectedTag, expectedKind) => {
    const response = await POST(post({ ...commonPayload, ...extra }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.received).toBe(true);
    expect(body.data.source).toBe(expectedTag);
    expect(mockSubmitEnquiry).toHaveBeenCalledTimes(1);
    expect(mockSubmitEnquiry.mock.calls[0][0]).toMatchObject({ kind: expectedKind });
  });

  /**
   * The Navbar's persistent "Enquire Now" calls `openEnquiry()` with no
   * argument, so a contextless enquiry is the single most reachable submission
   * on the site. It must not 400, and it must produce the same fallback tag the
   * client already produces.
   */
  it('accepts an enquiry with no page context, mirroring the client fallback', async () => {
    const response = await POST(post({ ...commonPayload, formType: 'enquiry' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.source).toBe('Enquire Now – General enquiry');
  });
});

describe('POST /api/leads — maps onto CrmEnquiryRequest correctly', () => {
  it('sends name as `name` and mobile as `phone` — the CRM\'s own field name', async () => {
    await POST(post({ ...commonPayload, formType: 'enquiry' }));

    expect(mockSubmitEnquiry.mock.calls[0][0]).toMatchObject({
      name: 'Rahul Sharma',
      phone: '+91 98765 43210',
      email: 'rahul@example.com',
    });
  });

  it('forwards consent and turnstileToken verbatim, and an absent honeypot as undefined', async () => {
    await POST(post({ ...commonPayload, formType: 'enquiry' }));

    expect(mockSubmitEnquiry.mock.calls[0][0]).toMatchObject({
      consent: true,
      turnstileToken: 'real-turnstile-response-token',
      honeypot: undefined,
    });
  });

  it('forwards a filled honeypot too — it is the CRM\'s check to make, not this route\'s', async () => {
    await POST(post({ ...commonPayload, formType: 'enquiry', honeypot: 'a bot filled this' }));

    expect(mockSubmitEnquiry.mock.calls[0][0]).toMatchObject({ honeypot: 'a bot filled this' });
  });

  it('folds page/package/departure context and city into `message` — CrmEnquiryRequest has no field for either', async () => {
    await POST(post({ ...commonPayload, formType: 'enquiry', pageName: 'About Us' }));

    const sent = mockSubmitEnquiry.mock.calls[0][0];
    expect(sent.message).toContain('Page: About Us');
    expect(sent.message).toContain('City: Ahmedabad');
    expect(sent.message).toContain('Prefer a window seat.');
  });

  it('carries tourSlug through for enquiry/brochure/group-tour-reservation when the trigger had one', async () => {
    await POST(
      post({ ...commonPayload, formType: 'brochure', packageName: 'Spiti Valley Circuit', tourSlug: 'spiti-valley-circuit' })
    );

    expect(mockSubmitEnquiry.mock.calls[0][0]).toMatchObject({ tourSlug: 'spiti-valley-circuit' });
  });

  it('maps a group-tour-reservation\'s batchDate straight onto departureDate', async () => {
    await POST(
      post({
        ...commonPayload,
        formType: 'group-tour-reservation',
        batchDate: '2026-05-12',
        departureName: 'Char Dham Yatra',
      })
    );

    expect(mockSubmitEnquiry.mock.calls[0][0]).toMatchObject({ departureDate: '2026-05-12' });
  });

  it('maps a custom-trip\'s stop slugs onto placeSlugs', async () => {
    await POST(
      post({
        ...commonPayload,
        formType: 'custom-trip',
        stops: [
          { slug: 'manali', name: 'Manali', region: 'Himachal', nights: 3 },
          { slug: 'kasol', name: 'Kasol', region: 'Himachal', nights: 2 },
        ],
        travelStyle: 'Premium',
      })
    );

    expect(mockSubmitEnquiry.mock.calls[0][0]).toMatchObject({ placeSlugs: ['manali', 'kasol'], travelStyle: 'Premium' });
  });
});

describe('POST /api/leads — the source tag is built server-side', () => {
  it('ignores a client-supplied source rather than trusting it', async () => {
    const response = await POST(
      post({
        ...commonPayload,
        formType: 'enquiry',
        pageName: 'About Us',
        // A public endpoint must not let a caller pick its own CRM routing key.
        source: 'Enquire Now – TOTALLY DIFFERENT PAGE',
      })
    );
    const body = await response.json();

    expect(body.data.source).toBe('Enquire Now – About Us');
  });

  it('stamps receivedAt from the server clock, not the client', async () => {
    const response = await POST(
      post({ ...commonPayload, formType: 'enquiry', timestamp: '1999-01-01T00:00:00.000Z' })
    );
    const body = await response.json();

    expect(body.data.receivedAt).not.toContain('1999');
    expect(Number.isNaN(Date.parse(body.data.receivedAt))).toBe(false);
  });
});

describe('POST /api/leads — custom trip carries the richer TripBuilder payload', () => {
  /** Field names are real `TripBuilder` state, not the docs' wording. */
  const customTrip = {
    ...commonPayload,
    formType: 'custom-trip',
    stops: [
      { slug: 'manali', name: 'Manali', region: 'Himachal', nights: 3 },
      { slug: 'kasol', name: 'Kasol', region: 'Himachal', nights: 2 },
    ],
    travelStyle: 'Premium',
    travelMonth: 'October',
    adults: 2,
    childrenCount: 1,
    notes: 'One vegetarian, one Jain meal.',
  };

  it('accepts the full trip payload and reaches the CRM hand-off', async () => {
    const response = await POST(post(customTrip));

    expect(response.status).toBe(200);
    expect(mockSubmitEnquiry).toHaveBeenCalledTimes(1);
    expect(mockSubmitEnquiry.mock.calls[0][0].message).toContain('Manali');
  });

  /**
   * `TripBuilder` does not disable "Get My Custom Quote" on an empty trip, so
   * "I want a custom trip but haven't picked anywhere yet" is a real lead.
   */
  it('accepts a custom trip with no stops selected', async () => {
    const response = await POST(post({ ...commonPayload, formType: 'custom-trip' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.source).toBe('Custom Trip Request');
    expect(mockSubmitEnquiry.mock.calls[0][0]).toMatchObject({ placeSlugs: [] });
  });

  it('rejects a stop whose nights fall outside the builder clamp, with a pathed field error', async () => {
    const response = await POST(
      post({
        ...customTrip,
        stops: [{ slug: 'manali', name: 'Manali', region: 'Himachal', nights: 99 }],
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    // Pathed, not flattened to a bare `stops` — the modal needs to know WHICH.
    expect(Object.keys(body.fields)).toContain('stops.0.nights');
  });
});

describe('POST /api/leads — validation failures return field-level 400s', () => {
  it.each([
    ['name', { name: 'R' }],
    ['mobile', { mobile: '123' }],
    ['email', { email: 'not-an-email' }],
    ['sourcePageUrl', { sourcePageUrl: 'not-a-url' }],
    ['consent', { consent: false }],
    ['turnstileToken', { turnstileToken: '' }],
  ])('rejects a bad %s and names the field', async (field, override) => {
    const response = await POST(post({ ...commonPayload, formType: 'enquiry', ...override }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.fields[field]).toBeDefined();
    expect(body.fields[field][0]).toEqual(expect.any(String));
  });

  it('requires a batch date for a group tour reservation', async () => {
    const response = await POST(
      post({ ...commonPayload, formType: 'group-tour-reservation', departureName: 'Char Dham' })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.fields.batchDate).toBeDefined();
  });

  it('does not attempt a CRM hand-off for an invalid submission', async () => {
    await POST(post({ ...commonPayload, formType: 'enquiry', mobile: 'nope' }));
    expect(mockSubmitEnquiry).not.toHaveBeenCalled();
  });
});

describe('POST /api/leads — malformed requests fail cleanly, never crash', () => {
  it('returns 400 for an unknown formType instead of throwing', async () => {
    const response = await POST(post({ ...commonPayload, formType: 'newsletter-signup' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.fields.formType).toBeDefined();
  });

  it('returns 400 for a missing formType', async () => {
    const response = await POST(post(commonPayload));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.fields.formType).toBeDefined();
  });

  it('returns 400 for a body that is not JSON', async () => {
    const response = await POST(post('this is not json{{'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toEqual(expect.any(String));
  });

  it('returns 400 for a JSON body that is not an object', async () => {
    const response = await POST(post('"just a string"'));
    expect(response.status).toBe(400);
  });
});

describe('POST /api/leads — a CRM failure never costs the visitor their submission, with one exception', () => {
  /**
   * The point of most of this route. With nothing persisted of its own, a
   * 500 here would not just be a bad error message — the lead would be gone
   * everywhere except this server's own log.
   */
  it('still returns 200 when the CRM hand-off throws an unexpected error', async () => {
    mockSubmitEnquiry.mockImplementation(() => {
      throw new Error('CRM exploded');
    });

    const response = await POST(post({ ...commonPayload, formType: 'enquiry' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.received).toBe(true);
  });

  it('still returns 200 when the CRM hand-off rejects', async () => {
    mockSubmitEnquiry.mockRejectedValue(new Error('ECONNREFUSED'));

    const response = await POST(post({ ...commonPayload, formType: 'enquiry' }));
    expect(response.status).toBe(200);
  });

  it('still returns 200 when WEBSITE_API_KEY is not configured', async () => {
    mockSubmitEnquiry.mockRejectedValue(new WebsiteApiKeyNotConfiguredError());

    const response = await POST(post({ ...commonPayload, formType: 'enquiry' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.received).toBe(true);
    expect(loggedText()).toContain('delivery-skipped');
  });

  it('still returns 200 for a CRM 503 NOT_CONFIGURED or 429 RATE_LIMITED', async () => {
    mockSubmitEnquiry.mockRejectedValue(new CrmApiError(429, 'RATE_LIMITED', 'Too many enquiries from this number.'));

    const response = await POST(post({ ...commonPayload, formType: 'enquiry' }));
    expect(response.status).toBe(200);
  });

  /**
   * The ONE case where the visitor genuinely can and should retry: their
   * Turnstile token was rejected or had expired. Claiming success here would
   * tell them GTY has their details when the CRM created nothing.
   */
  it('returns 400 (not 200) for a CRM 400 VALIDATION_FAILED — a rejected/expired Turnstile token', async () => {
    mockSubmitEnquiry.mockRejectedValue(new CrmApiError(400, 'VALIDATION_FAILED', 'Turnstile rejected the token.'));

    const response = await POST(post({ ...commonPayload, formType: 'enquiry' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toEqual(expect.any(String));
  });

  it('logs the failure with the full lead still attached, turnstileToken redacted', async () => {
    mockSubmitEnquiry.mockRejectedValue(new Error('ECONNREFUSED'));

    await POST(post({ ...commonPayload, formType: 'enquiry' }));
    const logged = loggedText();

    expect(logged).toContain('delivery-failed');
    expect(logged).toContain('ECONNREFUSED');
    // A failure line with no phone number in it is useless to whoever greps it.
    expect(logged).toContain('+91 98765 43210');
    // The token itself never leaves this request — it has no value to a
    // human reading the log, and it is attacker-supplied, unvalidated text.
    expect(logged).not.toContain('real-turnstile-response-token');
    expect(logged).toContain('[redacted]');
  });

  it('records the lead BEFORE attempting delivery, so a hang cannot lose it', async () => {
    const callOrder: string[] = [];
    infoSpy.mockImplementation((line: string) => {
      // Match the event TOKEN, not the bare word: every line carries a
      // `receivedAt` key, so `includes('received')` also matches the
      // delivery-failed line and the order assertion silently passes twice.
      if (typeof line === 'string' && line.includes('LEAD-SUBMISSION received')) {
        callOrder.push('logged');
      }
    });
    mockSubmitEnquiry.mockImplementation(async () => {
      callOrder.push('crm');
      return { ok: true };
    });

    await POST(post({ ...commonPayload, formType: 'enquiry' }));

    expect(callOrder).toEqual(['logged', 'crm']);
  });

  it('logs `delivered` on a genuine CRM acceptance', async () => {
    await POST(post({ ...commonPayload, formType: 'enquiry' }));
    const logged = loggedText();

    expect(logged).toContain('LEAD-SUBMISSION delivered');
    expect(logged).not.toContain('delivery-skipped');
  });

  /**
   * Guards the log-volume decision in `lead-log.ts`: the visitor's details
   * appear ONCE, in the `received` line. Re-dumping them on every other
   * event would put an identical PII block in the log for every lead
   * forever and make manual recovery harder, not easier.
   */
  it('does not repeat the visitor\'s details across log lines', async () => {
    await POST(post({ ...commonPayload, formType: 'enquiry' }));

    const mobileMentions = loggedText().split('+91 98765 43210').length - 1;
    expect(mobileMentions).toBe(1);
  });
});

describe('POST /api/leads — the log is the only record of a lead the CRM did not end up storing', () => {
  it('logs every submitted field, the source tag and a timestamp', async () => {
    await POST(
      post({
        ...commonPayload,
        formType: 'brochure',
        packageName: 'Spiti Valley Circuit',
      })
    );
    const logged = loggedText();

    // Everything a human would need to follow this lead up by hand.
    expect(logged).toContain('LEAD-SUBMISSION');
    expect(logged).toContain('Rahul Sharma');
    expect(logged).toContain('+91 98765 43210');
    expect(logged).toContain('rahul@example.com');
    expect(logged).toContain('Ahmedabad');
    expect(logged).toContain('Prefer a window seat.');
    expect(logged).toContain('Spiti Valley Circuit · 9 Nights / 10 Days');
    expect(logged).toContain('2026-10-12');
    expect(logged).toContain('Brochure Download – Spiti Valley Circuit');
    expect(logged).toContain('tour-packages/spiti-valley-circuit');
    expect(logged).toContain('google');
    expect(logged).toContain('receivedAt');
  });

  it('builds the CRM request from the same data it logged', async () => {
    const response = await POST(post({ ...commonPayload, formType: 'enquiry', pageName: 'Home' }));
    const body = await response.json();

    expect(body.data.source).toBe('Enquire Now – Home');
    expect(mockSubmitEnquiry.mock.calls[0][0]).toMatchObject({
      name: 'Rahul Sharma',
      phone: '+91 98765 43210',
      travellers: 2,
    });
  });
});

describe('POST /api/leads — deduplication is the CRM\'s job, not this route\'s', () => {
  it('accepts an identical repeat submission as a distinct request', async () => {
    const payload = { ...commonPayload, formType: 'enquiry', pageName: 'Home' };

    const first = await (await POST(post(payload))).json();
    const second = await (await POST(post(payload))).json();

    expect(first.data.received).toBe(true);
    expect(second.data.received).toBe(true);
    expect(first.data.leadId).not.toBe(second.data.leadId);
    expect(mockSubmitEnquiry).toHaveBeenCalledTimes(2);
  });
});
