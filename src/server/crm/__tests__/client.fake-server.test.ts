/**
 * @jest-environment node
 */
import { createServer } from 'node:http';

import {
  CrmUnexpectedResponseError,
  getCategories,
  getDepartures,
  getPlaces,
  getSite,
  getSitemap,
  getTourBySlug,
  getTours,
  submitEnquiry,
} from '../client';
import { FakeCrmServer, defaultFakeCrmState } from '../test-support/fake-crm-server';
import type { CrmPlace, CrmSiteResponse, CrmTourCard, CrmTourDetail } from '../types';

/**
 * CRM-migration Step 6 — the real-HTTP-round-trip counterpart to
 * `client.test.ts`'s mocked-fetch unit tests. Every request below leaves
 * the Node process, goes over a real TCP socket on `127.0.0.1`, and comes
 * back through this client's own `fetchCrm()` — nothing here stubs
 * `fetch`. See `fake-crm-server.ts`'s own header for why this is safe (an
 * ephemeral local port, never a real CRM address) and what it does not
 * prove (Turnstile verification, which only a real CRM against real
 * Cloudflare can do).
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
});

afterEach(() => {
  if (originalApiUrl === undefined) delete process.env.CRM_API_URL;
  else process.env.CRM_API_URL = originalApiUrl;
  if (originalApiKey === undefined) delete process.env.WEBSITE_API_KEY;
  else process.env.WEBSITE_API_KEY = originalApiKey;
});

const sampleTour: CrmTourCard = {
  slug: 'spiti-valley-circuit',
  name: 'Spiti Valley Circuit',
  category: 'Adventure',
  shortDescription: 'A high-altitude loop through the Spiti valley.',
  coverImageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/spiti.jpg',
  price: { amount: 42500, currency: 'INR' },
  durationDays: 6,
  durationNights: 5,
  departureCity: null,
  primaryPlace: { name: 'Spiti Valley', slug: 'spiti-valley' },
  nextDeparture: { date: '2026-09-15', seatsLeft: 4 },
  hasBrochure: true,
};

describe('CRM client against a real fake server — reads', () => {
  it('getTours() round-trips a real HTTP request and parses the real response body', async () => {
    server.setState({ tours: [sampleTour] });

    const result = await getTours();

    expect(result.total).toBe(1);
    expect(result.tours[0]).toMatchObject({ slug: 'spiti-valley-circuit', name: 'Spiti Valley Circuit' });
  });

  it('getTours({category}) is actually filtered server-side, not just a query param the server ignores', async () => {
    const other: CrmTourCard = { ...sampleTour, slug: 'kerala-backwaters', name: 'Kerala Backwaters', category: 'Family' };
    server.setState({ tours: [sampleTour, other] });

    const adventureOnly = await getTours({ category: 'Adventure' });
    expect(adventureOnly.tours.map((tour) => tour.slug)).toEqual(['spiti-valley-circuit']);

    const familyOnly = await getTours({ category: 'Family' });
    expect(familyOnly.tours.map((tour) => tour.slug)).toEqual(['kerala-backwaters']);
  });

  it('getTourBySlug() resolves {status:"found"} for a real tour over real HTTP', async () => {
    const detail: CrmTourDetail = {
      ...sampleTour,
      description: 'Full description.',
      highlights: ['Highlight one'],
      itinerary: [{ day: 1, title: 'Arrival', detail: 'Reach Shimla.' }],
      inclusions: ['Breakfast'],
      exclusions: ['Flights'],
      cancellationPolicy: 'Full refund 30 days out.',
      gallery: [{ url: 'https://res.cloudinary.com/demo/image/upload/v1/g1.jpg', alt: 'Valley view' }],
      brochureUrl: 'https://res.cloudinary.com/demo/raw/upload/v1/brochure.pdf',
      places: [{ name: 'Spiti Valley', slug: 'spiti-valley' }],
      pricingOptions: [],
      departures: [],
      seoTitle: 'Spiti Valley Circuit',
      seoDescription: 'A high-altitude loop.',
    };
    server.setState({ tourDetails: { 'spiti-valley-circuit': detail } });

    const result = await getTourBySlug('spiti-valley-circuit');

    expect(result).toEqual({ status: 'found', tour: expect.objectContaining({ slug: 'spiti-valley-circuit' }) });
  });

  it('getTourBySlug() resolves {status:"redirect"} for a retired-but-tracked slug', async () => {
    server.setState({ tourDetails: { 'old-slug': { redirectTo: 'spiti-valley-circuit' } } });

    const result = await getTourBySlug('old-slug');

    expect(result).toEqual({ status: 'redirect', redirectTo: 'spiti-valley-circuit' });
  });

  it('getTourBySlug() resolves {status:"not-found"} for a real 404, without throwing', async () => {
    const result = await getTourBySlug('genuinely-does-not-exist');
    expect(result).toEqual({ status: 'not-found' });
  });

  it('getPlaces() round-trips a real array response', async () => {
    const places: CrmPlace[] = [
      {
        name: 'Spiti Valley',
        slug: 'spiti-valley',
        region: 'Himachal Pradesh',
        description: 'A high-altitude desert valley.',
        imageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/spiti-place.jpg',
        showInCustomBuilder: true,
        liveTourCount: 1,
      },
    ];
    server.setState({ places });

    const result = await getPlaces();
    expect(result).toEqual(places);
  });

  it('getSite() round-trips the settings/images envelope', async () => {
    const site: CrmSiteResponse = {
      ...defaultFakeCrmState().site,
      settings: { ...defaultFakeCrmState().site.settings, phone: '+91 90999 57658', heroHeadline: 'Explore more.' },
    };
    server.setState({ site });

    const result = await getSite();
    expect(result.settings.phone).toBe('+91 90999 57658');
    expect(result.settings.heroHeadline).toBe('Explore more.');
  });

  it('getDepartures()/getCategories()/getSitemap() all round-trip without throwing', async () => {
    server.setState({
      departures: { departures: [{ ...sampleTour, departureDate: '2026-09-15' }], months: ['2026-09'] },
      categories: [{ category: 'Adventure', count: 1 }],
      sitemap: [{ type: 'tour', slug: 'spiti-valley-circuit', updatedAt: '2026-10-01T00:00:00.000Z' }],
    });

    const [departures, categories, sitemap] = await Promise.all([getDepartures(), getCategories(), getSitemap()]);

    expect(departures.months).toEqual(['2026-09']);
    expect(categories).toEqual([{ category: 'Adventure', count: 1 }]);
    expect(sitemap).toEqual([{ type: 'tour', slug: 'spiti-valley-circuit', updatedAt: '2026-10-01T00:00:00.000Z' }]);
  });

  it('a 500 with an unrecognised body throws CrmUnexpectedResponseError, not a silent empty result', async () => {
    server.setState({ forceUnrecognisedErrorBody: true });
    await expect(getTours()).rejects.toBeInstanceOf(CrmUnexpectedResponseError);
  });
});

describe('CRM client against a real fake server — the one write, submitEnquiry()', () => {
  const payload = {
    kind: 'ENQUIRY' as const,
    name: 'Asha Patel',
    phone: '9876543210',
    consent: true as const,
    turnstileToken: 'fake-turnstile-token-for-the-fake-server-only',
  };

  it('a real enquiry reaches the fake server over real HTTP and is recorded there, never anywhere real', async () => {
    const result = await submitEnquiry(payload);

    expect(result).toEqual({ ok: true });
    expect(server.receivedEnquiries).toHaveLength(1);
    expect(server.receivedEnquiries[0]).toMatchObject({ name: 'Asha Patel', phone: '9876543210' });
  });

  it('sends the real x-website-api-key header over the real request', async () => {
    await submitEnquiry(payload);
    expect(server.receivedApiKeys).toEqual([defaultFakeCrmState().websiteApiKey]);
  });

  it('a wrong key is rejected by the fake server with a real 401, parsed into a real CrmApiError', async () => {
    process.env.WEBSITE_API_KEY = 'the-wrong-key';

    await expect(submitEnquiry(payload)).rejects.toMatchObject({ name: 'CrmApiError', statusCode: 401, code: 'API_KEY_INVALID' });
    // The fake server never created anything for a rejected key.
    expect(server.receivedEnquiries).toHaveLength(0);
  });

  it('the fake server itself being "unconfigured" (websiteApiKey unset server-side) answers a real 503', async () => {
    server.setState({ websiteApiKey: undefined });

    await expect(submitEnquiry(payload)).rejects.toMatchObject({ name: 'CrmApiError', statusCode: 503, code: 'NOT_CONFIGURED' });
  });

  it('a filled honeypot still gets {ok:true} from the fake server — same as the real contract\'s "identical response either way"', async () => {
    const result = await submitEnquiry({ ...payload, honeypot: 'a bot filled this' });

    expect(result).toEqual({ ok: true });
    // Recorded for inspection (so THIS test can prove the behaviour), but a
    // real CRM's own equivalent is explicit that nothing is created for it.
    expect(server.receivedEnquiries).toHaveLength(1);
    expect(server.receivedEnquiries[0].honeypot).toBe('a bot filled this');
  });

  it('never reaches any address this test did not itself configure', () => {
    // The strongest safety assertion this file can make: CRM_API_URL
    // literally cannot resolve to a real CRM during this entire describe
    // block, because it was overwritten to the fake server's own
    // 127.0.0.1 address in `beforeEach` and restored only in `afterEach`.
    expect(process.env.CRM_API_URL).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/api$/);
    expect(process.env.CRM_API_URL).not.toMatch(/gurujitravelyatra\.com|railway\.internal/);
  });
});

/**
 * Fixes a real production incident (2026-10-27): the Railway-internal CRM
 * address does not resolve/connect during `next build`. These tests prove
 * the fix against a GENUINELY UNREACHABLE real address — a TCP port on
 * `127.0.0.1` that this file itself opened and then closed, so a real
 * connection attempt fails fast with a real `ECONNREFUSED`, no DNS timeout
 * and no mock standing in for what a real failure looks like.
 */
