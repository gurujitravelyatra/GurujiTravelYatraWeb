import { LEAD_API_PATH, submitLeadRequest } from '../lead-api-client';
import { GTY_PHONE_DISPLAY } from '@/lib/gty-contact';
import type { LeadSubmissionInput } from '@/server/leads/lead-schema';

/**
 * `submitLeadRequest` is the only thing standing between a filled-in form and a
 * lost lead, so what is asserted here is mostly about FAILURE: that no outcome
 * can throw, and that none of them can be mistaken for a success.
 */

const request: LeadSubmissionInput = {
  formType: 'enquiry',
  name: 'Asha Patel',
  mobile: '9876543210',
  sourcePageUrl: 'https://gurujitravelyatra.com/',
  pageName: 'Home',
};

const fetchMock = jest.fn();

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('submitLeadRequest — the request itself', () => {
  it('POSTs JSON to /api/leads with the payload verbatim', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { data: { received: true, leadId: 'lead-1' } }));

    await submitLeadRequest(request);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(LEAD_API_PATH);
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body)).toEqual(request);
  });
});

describe('submitLeadRequest — success', () => {
  it('reports success only when the envelope actually confirms receipt', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { data: { received: true, leadId: 'lead-42', source: 'Enquire Now – Home' } }));

    await expect(submitLeadRequest(request)).resolves.toEqual({ status: 'success', leadId: 'lead-42' });
  });

  /**
   * A 200 whose body this code cannot read must NOT become a confirmation.
   * Telling a visitor "GTY has your details" off an unparsed body is the one
   * failure mode worse than showing them an error.
   */
  it.each([
    ['an empty body', {}],
    ['a bare array', []],
    ['data without `received`', { data: { leadId: 'lead-1' } }],
    ['`received: false`', { data: { received: false, leadId: 'lead-1' } }],
    ['`received` with no leadId', { data: { received: true } }],
  ])('treats a 200 with %s as an error, never a fake success', async (_label, body) => {
    fetchMock.mockResolvedValue(jsonResponse(200, body));

    const result = await submitLeadRequest(request);

    expect(result.status).toBe('error');
    expect(result.status === 'error' && result.message).toContain(GTY_PHONE_DISPLAY);
  });

  it('treats a 200 whose body is not JSON at all as an error', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON');
      },
    } as unknown as Response);

    await expect(submitLeadRequest(request)).resolves.toMatchObject({ status: 'error' });
  });
});

describe('submitLeadRequest — validation failures (400)', () => {
  it('surfaces the route\'s message and its per-field detail', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, {
        error: 'Some details need fixing before we can send this.',
        fields: { mobile: ['Please enter a valid mobile number.'], name: ['Please enter your full name.'] },
      })
    );

    await expect(submitLeadRequest(request)).resolves.toEqual({
      status: 'error',
      message: 'Some details need fixing before we can send this.',
      fields: {
        mobile: ['Please enter a valid mobile number.'],
        name: ['Please enter your full name.'],
      },
    });
  });

  it('keeps nested field paths intact so `stops.0.nights` and `utm.source` can be reported', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, { error: 'Some details need fixing.', fields: { 'stops.0.nights': ['Too many nights.'] } })
    );

    const result = await submitLeadRequest(request);

    expect(result.status === 'error' && result.fields).toEqual({ 'stops.0.nights': ['Too many nights.'] });
  });

  /**
   * These go straight into `form.setError()`, where a non-string would be
   * handed to React as a message to render.
   */
  it('discards malformed `fields` entries rather than passing non-strings to the form', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, {
        error: 'Some details need fixing.',
        fields: { name: ['Please enter your full name.'], mobile: [42, null], city: 'not-an-array', email: [] },
      })
    );

    const result = await submitLeadRequest(request);

    expect(result.status === 'error' && result.fields).toEqual({ name: ['Please enter your full name.'] });
  });

  it('a 400 with no `fields` still yields a renderable message', async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { error: 'Expected a JSON request body.' }));

    await expect(submitLeadRequest(request)).resolves.toEqual({
      status: 'error',
      message: 'Expected a JSON request body.',
      fields: undefined,
    });
  });
});

describe('submitLeadRequest — transport and server failures', () => {
  it('never rejects when fetch itself throws (offline, DNS, aborted)', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await submitLeadRequest(request);

    expect(result.status).toBe('error');
    // Actionable, not a stack trace: retry first, phone number as the way through.
    expect(result.status === 'error' && result.message).toContain(GTY_PHONE_DISPLAY);
  });

  it('reports a 500 without leaking whatever the server said internally', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(500, { error: 'Something went wrong while loading this content. Please try again.' })
    );

    const result = await submitLeadRequest(request);

    expect(result.status).toBe('error');
    expect(result.status === 'error' && result.message).toBe(
      'Something went wrong while loading this content. Please try again.'
    );
  });

  it('falls back to its own copy when a non-2xx carries no usable message', async () => {
    fetchMock.mockResolvedValue(jsonResponse(503, { error: '   ' }));

    const result = await submitLeadRequest(request);

    expect(result.status === 'error' && result.message).toContain(GTY_PHONE_DISPLAY);
  });
});
