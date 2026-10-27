/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

import { FakeCrmServer, defaultFakeCrmState } from '@/server/crm/test-support/fake-crm-server';

import { POST } from '../route';

/**
 * CRM-migration Step 6 — the end-to-end counterpart to `leads-route.test.ts`
 * (which mocks `submitEnquiry` to test the ROUTE's own logic in isolation).
 * This file mocks NOTHING: a real `POST /api/leads` request runs through
 * the real `buildCrmEnquiryRequest` mapper and the real `submitEnquiry()`,
 * which makes a REAL HTTP call — to `FakeCrmServer`, an ephemeral local
 * server, never a real CRM. This is the test that actually proves the
 * whole enquiry pipeline wired up correctly end to end, which mocking
 * `submitEnquiry` (as the other file does, on purpose, for a different
 * reason) cannot prove by itself.
 *
 * `fillContactDetails`-shaped safety note for whoever reads this file
 * looking for a precedent: there is still no path anywhere in this test
 * file, this project's Jest config, or CI that could resolve `CRM_API_URL`
 * to a real CRM address — it is hardcoded to the fake server's own
 * `127.0.0.1` URL for the whole file and restored in `afterEach`.
 */

const server = new FakeCrmServer();
const originalApiUrl = process.env.CRM_API_URL;
const originalApiKey = process.env.WEBSITE_API_KEY;

beforeAll(async () => {
  await server.start();
});

afterAll(async () => {
  await server.stop();
});

beforeEach(() => {
  server.resetState();
  process.env.CRM_API_URL = server.url;
  process.env.WEBSITE_API_KEY = defaultFakeCrmState().websiteApiKey;
  jest.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  if (originalApiUrl === undefined) delete process.env.CRM_API_URL;
  else process.env.CRM_API_URL = originalApiUrl;
  if (originalApiKey === undefined) delete process.env.WEBSITE_API_KEY;
  else process.env.WEBSITE_API_KEY = originalApiKey;
  jest.restoreAllMocks();
});

function post(body: unknown): NextRequest {
  return new NextRequest('https://gurujitravelyatra.com/api/leads', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const commonPayload = {
  name: 'Rahul Sharma',
  mobile: '+91 98765 43210',
  email: 'rahul@example.com',
  sourcePageUrl: 'https://gurujitravelyatra.com/tour-packages/spiti-valley-circuit',
  consent: true,
  turnstileToken: 'fake-token-for-the-fake-server-only',
};

describe('POST /api/leads -> real submitEnquiry() -> a real (fake) CRM, end to end', () => {
  it('an enquiry genuinely reaches the fake CRM over real HTTP and is recorded there', async () => {
    const response = await POST(post({ ...commonPayload, formType: 'enquiry', pageName: 'Spiti Valley Circuit' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.received).toBe(true);

    expect(server.receivedEnquiries).toHaveLength(1);
    expect(server.receivedEnquiries[0]).toMatchObject({ kind: 'ENQUIRY', name: 'Rahul Sharma', phone: '+91 98765 43210' });
  });

  it('a brochure request maps to kind BROCHURE_REQUEST on the fake CRM', async () => {
    await POST(post({ ...commonPayload, formType: 'brochure', packageName: 'Spiti Valley Circuit' }));

    expect(server.receivedEnquiries[0].kind).toBe('BROCHURE_REQUEST');
  });

  it('a custom-trip enquiry carries its place slugs through to the fake CRM', async () => {
    await POST(
      post({
        ...commonPayload,
        formType: 'custom-trip',
        stops: [{ slug: 'manali', name: 'Manali', region: 'Himachal', nights: 3 }],
        travelStyle: 'Premium',
      })
    );

    expect(server.receivedEnquiries[0]).toMatchObject({ kind: 'CUSTOM_TRIP', placeSlugs: ['manali'], travelStyle: 'Premium' });
  });

  it('the real x-website-api-key header reaches the fake CRM', async () => {
    await POST(post({ ...commonPayload, formType: 'enquiry' }));
    expect(server.receivedApiKeys).toEqual([defaultFakeCrmState().websiteApiKey]);
  });

  it('still returns 200 to the visitor when the fake CRM rejects the configured key, logging the failure instead of losing the lead', async () => {
    process.env.WEBSITE_API_KEY = 'a-key-the-fake-crm-does-not-expect';

    const response = await POST(post({ ...commonPayload, formType: 'enquiry' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.received).toBe(true);
    // The route's safety net held — the visitor was told it succeeded on
    // this server's own terms, and the fake CRM genuinely created nothing.
    expect(server.receivedEnquiries).toHaveLength(0);
  });

  it('returns a real 400 (not the usual 200) when the fake CRM genuinely rejects the request — a rejected/expired Turnstile token', async () => {
    // Simulates what a REAL CRM does when Cloudflare rejects the token —
    // this fake server has no real Cloudflare to actually check against,
    // so `rejectEnquiriesAsInvalid` stands in for that outcome. The route
    // treats this one CRM failure differently from every other (its own
    // header explains why: it is the one thing the visitor can fix by
    // retrying), so it must NOT be swallowed into the usual 200.
    server.setState({ rejectEnquiriesAsInvalid: true });

    const response = await POST(post({ ...commonPayload, formType: 'enquiry' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toEqual(expect.any(String));
    expect(server.receivedEnquiries).toHaveLength(0);
  });

  it('still returns 200 when the fake CRM is simply unconfigured (503 NOT_CONFIGURED) — not the visitor\'s problem', async () => {
    server.setState({ websiteApiKey: undefined });

    const response = await POST(post({ ...commonPayload, formType: 'enquiry' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.received).toBe(true);
    expect(server.receivedEnquiries).toHaveLength(0);
  });
});