describe('build-phase fallback against a genuinely unreachable address', () => {
  const originalNextPhase = process.env.NEXT_PHASE;
  let unreachableUrl: string;

  beforeAll(async () => {
    // Bind to an OS-assigned port, read it, then close — the port is now
    // guaranteed closed (nothing else can have grabbed it in the same
    // process in the few milliseconds between), so connecting to it fails
    // immediately with ECONNREFUSED rather than hanging or timing out.
    const probe = createServer();
    await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve));
    const address = probe.address();
    const port = address && typeof address !== 'string' ? address.port : 0;
    await new Promise<void>((resolve) => probe.close(() => resolve()));
    unreachableUrl = `http://127.0.0.1:${port}/api`;
  });

  afterEach(() => {
    if (originalNextPhase === undefined) delete process.env.NEXT_PHASE;
    else process.env.NEXT_PHASE = originalNextPhase;
  });

  it('during next build, a genuinely unreachable CRM_API_URL resolves to the empty fallback, not a thrown error', async () => {
    process.env.NEXT_PHASE = 'phase-production-build';
    process.env.CRM_API_URL = unreachableUrl;

    await expect(getTours()).resolves.toEqual({ tours: [], total: 0, page: 1, pageSize: 12 });
    await expect(getPlaces()).resolves.toEqual([]);
    await expect(getSite()).resolves.toMatchObject({ settings: { phone: null } });
  });

  it('at runtime (no NEXT_PHASE), the identical unreachable address still rejects — this is what lets Next\'s own stale-while-revalidate ISR handling take over, which this fix must not bypass', async () => {
    delete process.env.NEXT_PHASE;
    process.env.CRM_API_URL = unreachableUrl;

    await expect(getTours()).rejects.toThrow();
  });
});
