/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

/**
 * `POST /api/leads` — tech spec / CLAUDE.md §5, BLOCKERS.md §6.
 *
 * Route handlers need the WHATWG `Request`/`Response` globals, so this runs in
 * the `node` environment rather than the project-wide `jsdom` default — same
 * reason as `content-routes.test.ts`.
 *
 * ## No database fixture is pinned here, unlike the content route suites
 *
 * Those suites mock `@/content/content-adapter` because `next/jest` loads `.env`
 * and they would otherwise hit the live remote Postgres. This route touches no
 * adapter and no database at all — there is no lead table to read or write
 * (`prisma/schema.prisma`: "It holds NO LEADS") — so there is nothing to pin and
 * no network to accidentally reach.
 *
 * ## The CRM client IS mocked
 *
 * Not to avoid a network call — the real stub makes none — but because the
 * behaviour under test is how the route reacts to a CRM that fails, and the
 * stub cannot fail. Mocking is the only way to exercise the path that matters
 * most: a downstream fault must never cost the visitor their submission.
 */
jest.mock('@/server/crm-client', () => ({
  submitLeadToCrm: jest.fn(),
}));

import { submitLeadToCrm } from '@/server/crm-client';

import { POST } from '../route';

const mockSubmitLeadToCrm = submitLeadToCrm as jest.MockedFunction<typeof submitLeadToCrm>;

/** The honest outcome the real stub returns — no fabricated `delivered`. */
const LOGGED_ONLY = { status: 'logged-only' as const, reason: 'CRM_NOT_CONFIGURED' };

let infoSpy: jest.SpyInstance;

