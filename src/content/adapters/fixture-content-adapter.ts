import type { ContentPort } from '../ports';
import { allTours, packageRails } from '../fixtures/packages.fixture';
import { popularPackages } from '../fixtures/popular.fixture';
import { internationalDestinations } from '../fixtures/international.fixture';
import { featuredVideos } from '../fixtures/videos.fixture';
import { statMetrics } from '../fixtures/stats.fixture';
import { testimonials } from '../fixtures/testimonials.fixture';

/**
 * Active `ContentPort` implementation this sprint (tech spec §3/§6.1).
 * Returns the fixture arrays transcribed verbatim from the design export,
 * wrapped in `Promise.resolve(...)` so every call site already reads as
 * async/ISR-ready. Swapping to a real `ErpContentAdapter` later only
 * requires a new class implementing `ContentPort` — no page or component
 * code changes.
 */
export class FixtureContentAdapter implements ContentPort {
  getAllTours() {
    return Promise.resolve(allTours);
  }

  getPopularDestinations() {
    return Promise.resolve(popularPackages);
  }

  getInternationalDestinations() {
    return Promise.resolve(internationalDestinations);
  }

  getPackageRails() {
    return Promise.resolve(packageRails);
  }

  getFeaturedVideos() {
    return Promise.resolve(featuredVideos);
  }

  getStats() {
    return Promise.resolve(statMetrics);
  }

  getTestimonials() {
    return Promise.resolve(testimonials);
  }
}

export const contentAdapter: ContentPort = new FixtureContentAdapter();
