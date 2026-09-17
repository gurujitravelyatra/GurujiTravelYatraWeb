/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

import type { ContentPort } from '@/content/ports';
import type { Package, PackageRail } from '@/content/types';
import { isPubliclyListable } from '@/content/public-listing';

/**
 * THE draft/published leak suite — the most important test in Phase B.
 *
 * ## Why this file exists and why it is shaped like this
 *
 * `memory/feedback_qg_unenforced-safety-flag.md` records FIVE occasions in this
 * project where unsafe data was flagged, documented, and then rendered exactly
 * like safe data because nothing consumed the flag. Its central lesson is
 * variant 4: a gate written against one surface silently fails to cover a
 * sibling surface built later. `Tour.status` is the sixth and most expensive
 * opportunity for that bug — an unenforced `status` publishes unfinished content
 * rather than merely quoting a doubtful price.
 *
 * So this suite is deliberately NOT a happy-path test. It builds a catalogue
 * containing a draft tour and an archived tour, and then walks EVERY public path
 * a tour can reach a visitor through, asserting the same two slugs are absent
 * from each:
 *
 *   1. `GET /api/tours`                  — the list API
 *   2. `GET /api/tours/[slug]`           — the detail API (must 404)
 *   3. Home's Popular Destinations rail  — `getPopularDestinations()`
 *   4. `/tour-packages` catalogue        — `getPackageRails()`
 *   5. `generateStaticParams()`          — the SSG path list
 *
 * ## The adapter under test applies the REAL gate
 *
 * `StubContentAdapter` below filters through the genuine `isPubliclyListable()`
 * — the same call `FixtureContentAdapter` and `PrismaContentAdapter` make — over
 * a RAW catalogue that contains the draft. It does not reimplement the rule.
 *
 * That combination is what makes a passing run meaningful in both directions:
 *
 *   - if the GATE stopped excluding drafts, every assertion here fails;
 *   - if a SURFACE stopped going through the port — a page that grew its own
 *     `prisma.tour.findMany()`, say — it would not see this stub at all, and the
 *     draft would either appear or the surface would blow up.
 *
 * The complementary case (the SQL `where` drifting away from the predicate) is
 * covered in `prisma-content-adapter.test.ts`, where the mock client ignores the
 * `where` clause and returns a draft row anyway.
 */

const PUBLISHED_TOUR: Package = {
  slug: 'spiti-valley-circuit',
  name: 'Spiti Valley Circuit',
  destinationSlug: 'spiti-valley',
  destinationName: 'Spiti Valley',
  category: 'Adventure',
  durationLabel: '9 Days 8 Nights',
  subtitle: 'Shimla - Kaza - Chandratal',
  photoUrl: 'Spiti Valley',
  photosCount: 14,
  priceFrom: '₹42,500',
  status: 'PUBLISHED',
};

/**
 * A tour someone is halfway through writing. Note it is otherwise COMPLETE — a
 * real price, a real name, a real category — so nothing but `status` can be
 * what excludes it. A draft missing half its fields would let a test pass for
 * the wrong reason.
 */
const DRAFT_TOUR: Package = {
  ...PUBLISHED_TOUR,
  slug: 'secret-unreleased-tour',
  name: 'Secret Unreleased Tour',
  priceFrom: '₹99,000',
  status: 'DRAFT',
};

/**
 * Archived, and still marked PUBLISHED — the realistic archived row, because
 * archiving deliberately does not touch `status` (a restored tour must return to
 * the state it was pulled from). A gate that only checked `status` would let
 * this one straight through, so it is tested on every surface alongside the
 * draft.
 */
const ARCHIVED_TOUR: Package = {
  ...PUBLISHED_TOUR,
  slug: 'retired-last-season-tour',
  name: 'Retired Last Season Tour',
  status: 'PUBLISHED',
  archivedAt: '2026-09-01T00:00:00.000Z',
};

/** The raw catalogue, gate NOT applied — what the storage layer holds. */
const RAW_CATALOGUE: Package[] = [PUBLISHED_TOUR, DRAFT_TOUR, ARCHIVED_TOUR];

