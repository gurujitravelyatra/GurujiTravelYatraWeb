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

/**
 * A fully-shaped, schema-valid `CrmTourCard` — added 2026-10-27 alongside
 * real response validation (`validateCrmResponse` in `client.ts`). The
 * partial fixtures these tests used before (`{ slug: 'x' }`) tested URL
 * construction, never full-response parsing, and never had to satisfy a
 * schema because none existed; now that one does, every test that stands
 * in for a real success body needs a real body.
 */
const VALID_TOUR_CARD = {
  slug: 'x',
  name: 'Test Tour',
  category: 'Adventure',
  shortDescription: 'A test tour.',
  coverImageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/x.jpg',
  price: { amount: 10000, currency: 'INR' },
  durationDays: 3,
  durationNights: 2,
  departureCity: null,
  primaryPlace: { name: 'Test Place', slug: 'test-place' },
  nextDeparture: null,
  hasBrochure: false,
};

const VALID_TOUR_DETAIL = {
  ...VALID_TOUR_CARD,
  description: 'Full description.',
  highlights: [],
  itinerary: [],
  inclusions: [],
  exclusions: [],
  cancellationPolicy: 'Full refund 30 days out.',
  gallery: [],
  brochureUrl: null,
  places: [],
  pricingOptions: [],
  departures: [],
  seoTitle: 'Test Tour',
  seoDescription: 'A test tour.',
};

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
    mockFetchOnce(200, { tours: [VALID_TOUR_CARD], total: 1, page: 1, pageSize: 12 });
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
    mockFetchOnce(200, { ...VALID_TOUR_DETAIL, slug: 'kashmir-paradise', name: 'Kashmir Paradise' });
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
  /** A valid (schema-passing) empty response per endpoint — each shape is different, so `{}` alone no longer fits any of them now that responses are validated. */
  const EMPTY_VALID_RESPONSES: Record<string, unknown> = {
    '/public/departures': { departures: [], months: [] },
    '/public/places': [],
    '/public/site': {
      images: { HERO_BACKGROUND: [], ABOUT: [], GALLERY: [], FOOTER: [] },
      settings: {
        heroHeadline: null,
        heroSubtext: null,
        happyTravellersLabel: null,
        destinationsLabel: null,
        yearsExperienceLabel: null,
        showFiguresNote: false,
        phone: null,
        whatsappNumber: null,
        email: null,
        instagramUrl: null,
        address: null,
        profileVideoUrl: null,
      },
    },
    '/public/categories': [],
    '/public/sitemap': [],
  };

  it('each call the documented path', async () => {
    const paths: [string, () => Promise<unknown>][] = [
      ['/public/departures', () => getDepartures()],
      ['/public/places', () => getPlaces()],
      ['/public/site', () => getSite()],
      ['/public/categories', () => getCategories()],
      ['/public/sitemap', () => getSitemap()],
    ];

    for (const [path, call] of paths) {
      const fetchMock = mockFetchOnce(200, EMPTY_VALID_RESPONSES[path]);
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
 * Fixes a real production incident (2026-10-27, #1): `next build` on
 * Railway evaluates every statically-renderable page for real, which calls
 * these read functions for real, and Railway's private network (where the
 * default `CRM_API_URL` resolves) does not exist at build time — the build
 * died with `getaddrinfo ENOTFOUND gty-crm.railway.internal` straight out
 * of `fetchCrm()`. `withBuildPhaseFallback()` (client.ts) is the fix for
 * `getTours`/`getDepartures`/`getCategories`/`getSitemap`: during
 * `next build` specifically, a failure returns the read's own empty/
 * "updating" shape instead of throwing; at runtime (a real running
 * server), the exact same failure still propagates, same as always — a
 * real CRM rejection/outage stays a real, loud failure for these, by
 * design (the migration's own "CRM is the single source of truth"
 * decision).
 *
 * `getSite()`/`getPlaces()` are the one deliberate exception —
 * `withFallbackAlways()` — because `SiteShell` calls them from EVERY page.
 * Incident #2, same day: a SCHEMA mismatch there (not a CRM outage — the
 * CRM was healthy, this client's schema was just too strict) made that
 * throw reach `SiteShell` at RUNTIME too, taking the entire site down.
 * These two now fall back on ANY failure, in EITHER phase — see
 * `withFallbackAlways()`'s own comment in client.ts for the full
 * reasoning on why only these two get this treatment.
 */
describe('fallback behaviour — the 2026-10-27 incidents', () => {
  describe('during next build (NEXT_PHASE=phase-production-build), a network failure returns the fallback instead of throwing, for every read', () => {
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

    it('getSite() falls back to the all-null settings shape every consumer already renders gracefully', async () => {
      mockFetchNetworkFailure();
      const result = await getSite();
      expect(result.settings.phone).toBeNull();
      expect(result.settings.heroHeadline).toBeNull();
      expect(result.images.HERO_BACKGROUND).toEqual([]);
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

  describe('AT RUNTIME (NEXT_PHASE unset, a real running server): getSite()/getPlaces() now ALSO fall back instead of throwing — the incident #2 fix, scoped to just these two', () => {
    beforeEach(() => {
      delete process.env.NEXT_PHASE;
    });

    it('getSite() resolves to EMPTY_SITE_RESPONSE instead of rejecting on a network failure — the exact call SiteShell makes on every page', async () => {
      mockFetchNetworkFailure();
      const result = await getSite();
      expect(result).toEqual({
        images: { HERO_BACKGROUND: [], ABOUT: [], GALLERY: [], FOOTER: [] },
        settings: {
          heroHeadline: null,
          heroSubtext: null,
          happyTravellersLabel: null,
          destinationsLabel: null,
          yearsExperienceLabel: null,
          showFiguresNote: false,
          phone: null,
          whatsappNumber: null,
          email: null,
          instagramUrl: null,
          address: null,
          profileVideoUrl: null,
        },
      });
    });

    it('getPlaces() resolves to [] instead of rejecting on a network failure', async () => {
      mockFetchNetworkFailure();
      await expect(getPlaces()).resolves.toEqual([]);
    });

    it('logs the failure with console.error (a real runtime problem), not console.warn', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockFetchNetworkFailure();

      await getSite();

      expect(errorSpy).toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('a malformed, non-JSON response ALSO degrades gracefully instead of throwing — not just a network failure', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('<html>this is not JSON</html>'),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      await expect(getSite()).resolves.toEqual(
        expect.objectContaining({ images: { HERO_BACKGROUND: [], ABOUT: [], GALLERY: [], FOOTER: [] } })
      );
    });
  });

  describe('AT RUNTIME, every OTHER wrapped read still rejects on a real network/API failure — unchanged, deliberately NOT widened to match getSite()/getPlaces()', () => {
    beforeEach(() => {
      delete process.env.NEXT_PHASE;
    });

    it('getTours() still rejects on a network failure (its own lenient array parsing already absorbs SCHEMA issues without reaching this far)', async () => {
      mockFetchNetworkFailure();
      await expect(getTours()).rejects.toThrow(/ENOTFOUND/);
    });

    it('getTours() still rejects a real CrmApiError (e.g. the CRM validating and refusing a bad query param)', async () => {
      mockFetchOnce(400, {
        statusCode: 400,
        error: 'Bad Request',
        message: { code: 'VALIDATION_FAILED', message: 'Unknown category.' },
      });
      await expect(getTours({ category: 'NotARealCategory' as never })).rejects.toMatchObject({ name: 'CrmApiError' });
    });

    it('every other wrapped read still rejects on a network failure too', async () => {
      mockFetchNetworkFailure();
      await expect(getDepartures()).rejects.toThrow();
      mockFetchNetworkFailure();
      await expect(getCategories()).rejects.toThrow();
      mockFetchNetworkFailure();
      await expect(getSitemap()).rejects.toThrow();
    });
  });

  describe('getTourBySlug() and submitEnquiry() are deliberately NOT wrapped, in either phase — a scoped single-page failure and a write must never be silently swallowed', () => {
    it('getTourBySlug() still throws on a network failure even during the build phase', async () => {
      process.env.NEXT_PHASE = 'phase-production-build';
      mockFetchNetworkFailure();

      // Not called during `next build` at all (no generateStaticParams —
      // see client.ts's own comment), so there is nothing to protect here;
      // a real failure should surface exactly as it always has.
      await expect(getTourBySlug('spiti-valley-circuit')).rejects.toThrow(/ENOTFOUND/);
    });

    it('getTourBySlug() still throws on a network failure at runtime too — a single tour page failing stays scoped to that page, not silently swallowed into a fake result', async () => {
      delete process.env.NEXT_PHASE;
      mockFetchNetworkFailure();
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

/**
 * Production incident 2026-10-27 (#2) itself: `GET /public/site` sending
 * `alt: null` on a site image took the entire site down because the old
 * schema required `alt` to be a string and `validateCrmResponse()` threw
 * unconditionally on the mismatch. These tests reproduce the EXACT crash
 * payload plus every other sparse/null shape the real CRM is now confirmed
 * to send, across every endpoint — each must resolve successfully (never
 * reject), per this incident's point 1 (the full nullability audit) and
 * point 4 (tests for the audit, not just the one field from the crash
 * log).
 */
describe('nullability audit — every confirmed sparse/null shape the real CRM sends must parse successfully, not throw', () => {
  it('GET /public/site with alt: null on every single image slot, empty arrays, and all settings null — THE exact incident #2 crash payload', async () => {
    mockFetchOnce(200, {
      images: {
        HERO_BACKGROUND: [{ url: 'https://res.cloudinary.com/demo/image/upload/v1/hero.jpg', alt: null }],
        ABOUT: [{ url: 'https://res.cloudinary.com/demo/image/upload/v1/about.jpg', alt: null }],
        GALLERY: [],
        FOOTER: [{ url: 'https://res.cloudinary.com/demo/image/upload/v1/footer.jpg', alt: null }],
      },
      settings: {
        heroHeadline: null,
        heroSubtext: null,
        happyTravellersLabel: null,
        destinationsLabel: null,
        yearsExperienceLabel: null,
        showFiguresNote: false,
        phone: null,
        whatsappNumber: null,
        email: null,
        instagramUrl: null,
        address: null,
        profileVideoUrl: null,
      },
    });

    const result = await getSite();
    expect(result.images.HERO_BACKGROUND).toEqual([{ url: 'https://res.cloudinary.com/demo/image/upload/v1/hero.jpg', alt: '' }]);
    expect(result.images.ABOUT[0].alt).toBe('');
    expect(result.images.FOOTER[0].alt).toBe('');
    expect(result.images.GALLERY).toEqual([]);
    expect(result.settings.phone).toBeNull();
  });

  it('GET /public/tours with a bare-minimum tour: null primaryPlace, null price, null/missing shortDescription and coverImageUrl', async () => {
    mockFetchOnce(200, {
      tours: [
        {
          slug: 'bare-tour',
          name: 'Bare Tour',
          category: 'Adventure',
          shortDescription: null,
          coverImageUrl: null,
          price: null,
          durationDays: 1,
          durationNights: 0,
          departureCity: null,
          primaryPlace: null,
          nextDeparture: null,
          hasBrochure: false,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 12,
    });

    const result = await getTours();
    expect(result.tours).toHaveLength(1);
    expect(result.tours[0].shortDescription).toBe('');
    expect(result.tours[0].coverImageUrl).toBe('');
    expect(result.tours[0].price).toBeNull();
    expect(result.tours[0].primaryPlace).toBeNull();
  });

  it('GET /public/tours/:slug with every nullable tour-detail field null/missing: description, cancellationPolicy, seoTitle/seoDescription, gallery alt, brochureUrl', async () => {
    mockFetchOnce(200, {
      ...VALID_TOUR_CARD,
      shortDescription: null,
      coverImageUrl: null,
      price: null,
      description: null,
      highlights: null,
      itinerary: null,
      inclusions: null,
      exclusions: null,
      cancellationPolicy: null,
      gallery: [{ url: 'https://res.cloudinary.com/demo/image/upload/v1/g1.jpg', alt: null }],
      brochureUrl: null,
      places: null,
      pricingOptions: null,
      departures: null,
      seoTitle: null,
      seoDescription: null,
    });

    const result = await getTourBySlug('x');
    expect(result.status).toBe('found');
    if (result.status !== 'found') throw new Error('expected found');
    expect(result.tour.description).toBe('');
    expect(result.tour.cancellationPolicy).toBe('');
    expect(result.tour.gallery[0].alt).toBe('');
    expect(result.tour.brochureUrl).toBeNull();
    // Defaults to the tour's own name/shortDescription per incident #2 point 3.
    expect(result.tour.seoTitle).toBe(result.tour.name);
    expect(result.tour.seoDescription).toBe(result.tour.shortDescription);
    expect(result.tour.highlights).toEqual([]);
    expect(result.tour.places).toEqual([]);
  });

  it('GET /public/places with null region, null imageUrl, null description, and the liveTours/liveTourCount drift, all at once', async () => {
    mockFetchOnce(200, [
      {
        name: 'Kedarnath',
        slug: 'kedarnath',
        region: null,
        description: null,
        imageUrl: null,
        showInCustomBuilder: true,
        liveTours: 3,
      },
    ]);

    const result = await getPlaces();
    expect(result).toEqual([
      {
        name: 'Kedarnath',
        slug: 'kedarnath',
        region: '',
        description: '',
        imageUrl: '',
        showInCustomBuilder: true,
        liveTourCount: 3,
      },
    ]);
  });

  it('GET /public/departures with null returnDate/price on a departure and an entirely missing months array', async () => {
    mockFetchOnce(200, {
      departures: [
        {
          ...VALID_TOUR_CARD,
          departureDate: '2026-12-01',
        },
      ],
      months: null,
    });

    const result = await getDepartures();
    expect(result.departures).toHaveLength(1);
    expect(result.months).toEqual([]);
  });

  it('a single malformed tour in an otherwise-valid list is DROPPED, not fatal to the other tours — the lenient-array-parsing half of the structural fix', async () => {
    mockFetchOnce(200, {
      tours: [VALID_TOUR_CARD, { slug: 'broken', name: 'Broken Tour', category: 'NotARealCategory' }],
      total: 2,
      page: 1,
      pageSize: 12,
    });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await getTours();

    expect(result.tours).toHaveLength(1);
    expect(result.tours[0].slug).toBe(VALID_TOUR_CARD.slug);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('dropped 1 of 2'));
    errorSpy.mockRestore();
  });

  it('a deliberately malformed/unexpected GET /public/site response (completely wrong shape) degrades to EMPTY_SITE_RESPONSE instead of throwing', async () => {
    mockFetchOnce(200, { thisIsNotWhatWeExpectedAtAll: 42 });

    const result = await getSite();
    expect(result).toEqual({
      images: { HERO_BACKGROUND: [], ABOUT: [], GALLERY: [], FOOTER: [] },
      settings: {
        heroHeadline: null,
        heroSubtext: null,
        happyTravellersLabel: null,
        destinationsLabel: null,
        yearsExperienceLabel: null,
        showFiguresNote: false,
        phone: null,
        whatsappNumber: null,
        email: null,
        instagramUrl: null,
        address: null,
        profileVideoUrl: null,
      },
    });
  });

  it('GET /public/site with a malformed settings object still returns the parsed images, falling back only the settings half', async () => {
    mockFetchOnce(200, {
      images: {
        HERO_BACKGROUND: [{ url: 'https://res.cloudinary.com/demo/image/upload/v1/hero.jpg', alt: 'Hero' }],
        ABOUT: [],
        GALLERY: [],
        FOOTER: [],
      },
      settings: { phone: 12345 }, // wrong type entirely, and missing required fields
    });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await getSite();

    expect(result.images.HERO_BACKGROUND).toEqual([{ url: 'https://res.cloudinary.com/demo/image/upload/v1/hero.jpg', alt: 'Hero' }]);
    expect(result.settings.phone).toBeNull(); // fell back to the default settings
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('settings'));
    errorSpy.mockRestore();
  });
});
