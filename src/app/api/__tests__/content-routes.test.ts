/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

import { allTours } from '@/content/fixtures/packages.fixture';

/**
 * Pins the composition root to the FIXTURE adapter for this suite.
 *
 * Necessary because `next/jest` loads `.env`, so `DATABASE_URL` IS set under
 * Jest — without this mock these tests would silently run against the live
 * remote Postgres. That would make a unit suite depend on the network (the
 * managed proxy drops connections with an intermittent `P1001`), make it slow,
 * and make its assertions depend on whatever rows happen to be in a shared
 * database.
 *
 * This pins the TRANSPORT ONLY; it does not mock the behaviour under test.
 * `FixtureContentAdapter` serves `publiclyListedTours`/`publiclyListedRails`,
 * i.e. the real `isPubliclyListable()` gate applied to the real catalogue — so
 * the withheld-tour assertions below still exercise the genuine gate rather than
 * a test author's idea of it. The database path through the same predicate is
 * covered separately in `prisma-content-adapter.test.ts`.
 */
jest.mock('@/content/content-adapter', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { FixtureContentAdapter } = require('@/content/adapters/fixture-content-adapter');
  return { contentAdapter: new FixtureContentAdapter(), brochureAdapter: null };
});

import { GET as getTours } from '../tours/route';
import { GET as getTourBySlug } from '../tours/[slug]/route';
import { GET as getGroupTours } from '../group-tours/route';
import { GET as getDestinations } from '../destinations/route';
import { GET as getBrochure } from '../brochures/[slug]/route';

/**
 * Route handlers need the WHATWG `Request`/`Response` globals, so these run in
 * the `node` environment rather than the project-wide `jsdom` default.
 *
 * ## These tests deliberately do NOT mock the content adapter
 *
 * `DATABASE_URL` is unset under Jest, so the composition root resolves to
 * `FixtureContentAdapter` and every route runs against the real fixtures through
 * the real `isPubliclyListable()` gate. That is the point rather than a
 * shortcut: the defect these tests exist to catch is a safety flag that stops
 * propagating at a new surface, and a mocked adapter is exactly the thing that
 * would hide it — a hand-written mock returns whatever the test author believed
 * the gate does, so the test would pass even if the route bypassed the gate
 * entirely. Driving the genuine gate means the withheld-tour assertion below is
 * evidence about the shipped code path.
 *
 * (`prisma-content-adapter.test.ts` covers the database path separately, with a
 * mock client that deliberately returns a flagged row in spite of the `where`
 * clause, to prove the predicate rather than the SQL is the gate.)
 */

/** Tours the catalogue withholds — read from the fixture so this cannot drift. */
const withheldTours = allTours.filter((tour) => tour.pricingUnverified === true);

async function bodyOf(response: Response): Promise<{ data?: unknown; error?: string; fields?: unknown }> {
  return (await response.json()) as { data?: unknown; error?: string; fields?: unknown };
}

function toursRequest(query = ''): NextRequest {
  return new NextRequest(`http://localhost/api/tours${query}`);
}

function slugContext(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

describe('GET /api/tours', () => {
  it('returns the publicly listable catalogue under a `data` key', async () => {
    const response = await getTours(toursRequest());
    expect(response.status).toBe(200);

    const body = await bodyOf(response);
    expect(Array.isArray(body.data)).toBe(true);
    expect((body.data as unknown[]).length).toBeGreaterThan(0);
  });

  it('never returns a tour the catalogue withholds', async () => {
    const response = await getTours(toursRequest());
    const tours = (await bodyOf(response)).data as Array<{ slug: string }>;

    const returned = new Set(tours.map((tour) => tour.slug));
    for (const withheld of withheldTours) {
      expect(returned.has(withheld.slug)).toBe(false);
    }
  });

  it('publishes an opaque `photoKey`, never a `photoUrl` that is not a URL', async () => {
    const response = await getTours(toursRequest());
    const [tour] = (await bodyOf(response)).data as Array<Record<string, unknown>>;

    expect(tour).toHaveProperty('photoKey');
    expect(tour).not.toHaveProperty('photoUrl');
  });

  it('filters by category using the same param name as /tour-packages', async () => {
    const all = (await bodyOf(await getTours(toursRequest()))).data as Array<{ category: string }>;
    const category = all[0].category;

    const response = await getTours(toursRequest(`?category=${encodeURIComponent(category)}`));
    expect(response.status).toBe(200);

    const filtered = (await bodyOf(response)).data as Array<{ category: string }>;
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((tour) => tour.category === category)).toBe(true);
  });

  it('filters by destination slug', async () => {
    const all = (await bodyOf(await getTours(toursRequest()))).data as Array<{ destinationSlug: string }>;
    const destination = all[0].destinationSlug;

    const response = await getTours(toursRequest(`?destination=${encodeURIComponent(destination)}`));
    const filtered = (await bodyOf(response)).data as Array<{ destinationSlug: string }>;

    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((tour) => tour.destinationSlug === destination)).toBe(true);
  });

  /**
   * The page falls back to "All" for a bad value so a visitor never sees an
   * empty catalogue; an API says so instead, because silently returning
   * everything to a caller who asked for a subset is a wrong answer that looks
   * like a right one.
   */
  it('rejects an unknown category with 400 and lists the valid values', async () => {
    const response = await getTours(toursRequest('?category=Honeymoon'));
    expect(response.status).toBe(400);

    const body = await bodyOf(response);
    expect(body.error).toContain('Honeymoon');
    expect(Array.isArray((body.fields as Record<string, unknown>).category)).toBe(true);
  });

  it('rejects an unknown destination with 400', async () => {
    const response = await getTours(toursRequest('?destination=atlantis'));
    expect(response.status).toBe(400);
  });
});

