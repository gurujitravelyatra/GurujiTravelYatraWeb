import type { ContentPort } from '../ports';
import { aboutMilestones } from '../fixtures/about.fixture';
import { groupDepartures } from '../fixtures/group-departures.fixture';
import { internationalDestinations } from '../fixtures/international.fixture';
import { tripPlaceOptions } from '../fixtures/places.fixture';
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

  /**
   * NOT routed through `public-listing.ts`. That gate withholds records
   * flagged `pricingUnverified` because they would otherwise render a
   * "was ₹X / Save ₹Y" savings badge the data cannot support. A departure
   * renders a single price and no savings badge, and its date/seat count are
   * real regardless — so the contested-duration records are surfaced with a
   * visible marker (`durationUnverified`) instead of being withheld, which
   * would drop half the page's departures.
   */
  getGroupDepartures() {
    return Promise.resolve(groupDepartures);
  }

  getTripPlaceOptions() {
    return Promise.resolve(tripPlaceOptions);
  }

  getAboutMilestones() {
    return Promise.resolve(aboutMilestones);
  }
}

// The `contentAdapter` singleton used to live here. It now lives in
// `src/content/content-adapter.ts`, the composition root, because choosing
// between this adapter and `PrismaContentAdapter` (BLOCKERS.md §5) is not a
// decision a file named for the fixtures can own. This module exports the class
// only — importing it does NOT commit the caller to the fixture path.