beforeEach(() => {
  mockSubmitLeadToCrm.mockReset();
  mockSubmitLeadToCrm.mockResolvedValue(LOGGED_ONLY);
  // Silenced AND captured: several tests assert on what was logged, because the
  // log is the only record a lead leaves.
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
 * The seven fields every form type sends, taken verbatim from what
 * `LeadModal.runSubmit` builds — `mobile` (not `phone`), `interestedIn` as a
 * display string, and the `sourcePageUrl`/`utm` pair it reads off `window` at
 * submit time.
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
};

/** Every `console.info` line this request produced, joined. */
function loggedText(): string {
  return infoSpy.mock.calls.map((call) => call.join(' ')).join('\n');
}

describe('POST /api/leads — the four reachable form types', () => {
  /**
   * `Contact Page` and `Service Enquiry` are absent on purpose: `/contact-us`
   * and `/our-services` do not exist, so nothing can send them.
   */
  it.each([
    [
      'enquiry',
      { formType: 'enquiry', pageName: 'Spiti Valley Circuit' },
      'Enquire Now – Spiti Valley Circuit',
    ],
    [
      'brochure',
      { formType: 'brochure', packageName: 'Spiti Valley Circuit' },
      'Brochure Download – Spiti Valley Circuit',
    ],
    [
      'group-tour-reservation',
      {
        formType: 'group-tour-reservation',
        batchDate: '12 — 18 May 2026',
        departureName: 'Char Dham Yatra',
      },
      'Group Tour Reservation – 12 — 18 May 2026',
    ],
    ['custom-trip', { formType: 'custom-trip' }, 'Custom Trip Request'],
  ])('accepts %s and builds the documented source tag', async (_label, extra, expectedTag) => {
    const response = await POST(post({ ...commonPayload, ...extra }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.received).toBe(true);
    expect(body.data.source).toBe(expectedTag);
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
    expect(mockSubmitLeadToCrm.mock.calls[0][0].source).toBe('Enquire Now – About Us');
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

  it('passes every trip field through to the CRM hand-off', async () => {
    const response = await POST(post(customTrip));

    expect(response.status).toBe(200);
    const submission = mockSubmitLeadToCrm.mock.calls[0][0].submission;
    expect(submission).toMatchObject({
      formType: 'custom-trip',
      travelStyle: 'Premium',
      travelMonth: 'October',
      adults: 2,
      childrenCount: 1,
      notes: 'One vegetarian, one Jain meal.',
      stops: customTrip.stops,
    });
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
    expect(mockSubmitLeadToCrm.mock.calls[0][0].submission).toMatchObject({ stops: [] });
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
    expect(mockSubmitLeadToCrm).not.toHaveBeenCalled();
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

describe('POST /api/leads — a CRM failure never costs the visitor their submission', () => {
  /**
   * The point of the whole route. With nothing persisted, a 500 here would not
   * just be a bad error message — the lead would be gone.
   */
  it('still returns 200 when the CRM hand-off throws', async () => {
    mockSubmitLeadToCrm.mockImplementation(() => {
      throw new Error('CRM exploded');
    });

    const response = await POST(post({ ...commonPayload, formType: 'enquiry' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.received).toBe(true);
  });

  it('still returns 200 when the CRM hand-off rejects', async () => {
    mockSubmitLeadToCrm.mockRejectedValue(new Error('ECONNREFUSED'));

    const response = await POST(post({ ...commonPayload, formType: 'enquiry' }));
    expect(response.status).toBe(200);
  });

  it('logs the failure with the full lead still attached', async () => {
    mockSubmitLeadToCrm.mockRejectedValue(new Error('ECONNREFUSED'));

    await POST(post({ ...commonPayload, formType: 'enquiry' }));
    const logged = loggedText();

    expect(logged).toContain('delivery-failed');
    expect(logged).toContain('ECONNREFUSED');
    // A failure line with no phone number in it is useless to whoever greps it.
    expect(logged).toContain('+91 98765 43210');
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
    mockSubmitLeadToCrm.mockImplementation(async () => {
      callOrder.push('crm');
      return LOGGED_ONLY;
    });

    await POST(post({ ...commonPayload, formType: 'enquiry' }));

    expect(callOrder).toEqual(['logged', 'crm']);
  });

  it('treats the stub\'s logged-only outcome as a non-delivery, not a success', async () => {
    await POST(post({ ...commonPayload, formType: 'enquiry' }));
    const logged = loggedText();

    // Nothing may claim the CRM stored anything — it never has.
    expect(logged).toContain('delivery-skipped');
    expect(logged).not.toContain('LEAD-SUBMISSION delivered');
  });

  /**
   * Guards the log-volume decision in `lead-log.ts`: on the steady-state path
   * the visitor's details appear ONCE, in the `received` line. Re-dumping them
   * per non-delivery would put an identical PII block in the log for every
   * lead forever and make manual recovery harder, not easier.
   */
  it('does not repeat the visitor\'s details on the expected non-delivery path', async () => {
    await POST(post({ ...commonPayload, formType: 'enquiry' }));

    const mobileMentions = loggedText().split('+91 98765 43210').length - 1;
    expect(mobileMentions).toBe(1);
  });
});

describe('POST /api/leads — the log is the only record, so it must be complete', () => {
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

  it('hands the CRM the same record it logged', async () => {
    const response = await POST(post({ ...commonPayload, formType: 'enquiry', pageName: 'Home' }));
    const body = await response.json();
    const record = mockSubmitLeadToCrm.mock.calls[0][0];

    expect(record.leadId).toBe(body.data.leadId);
    expect(record.source).toBe('Enquire Now – Home');
    expect(record.submission).toMatchObject({
      name: 'Rahul Sharma',
      mobile: '+91 98765 43210',
      interestedIn: 'Spiti Valley Circuit · 9 Nights / 10 Days',
      travellers: 2,
      city: 'Ahmedabad',
    });
  });
});

describe('POST /api/leads — deduplication is the CRM\'s job, not this route\'s', () => {
  it('accepts an identical repeat submission as a distinct lead', async () => {
    const payload = { ...commonPayload, formType: 'enquiry', pageName: 'Home' };

    const first = await (await POST(post(payload))).json();
    const second = await (await POST(post(payload))).json();

    expect(first.data.received).toBe(true);
    expect(second.data.received).toBe(true);
    expect(first.data.leadId).not.toBe(second.data.leadId);
    expect(mockSubmitLeadToCrm).toHaveBeenCalledTimes(2);
  });
});
