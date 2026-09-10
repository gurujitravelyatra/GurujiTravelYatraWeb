import { FixtureContentAdapter, contentAdapter } from '../fixture-content-adapter';

describe('FixtureContentAdapter', () => {
  const adapter = new FixtureContentAdapter();

  it('getPackageRails() resolves 4 rails x 5 items each', async () => {
    const rails = await adapter.getPackageRails();
    expect(rails).toHaveLength(4);
    for (const rail of rails) {
      expect(rail.items).toHaveLength(5);
      expect(typeof rail.title).toBe('string');
      expect(rail.title.length).toBeGreaterThan(0);
    }
  });

  it('getPopularDestinations() resolves the 5 fixture entries mapped to Package shape', async () => {
    const popular = await adapter.getPopularDestinations();
    expect(popular).toHaveLength(5);
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

  it('getInternationalDestinations() resolves the 6 fixture destinations', async () => {
    const destinations = await adapter.getInternationalDestinations();
    expect(destinations).toHaveLength(6);
    expect(destinations.map((d) => d.name)).toEqual(['Maldives', 'Singapore', 'Thailand', 'Malaysia', 'Bali', 'Dubai']);
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

  it('getStats() resolves 5 stat metrics', async () => {
    const stats = await adapter.getStats();
    expect(stats).toHaveLength(5);
    for (const stat of stats) {
      expect(stat).toEqual(expect.objectContaining({ icon: expect.any(String), value: expect.any(String), label: expect.any(String) }));
    }
  });

  it('getTestimonials() resolves the 3 placeholder testimonials, each flagged isPlaceholder', async () => {
    const testimonials = await adapter.getTestimonials();
    expect(testimonials).toHaveLength(3);
    for (const review of testimonials) {
      expect(review.isPlaceholder).toBe(true);
    }
  });

  it('every method returns a real Promise (ISR-ready call sites)', () => {
    expect(adapter.getPackageRails()).toBeInstanceOf(Promise);
    expect(adapter.getPopularDestinations()).toBeInstanceOf(Promise);
  });

  it('the exported singleton `contentAdapter` behaves identically', async () => {
    await expect(contentAdapter.getPackageRails()).resolves.toHaveLength(4);
  });
});