/** The slugs that must never reach a visitor. */
const HIDDEN_SLUGS = [DRAFT_TOUR.slug, ARCHIVED_TOUR.slug];

const RAW_RAILS: PackageRail[] = [{ title: 'Trending Tour Packages', items: RAW_CATALOGUE }];

/**
 * A `ContentPort` over `RAW_CATALOGUE` that gates through the real predicate —
 * structurally identical to `FixtureContentAdapter`, which is the point.
 */
class StubContentAdapter implements ContentPort {
  getAllTours() {
    return Promise.resolve(RAW_CATALOGUE.filter(isPubliclyListable));
  }
  getPopularDestinations() {
    return Promise.resolve(RAW_CATALOGUE.filter(isPubliclyListable));
  }
  getPackageRails() {
    return Promise.resolve(
      RAW_RAILS.map((rail) => ({ ...rail, items: rail.items.filter(isPubliclyListable) }))
    );
  }
  getInternationalDestinations() {
    return Promise.resolve([]);
  }
  getGroupDepartures() {
    return Promise.resolve([]);
  }
  getFeaturedVideos() {
    return Promise.resolve([]);
  }
  getStats() {
    return Promise.resolve([]);
  }
  getTestimonials() {
    return Promise.resolve([]);
  }
  getTripPlaceOptions() {
    return Promise.resolve([]);
  }
  getAboutMilestones() {
    return Promise.resolve([]);
  }
}

/**
 * Pins the composition root to the stub above.
 *
 * Necessary because `next/jest` loads `.env`, so `DATABASE_URL` IS set under
 * Jest — without this the suite would run against the live remote Postgres (see
 * the same note in `content-routes.test.ts`). It pins the TRANSPORT only: the
 * stub still routes every query through the real `isPubliclyListable()`.
 *
 * The `mock` name prefix is what lets a hoisted `jest.mock` factory close over
 * it; the factory is lazy, so by the time a test dynamically imports a route,
 * this module's body has run and the binding is initialised.
 */
const mockContentAdapter = new StubContentAdapter();

jest.mock('@/content/content-adapter', () => ({
  get contentAdapter() {
    return mockContentAdapter;
  },
  brochureAdapter: null,
}));

describe('a DRAFT tour is invisible to every public surface', () => {
  it('sanity: the raw catalogue really does contain the hidden tours', () => {
    // Guards against the suite silently passing because the fixtures changed and
    // there is no longer a draft to hide — a test that asserts an absence must
    // first prove the thing could have been present.
    expect(RAW_CATALOGUE.map((tour) => tour.slug)).toEqual(
      expect.arrayContaining(HIDDEN_SLUGS)
    );
    expect(RAW_CATALOGUE).toHaveLength(3);
  });

  it('the gate itself withholds drafts and archived tours', () => {
    expect(isPubliclyListable(PUBLISHED_TOUR)).toBe(true);
    expect(isPubliclyListable(DRAFT_TOUR)).toBe(false);
    expect(isPubliclyListable(ARCHIVED_TOUR)).toBe(false);
  });

  it('withholds a tour that is BOTH published and archived (archive must win)', () => {
    // The dangerous combination, spelled out: archiving does not clear `status`,
    // so a gate that stopped at `status === 'PUBLISHED'` would publish every
    // retired tour.
    expect(ARCHIVED_TOUR.status).toBe('PUBLISHED');
    expect(isPubliclyListable(ARCHIVED_TOUR)).toBe(false);
  });

  it('still withholds a draft that would otherwise pass every other check', () => {
    // No unconfirmed price, nothing else wrong with it — `status` is doing all
    // the work, which is what makes this evidence about `status`.
    expect(DRAFT_TOUR.pricingUnverified).toBeUndefined();
    expect(DRAFT_TOUR.archivedAt).toBeUndefined();
    expect(isPubliclyListable(DRAFT_TOUR)).toBe(false);
  });
});

