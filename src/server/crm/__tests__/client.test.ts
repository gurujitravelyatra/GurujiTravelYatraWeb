/**
 * @jest-environment node
 */
import {
  CrmApiError,
  CrmUnexpectedResponseError,
  WebsiteApiKeyNotConfiguredError,
  getCategories,
  getDepartures,
  getPlaces,
  getSite,
  getSitemap,
  getTourBySlug,
  getTours,
  submitEnquiry,
} from '../client';

/**
 * Unit-level tests for the CRM client itself: request construction, error
 * parsing, and the three-way `getTourBySlug` result. These mock `fetch`
 * directly rather than running a server, which is the right tool for
 * "does this function build the URL/headers/body I expect" — the fuller
 * fake-CRM-server tests (exercising adapters and pages through this client)
 * live separately, per the migration's Step 6.
 */

const originalFetch = global.fetch;
const originalApiUrl = process.env.CRM_API_URL;
const originalApiKey = process.env.WEBSITE_API_KEY;
const originalNextPhase = process.env.NEXT_PHASE;

function mockFetchOnce(status: number, body: unknown) {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

/** Simulates exactly what broke production: `fetch()` itself rejecting (DNS/connection failure), never reaching an HTTP response at all. */
function mockFetchNetworkFailure(message = 'getaddrinfo ENOTFOUND gty-crm.railway.internal') {
  const fetchMock = jest.fn().mockRejectedValue(new TypeError(`fetch failed: ${message}`));
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

afterEach(() => {
  global.fetch = originalFetch;
  if (originalApiUrl === undefined) delete process.env.CRM_API_URL;
  else process.env.CRM_API_URL = originalApiUrl;
  if (originalApiKey === undefined) delete process.env.WEBSITE_API_KEY;
  else process.env.WEBSITE_API_KEY = originalApiKey;
  if (originalNextPhase === undefined) delete process.env.NEXT_PHASE;
  else process.env.NEXT_PHASE = originalNextPhase;
});

describe('getTours', () => {
  it('builds the request against CRM_API_URL with the right path and query', async () => {
    process.env.CRM_API_URL = 'http://fake-crm.test/api';
    const fetchMock = mockFetchOnce(200, { tours: [], total: 0, page: 1, pageSize: 12 });

    await getTours({ category: 'Adventure', page: 2 });

    const [calledUrl] = fetchMock.mock.calls[0] as [string];
    expect(calledUrl).toBe('http://fake-crm.test/api/public/tours?category=Adventure&page=2');
  });

  it('omits undefined query params rather than sending `category=undefined`', async () => {
    const fetchMock = mockFetchOnce(200, { tours: [], total: 0, page: 1, pageSize: 12 });
    await getTours({});

    const [calledUrl] = fetchMock.mock.calls[0] as [string];
    expect(calledUrl).not.toContain('undefined');
  });

  it('parses a successful response', async () => {
    mockFetchOnce(200, { tours: [{ slug: 'x' }], total: 1, page: 1, pageSize: 12 });
    const result = await getTours();
    expect(result.total).toBe(1);
  });

  it('throws CrmApiError with the CRM-documented fields on a validation failure', async () => {
    mockFetchOnce(400, {
      statusCode: 400,
      error: 'Bad Request',
      message: { code: 'VALIDATION_FAILED', message: 'Unknown category.' },
    });

    await expect(getTours({ category: 'NotARealCategory' as never })).rejects.toMatchObject({
      name: 'CrmApiError',
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: 'Unknown category.',
    });
  });

  it('throws CrmUnexpectedResponseError for a non-JSON or unrecognised error body', async () => {
    mockFetchOnce(500, { somethingElse: true });
    await expect(getTours()).rejects.toBeInstanceOf(CrmUnexpectedResponseError);
  });
});

describe('getTourBySlug', () => {
  it('resolves {status: "found"} for a real tour', async () => {
    mockFetchOnce(200, { slug: 'kashmir-paradise', name: 'Kashmir Paradise' });
    const result = await getTourBySlug('kashmir-paradise');
    expect(result).toEqual({ status: 'found', tour: expect.objectContaining({ slug: 'kashmir-paradise' }) });
  });

  it('resolves {status: "redirect"} for a retired slug the CRM still tracks', async () => {
    mockFetchOnce(200, { redirectTo: 'kashmir-paradise-2026' });
    const result = await getTourBySlug('kashmir-paradise');
    expect(result).toEqual({ status: 'redirect', redirectTo: 'kashmir-paradise-2026' });
  });

  it('resolves {status: "not-found"} for a real 404, without throwing', async () => {
    mockFetchOnce(404, {
      statusCode: 404,
      error: 'Not Found',
      message: { code: 'NOT_FOUND', message: 'No such tour.' },
    });
    const result = await getTourBySlug('does-not-exist');
    expect(result).toEqual({ status: 'not-found' });
  });

  it('still throws for a non-404 error (e.g. a 500)', async () => {
    mockFetchOnce(500, {
      statusCode: 500,
      error: 'Internal Server Error',
      message: { code: 'INTERNAL', message: 'oops' },
    });
    await expect(getTourBySlug('whatever')).rejects.toBeInstanceOf(CrmApiError);
  });
});

describe('getDepartures / getPlaces / getSite / getCategories / getSitemap', () => {
  it('each call the documented path', async () => {
    const paths: [string, () => Promise<unknown>][] = [
      ['/public/departures', () => getDepartures()],
      ['/public/places', () => getPlaces()],
      ['/public/site', () => getSite()],
      ['/public/categories', () => getCategories()],
      ['/public/sitemap', () => getSitemap()],
    ];

    for (const [path, call] of paths) {
      const fetchMock = mockFetchOnce(200, {});
      await call();
      const [calledUrl] = fetchMock.mock.calls[0] as [string];
      expect(calledUrl).toContain(path);
    }
  });
});

describe('submitEnquiry', () => {
  const payload = {
    kind: 'ENQUIRY' as const,
    name: 'Jane Doe',
    phone: '9822041188',
    consent: true as const,
    turnstileToken: 'fake-token',
  };

  it('refuses to call out when WEBSITE_API_KEY is unset — never a silent empty header', async () => {
    delete process.env.WEBSITE_API_KEY;
    const fetchMock = mockFetchOnce(200, { ok: true });

    await expect(submitEnquiry(payload)).rejects.toBeInstanceOf(WebsiteApiKeyNotConfiguredError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the API key header and the body, once configured', async () => {
    process.env.WEBSITE_API_KEY = 'test-key';
    const fetchMock = mockFetchOnce(200, { ok: true });

    const result = await submitEnquiry(payload);

    expect(result).toEqual({ ok: true });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['x-website-api-key']).toBe('test-key');
    expect(JSON.parse(init.body as string)).toMatchObject({ kind: 'ENQUIRY', name: 'Jane Doe' });
  });

  it('never logs or echoes the API key in a thrown error', async () => {
    process.env.WEBSITE_API_KEY = 'super-secret-key';
    mockFetchOnce(401, {
      statusCode: 401,
      error: 'Unauthorized',
      message: { code: 'API_KEY_INVALID', message: 'Invalid key.' },
    });

    try {
      await submitEnquiry(payload);
      throw new Error('expected submitEnquiry to throw');
    } catch (error) {
      expect(String(error)).not.toContain('super-secret-key');
    }
  });
});

/**
 * Fixes a real production incident (2026-10-27): `next build` on Railway
 * evaluates every statically-renderable page for real, which calls these
 * read functions for real, and Railway's private network (where the
 * default `CRM_API_URL` resolves) does not exist at build time — the build
 * died with `getaddrinfo ENOTFOUND gty-crm.railway.internal` straight out
 * of `fetchCrm()`. `withBuildPhaseFallback()` (client.ts) is the fix:
 * during `next build` specifically (`NEXT_PHASE === 'phase-production-build'`),
 * a `fetch()` failure returns the read's own empty/"updating" shape instead
 * of throwing; at every other time (unset `NEXT_PHASE`, i.e. a real running
 * server), the exact same failure still propagates exactly as it always
 * has, so a real runtime outage still gets Next's own stale-while-
 * revalidate handling rather than silently serving an empty page forever.
 */
describe('build-phase fallback — the 2026-10-27 production-build fix', () => {
  describe('during next build (NEXT_PHASE=phase-production-build), a network failure returns the empty fallback instead of throwing', () => {
    beforeEach(() => {
      process.env.NEXT_PHASE = 'phase-production-build';
    });

    it('getTours() falls back to an empty, correctly-shaped page rather than throwing', async () => {
      mockFetchNetworkFailure();
      await expect(getTours({ page: 2, pageSize: 24 })).resolves.toEqual({
        tours: [],
        total: 0,
        page: 2,
        pageSize: 24,
      });
    });

    it('getDepartures() falls back to {departures: [], months: []}', async () => {
      mockFetchNetworkFailure();
      await expect(getDepartures()).resolves.toEqual({ departures: [], months: [] });
    });

    it('getPlaces() falls back to []', async () => {
      mockFetchNetworkFailure();
      await expect(getPlaces()).resolves.toEqual([]);
    });

    it('getSite() falls back to the all-null settings shape every consumer already renders gracefully', async () => {
      mockFetchNetworkFailure();
      const result = await getSite();
      expect(result.settings.phone).toBeNull();
      expect(result.settings.heroHeadline).toBeNull();
      expect(result.images.HERO_BACKGROUND).toEqual([]);
    });

    it('getCategories() falls back to []', async () => {
      mockFetchNetworkFailure();
      await expect(getCategories()).resolves.toEqual([]);
    });

    it('getSitemap() falls back to []', async () => {
      mockFetchNetworkFailure();
      await expect(getSitemap()).resolves.toEqual([]);
    });

    it('logs the failure with console.warn (expected/tolerated), not console.error (a bug)', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockFetchNetworkFailure();

      await getTours();

      expect(warnSpy).toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

  describe('outside the build phase, the identical failure still propagates — runtime behaviour is unchanged', () => {
    it('getTours() still rejects when NEXT_PHASE is unset (a real running server)', async () => {
      delete process.env.NEXT_PHASE;
      mockFetchNetworkFailure();
      await expect(getTours()).rejects.toThrow(/ENOTFOUND/);
    });

    it('getSite() still rejects when NEXT_PHASE is some other phase value', async () => {
      process.env.NEXT_PHASE = 'phase-production-server';
      mockFetchNetworkFailure();
      await expect(getSite()).rejects.toThrow(/ENOTFOUND/);
    });

    it('every other wrapped read still rejects outside the build phase too', async () => {
      delete process.env.NEXT_PHASE;

      mockFetchNetworkFailure();
      await expect(getDepartures()).rejects.toThrow();
      mockFetchNetworkFailure();
      await expect(getPlaces()).rejects.toThrow();
      mockFetchNetworkFailure();
      await expect(getCategories()).rejects.toThrow();
      mockFetchNetworkFailure();
      await expect(getSitemap()).rejects.toThrow();
    });
  });

  describe('getTourBySlug() and submitEnquiry() are deliberately NOT wrapped, in either phase', () => {
    it('getTourBySlug() still throws on a network failure even during the build phase', async () => {
      process.env.NEXT_PHASE = 'phase-production-build';
      mockFetchNetworkFailure();

      // Not called during `next build` at all (no generateStaticParams —
      // see client.ts's own comment), so there is nothing to protect here;
      // a real failure should surface exactly as it always has.
      await expect(getTourBySlug('spiti-valley-circuit')).rejects.toThrow(/ENOTFOUND/);
    });

    it('submitEnquiry() still throws on a network failure even during the build phase — a lead must never be silently dropped', async () => {
      process.env.NEXT_PHASE = 'phase-production-build';
      process.env.WEBSITE_API_KEY = 'test-key';
      mockFetchNetworkFailure();

      await expect(
        submitEnquiry({ kind: 'ENQUIRY', name: 'Jane Doe', phone: '9822041188', consent: true, turnstileToken: 'fake-token' })
      ).rejects.toThrow(/ENOTFOUND/);
    });
  });
});
