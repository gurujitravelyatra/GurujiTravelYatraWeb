/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

import { FakeCrmServer } from '@/server/crm/test-support/fake-crm-server';
import type { CrmTourCard } from '@/server/crm/types';
import { POST } from '../route';

const server = new FakeCrmServer();
const originalApiUrl = process.env.CRM_API_URL;

beforeAll(async () => {
  await server.start();
});

afterAll(async () => {
  await server.stop();
});

beforeEach(() => {
  server.resetState();
  process.env.CRM_API_URL = server.url;
});

afterEach(() => {
  if (originalApiUrl === undefined) delete process.env.CRM_API_URL;
  else process.env.CRM_API_URL = originalApiUrl;
});

function post(body: unknown): NextRequest {
  return new NextRequest('https://gurujitravelyatra.com/api/trip-finder', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function tour(overrides: Partial<CrmTourCard>): CrmTourCard {
  return {
    slug: 'tour',
    name: 'A Tour',
    category: 'Adventure',
    shortDescription: '',
    coverImageUrl: '',
    price: null,
    durationDays: 5,
    durationNights: 4,
    departureCity: null,
    primaryPlace: null,
    nextDeparture: null,
    hasBrochure: false,
    ...overrides,
  };
}

describe('POST /api/trip-finder', () => {
  it('resolves a Custom Trip request straight to Customized Tours', async () => {
    const response = await POST(post({ tab: 'custom', destination: 'Goa', month: 'July', travellers: '2' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ data: { url: '/customize-tours?destination=Goa&month=July&travellers=2', isFallbackToCustom: false } });
  });

  it('resolves a real match end to end, through the real CRM client (fake server)', async () => {
    server.setState({ tours: [tour({ slug: 'char-dham', name: 'Char Dham Yatra', category: 'Group' })] });

    const response = await POST(post({ tab: 'group', destination: 'Char Dham', month: '', travellers: '2' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.url).toBe('/tour-packages/char-dham');
  });

  it('rejects an unknown tab with a 400, not a 500', async () => {
    const response = await POST(post({ tab: 'not-a-real-tab', destination: '', month: '', travellers: '' }));
    expect(response.status).toBe(400);
  });

  it('rejects malformed JSON with a 400, not a crash', async () => {
    const response = await POST(post('{not json'));
    expect(response.status).toBe(400);
  });

  it('defaults missing optional fields rather than rejecting the request', async () => {
    const response = await POST(post({ tab: 'custom' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ data: { url: '/customize-tours', isFallbackToCustom: false } });
  });
});
