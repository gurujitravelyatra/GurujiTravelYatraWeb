import { FixtureContentAdapter, contentAdapter } from '../fixture-content-adapter';

describe('FixtureContentAdapter', () => {
  const adapter = new FixtureContentAdapter();

  it('getPackageRails() resolves 4 rails of publicly-listable items', async () => {
    const rails = await adapter.getPackageRails();
    expect(rails).toHaveLength(4);
    for (const rail of rails) {
      expect(typeof rail.title).toBe('string');
      expect(rail.title.length).toBeGreaterThan(0);
      for (const item of rail.items) {
        expect(item.pricingUnverified).not.toBe(true);
      }
    }

    // The Trending rail held all 3 withheld tours, so it keeps 2 of 5; the
    // other three rails are untouched.
    expect(rails.map((rail) => rail.items.length)).toEqual([2, 5, 5, 5]);
  });

  it('getAllTours() resolves every publicly-listable tour exactly once (19 = 22 records - 3 withheld)', async () => {
    const tours = await adapter.getAllTours();
    expect(tours).toHaveLength(19);

    const slugs = tours.map((tour) => tour.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('getAllTours() is a superset of both the rails and the popular selection', async () => {
    const [tours, rails, popular] = await Promise.all([
      adapter.getAllTours(),
      adapter.getPackageRails(),
      adapter.getPopularDestinations(),
    ]);
    const slugs = new Set(tours.map((tour) => tour.slug));

    for (const item of [...popular, ...rails.flatMap((rail) => rail.items)]) {
      expect(slugs.has(item.slug)).toBe(true);
    }
  });

  it('getPopularDestinations() resolves the publicly-listable selection in Package shape', async () => {
    const popular = await adapter.getPopularDestinations();
    // 3 of the export's 5 popular tours are pricingUnverified and withheld.
    expect(popular).toHaveLength(2);
    for (const item of popular) {
      expect(item).toEqual(
        expect.objectContaining({
          slug: expect.any(String),
          name: expect.any(String),
          destinationSlug: expect.any(String),
          category: expect.any(String),
          durationLabel: expect.any(String),
          subtitle: expect.any(String),
          photoUrl: expect.any(String),
          photosCount: expect.any(Number),
          priceFrom: expect.any(String),
        })
      );
    }
  });

  it('getInternationalDestinations() resolves the 5 backed fixture destinations', async () => {
    const destinations = await adapter.getInternationalDestinations();
    // Malaysia removed: the export named it but no tour goes there.
    expect(destinations).toHaveLength(5);
    expect(destinations.map((d) => d.name)).toEqual(['Maldives', 'Singapore', 'Thailand', 'Bali', 'Dubai']);
    // The export renders name + photo only for these — no invented fields.
    for (const destination of destinations) {
      expect(destination.region).toBeUndefined();
      expect(destination.category).toBeUndefined();
      expect(destination.tagline).toBeUndefined();
    }
  });

  it('getFeaturedVideos() resolves the fixture videos', async () => {
    const videos = await adapter.getFeaturedVideos();
    expect(videos.length).toBeGreaterThan(0);
    for (const video of videos) {
      expect(video).toEqual(
        expect.objectContaining({ title: expect.any(String), whenLabel: expect.any(String), thumbnailKey: expect.any(String) })
      );
    }
  });

  it('getStats() resolves 5 stat metrics, every one flagged as an unconfirmed placeholder', async () => {
    const stats = await adapter.getStats();
    expect(stats).toHaveLength(5);
    for (const stat of stats) {
      expect(stat).toEqual(expect.objectContaining({ icon: expect.any(String), value: expect.any(String), label: expect.any(String) }));
      // Assumption A3: the export and the product spec state different
      // numbers and neither is final, so none may render as settled fact.
      expect(stat.isPlaceholder).toBe(true);
    }
  });

  it('getTestimonials() resolves the 3 placeholder testimonials, each flagged isPlaceholder', async () => {
    const testimonials = await adapter.getTestimonials();
    expect(testimonials).toHaveLength(3);
    for (const review of testimonials) {
      expect(review.isPlaceholder).toBe(true);
    }
  });

  it('getTestimonials() carries no fabricated star rating on any placeholder (Decision H)', async () => {
    for (const review of await adapter.getTestimonials()) {
      expect(review.ratingOutOf5).toBeUndefined();
    }
  });

  it('getFeaturedVideos() asserts no specific departure date (Decision H)', async () => {
    for (const video of await adapter.getFeaturedVideos()) {
      // The captions used to read e.g. "Departed 06 Oct 2026 · 42 travellers" —
      // a hardcoded date with no source, two of which were in the future.
      expect(video.whenLabel).not.toMatch(/\b(19|20)\d{2}\b/);
      expect(video.whenLabel).not.toMatch(/departed/i);
      expect(video.whenLabel).not.toMatch(/travellers?\b/i);
    }
  });

  it('every method returns a real Promise (ISR-ready call sites)', () => {
    expect(adapter.getPackageRails()).toBeInstanceOf(Promise);
    expect(adapter.getPopularDestinations()).toBeInstanceOf(Promise);
  });

  it('the exported singleton `contentAdapter` behaves identically', async () => {
    await expect(contentAdapter.getPackageRails()).resolves.toHaveLength(4);
  });

  it('getGroupDepartures() resolves the 4 fixture departures, including the sold-out one', async () => {
    const departures = await adapter.getGroupDepartures();
    expect(departures).toHaveLength(4);
    expect(departures.filter((departure) => departure.isSoldOut)).toHaveLength(1);
  });

  it('getTripPlaceOptions() resolves the 12 fixture places with unique slugs', async () => {
    const places = await adapter.getTripPlaceOptions();
    expect(places).toHaveLength(12);
    expect(new Set(places.map((place) => place.slug)).size).toBe(12);
  });

  it('getAboutMilestones() resolves the 4 fixture milestones, every one flagged isPlaceholder', async () => {
    const milestones = await adapter.getAboutMilestones();
    expect(milestones).toHaveLength(4);
    for (const milestone of milestones) {
      expect(milestone.isPlaceholder).toBe(true);
    }
  });
});
