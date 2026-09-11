import type { ContentPort } from '../ports';
import { internationalDestinations } from '../fixtures/international.fixture';
import { featuredVideos } from '../fixtures/videos.fixture';
import { statMetrics } from '../fixtures/stats.fixture';
import { testimonials } from '../fixtures/testimonials.fixture';
import { publiclyListedPopular, publiclyListedRails, publiclyListedTours } from '../public-listing';

/**
 * Active `ContentPort` implementation this sprint (tech spec §3/§6.1).
 * Returns the fixture arrays transcribed verbatim from the design export,
 * wrapped in `Promise.resolve(...)` so every call site already reads as
 * async/ISR-ready. Swapping to a real `ErpContentAdapter` later only
 * requires a new class implementing `ContentPort` — no page or component
 * code changes.
 *
 * Tour queries return the PUBLICLY LISTABLE set (`../public-listing.ts`), not
 * the raw fixtures: records flagged `pricingUnverified` are withheld from
 * every listing and from the detail route until real figures are confirmed.
 * The filtering lives at this boundary on purpose — a real `ErpContentAdapter`
 * inherits the same contract instead of every component re-deriving it.
 */
export class FixtureContentAdapter implements ContentPort {
  getAllTours() {
    return Promise.resolve(publiclyListedTours);
  }

  getPopularDestinations() {
    return Promise.resolve(publiclyListedPopular);
  }

  getInternationalDestinations() {
    return Promise.resolve(internationalDestinations);
  }

  getPackageRails() {
    return Promise.resolve(publiclyListedRails);
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