describe('every public read path excludes drafts and archived tours', () => {
  const adapter = mockContentAdapter;

  it('1. the tours list API returns neither', async () => {
    const { GET } = await import('@/app/api/tours/route');
    const response = await GET(new NextRequest('http://localhost/api/tours'));
    const body = (await response.json()) as { data: { slug: string }[] };

    expect(response.status).toBe(200);
    const slugs = body.data.map((tour) => tour.slug);
    expect(slugs).toEqual([PUBLISHED_TOUR.slug]);
    for (const hidden of HIDDEN_SLUGS) expect(slugs).not.toContain(hidden);
  });

  it('1b. the list API response body does not mention them ANYWHERE', async () => {
    // Not just "absent from the array" — absent from the serialised bytes. A
    // draft leaking through some future sibling field (a "related tours" list,
    // a facet count) would still be a leak.
    const { GET } = await import('@/app/api/tours/route');
    const response = await GET(new NextRequest('http://localhost/api/tours'));
    const raw = JSON.stringify(await response.json());

    expect(raw).not.toContain(DRAFT_TOUR.slug);
    expect(raw).not.toContain(DRAFT_TOUR.name);
    expect(raw).not.toContain('₹99,000');
    expect(raw).not.toContain(ARCHIVED_TOUR.slug);
  });

  it('2. the tour detail API 404s for a draft and for an archived tour', async () => {
    const { GET } = await import('@/app/api/tours/[slug]/route');

    for (const slug of HIDDEN_SLUGS) {
      const response = await GET(new Request(`http://localhost/api/tours/${slug}`), {
        params: Promise.resolve({ slug }),
      });
      expect(response.status).toBe(404);

      // Withheld and nonexistent must be INDISTINGUISHABLE, or a caller can
      // enumerate which tours exist but are unpublished — the same reasoning the
      // route already applies to `pricingUnverified`.
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe(`No tour found for slug '${slug}'.`);
    }
  });

  it('2b. the detail API still resolves a published tour (the test can fail)', async () => {
    const { GET } = await import('@/app/api/tours/[slug]/route');
    const response = await GET(new Request(`http://localhost/api/tours/${PUBLISHED_TOUR.slug}`), {
      params: Promise.resolve({ slug: PUBLISHED_TOUR.slug }),
    });
    expect(response.status).toBe(200);
  });

  it('3. Home’s Popular Destinations rail contains neither', async () => {
    const popular = await adapter.getPopularDestinations();
    const slugs = popular.map((tour) => tour.slug);
    expect(slugs).toEqual([PUBLISHED_TOUR.slug]);
    for (const hidden of HIDDEN_SLUGS) expect(slugs).not.toContain(hidden);
  });

  it('4. the /tour-packages catalogue rails contain neither, and the rail survives', async () => {
    const rails = await adapter.getPackageRails();

    expect(rails).toHaveLength(1);
    const slugs = rails.flatMap((rail) => rail.items.map((item) => item.slug));
    expect(slugs).toEqual([PUBLISHED_TOUR.slug]);
    for (const hidden of HIDDEN_SLUGS) expect(slugs).not.toContain(hidden);
  });

  it('5. generateStaticParams() emits no path for either', async () => {
    // The SSG surface, and the easiest one to forget: a draft in this list
    // becomes a prerendered HTML file on disk, served from the CDN, reachable
    // long after the tour is unpublished.
    const { generateStaticParams } = await import('@/app/tour-packages/[slug]/page');
    const params = await generateStaticParams();

    const slugs = params.map((param) => param.slug);
    expect(slugs).toEqual([PUBLISHED_TOUR.slug]);
    for (const hidden of HIDDEN_SLUGS) expect(slugs).not.toContain(hidden);
  });

  it('6. getAllPackages()/getPackageBySlug() — the shared resolver behind pages', async () => {
    const { getAllPackages, getPackageBySlug } = await import('@/content/get-all-packages');

    expect((await getAllPackages()).map((tour) => tour.slug)).toEqual([PUBLISHED_TOUR.slug]);

    // `getPackageBySlug` returning undefined is what makes the PAGE call
    // `notFound()`, so this is the page's 404 asserted at its real cause.
    for (const slug of HIDDEN_SLUGS) {
      await expect(getPackageBySlug(slug)).resolves.toBeUndefined();
    }
    await expect(getPackageBySlug(PUBLISHED_TOUR.slug)).resolves.toBeDefined();
  });
});