describe('GET /api/tours/[slug]', () => {
  it('returns a single tour for a publicly listable slug', async () => {
    const all = (await bodyOf(await getTours(toursRequest()))).data as Array<{ slug: string }>;
    const slug = all[0].slug;

    const response = await getTourBySlug(new Request(`http://localhost/api/tours/${slug}`), slugContext(slug));
    expect(response.status).toBe(200);

    const tour = (await bodyOf(response)).data as { slug: string };
    expect(tour.slug).toBe(slug);
  });

  /**
   * THE REGRESSION THIS ROUTE EXISTS TO NOT CAUSE.
   *
   * `memory/feedback_qg_unenforced-safety-flag.md` records four occurrences of a
   * safety flag that failed to reach a newly built surface — most recently
   * `/group-tours` republishing a price `/tour-packages` withholds. A brand-new
   * public JSON endpoint addressable by slug is the textbook fifth opportunity.
   *
   * Asserted on the RESPONSE, never on the flag's presence: a test that checks
   * `tour.pricingUnverified === true` passes whether or not anything acts on it.
   */
  it('404s for a withheld tour, and leaks nothing about it', async () => {
    expect(withheldTours.length).toBeGreaterThan(0);

    for (const withheld of withheldTours) {
      const response = await getTourBySlug(
        new Request(`http://localhost/api/tours/${withheld.slug}`),
        slugContext(withheld.slug)
      );

      expect(response.status).toBe(404);

      const serialised = JSON.stringify(await bodyOf(response));
      // No price, no savings label, no confirmation the record exists.
      expect(serialised).not.toContain(withheld.priceFrom);
      if (withheld.savingsLabel) expect(serialised).not.toContain(withheld.savingsLabel);
      expect(serialised).not.toContain(withheld.name);
    }
  });

  it('404s for a nonexistent slug, indistinguishably from a withheld one', async () => {
    const missing = await getTourBySlug(
      new Request('http://localhost/api/tours/not-a-real-tour'),
      slugContext('not-a-real-tour')
    );
    expect(missing.status).toBe(404);

    const withheld = await getTourBySlug(
      new Request(`http://localhost/api/tours/${withheldTours[0].slug}`),
      slugContext(withheldTours[0].slug)
    );

    // Same status and same body shape — a caller cannot tell the two apart and
    // therefore cannot enumerate which tours carry unconfirmed pricing.
    expect(Object.keys(await bodyOf(withheld))).toEqual(Object.keys(await bodyOf(missing)));
  });

  it('returns JSON, not an HTML 404 page', async () => {
    const response = await getTourBySlug(
      new Request('http://localhost/api/tours/nope'),
      slugContext('nope')
    );
    expect(response.headers.get('content-type')).toContain('application/json');
    expect((await bodyOf(response)).error).toBeDefined();
  });
});

describe('GET /api/group-tours', () => {
  it('returns the departures list', async () => {
    const response = await getGroupTours();
    expect(response.status).toBe(200);

    const departures = (await bodyOf(response)).data as unknown[];
    expect(departures.length).toBeGreaterThan(0);
  });

  /**
   * Departures are MARKED rather than withheld (BLOCKERS.md item 9), so the
   * honesty burden sits on the payload: a consumer must be able to render the
   * same asterisk/footnote the site renders. A response that dropped these flags
   * would publish an unconfirmed price with no way to know it is unconfirmed.
   */
  it('publishes the unverified-price and unverified-duration flags as booleans', async () => {
    const response = await getGroupTours();
    const departures = (await bodyOf(response)).data as Array<Record<string, unknown>>;

    for (const departure of departures) {
      expect(typeof departure.priceUnverified).toBe('boolean');
      expect(typeof departure.durationUnverified).toBe('boolean');
    }

    // At least one really is flagged today — otherwise this test would pass
    // vacuously against a payload that hardcoded `false`.
    expect(departures.some((departure) => departure.priceUnverified === true)).toBe(true);
    expect(departures.some((departure) => departure.durationUnverified === true)).toBe(true);
  });
});

describe('GET /api/destinations', () => {
  it('returns destinations with explicit nulls for unsourced fields', async () => {
    const response = await getDestinations();
    expect(response.status).toBe(200);

    const destinations = (await bodyOf(response)).data as Array<Record<string, unknown>>;
    expect(destinations.length).toBeGreaterThan(0);

    for (const destination of destinations) {
      // Present-and-null, never an absent key — the shape stays uniform.
      expect(destination).toHaveProperty('region');
      expect(destination).toHaveProperty('tagline');
      expect(destination).toHaveProperty('photoKey');
    }
  });
});

describe('GET /api/brochures/[slug]', () => {
  /**
   * On the fixture path there is no brochure store at all — brochures are
   * database-only and deliberately have no fixture (inventing one would mean
   * inventing brochure data). The route must report that as 503 rather than
   * claim the tour has no brochure (404): a deployment fact and a content fact
   * are different claims, and conflating them would let a consumer cache an
   * outage as a permanent absence.
   */
  it('reports 503 when no content database is configured, not 404', async () => {
    const response = await getBrochure(
      new Request('http://localhost/api/brochures/spiti-valley-circuit'),
      slugContext('spiti-valley-circuit')
    );

    expect(response.status).toBe(503);
    expect((await bodyOf(response)).error).toContain('not available');
  });
});
