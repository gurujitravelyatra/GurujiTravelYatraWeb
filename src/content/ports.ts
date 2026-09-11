import type {
  AboutMilestone,
  Destination,
  FeaturedVideo,
  GroupDeparture,
  Package,
  PackageRail,
  Review,
  StatMetric,
  TripPlaceOption,
} from './types';

/**
 * Content read boundary — tech spec §6.1 / §3 architecture.
 *
 * `FixtureContentAdapter` (src/content/adapters/fixture-content-adapter.ts)
 * is the only implementation this sprint. Swapping to a real
 * `ErpContentAdapter` later is a one-file change; no page or component
 * imports an adapter directly — everything depends on this interface.
 */
/**
 * EVERY method on this port returns PUBLICLY LISTABLE content only.
 *
 * Implementations must withhold records that are not cleared for display —
 * today that means anything flagged `Package.pricingUnverified` (see
 * `src/content/public-listing.ts`). Callers therefore never need to re-filter,
 * and a record cannot leak into a listing because one component forgot to.
 */
export interface ContentPort {
  /**
   * Every publicly listable tour record, each exactly once — the set of slugs
   * `/tour-packages/[slug]` resolves. Anything absent here 404s, by design. A
   * first-class port method rather than a union assembled at the call site:
   * tour data has a single source of truth, so no consumer should ever have to
   * merge two overlapping lists and pick a winner on collision.
   */
  getAllTours(): Promise<Package[]>;
  getPopularDestinations(): Promise<Package[]>;
  getInternationalDestinations(): Promise<Destination[]>;
  getPackageRails(): Promise<PackageRail[]>;
  getFeaturedVideos(): Promise<FeaturedVideo[]>;
  getStats(): Promise<StatMetric[]>;
  getTestimonials(): Promise<Review[]>;

  /**
   * Fixed departures for `/group-tours` — product-spec §5.4.
   *
   * A SEPARATE method from `getAllTours()` on purpose. "Group Tour" appears in
   * this codebase in two unrelated senses and conflating them is the trap here:
   *
   *  1. `tabs.fixture.ts` — a Home trip-finder tab, i.e. a way of ARRANGING a
   *     trip ("Showing upcoming departures with seats still open"). It filters
   *     the tour catalogue.
   *  2. This method — actual dated departures with seat counts and boarding
   *     points, which the catalogue has no fields for.
   *
   * `/group-tours` is sense 2. It is NOT `/tour-packages?category=Group Tour`:
   * there is no such category in `DestinationCategory`, and no `Package`
   * record carries a departure date or a seat count. Routing it through the
   * `?category=` mechanism would render the right tours with all the
   * urgency data — the entire point of the page — missing.
   */
  getGroupDepartures(): Promise<GroupDeparture[]>;

  /** Places selectable in the `/customize-tours` trip builder — product-spec §5.5. */
  getTripPlaceOptions(): Promise<TripPlaceOption[]>;

  /** "Our Journey" milestones for `/about-us` — product-spec §5.8. */
  getAboutMilestones(): Promise<AboutMilestone[]>;
}

/**
 * Lead write boundary — tech spec §6.2. `NotImplementedLeadAdapter`
 * (src/content/adapters/not-implemented-lead-adapter.ts) is the only
 * implementation this sprint — see BLOCKERS.md §1a / Decision A. It never
 * makes a network call and always resolves an `{status:'error'}` result.
 */
export type LeadSourceTag =
  | `Enquire Now – ${string}`
  | `Brochure Download – ${string}`
  | `Group Tour Reservation – ${string}`
  | 'Custom Trip Request'
  | 'Contact Page'
  | `Service Enquiry – ${string}`
  | 'Newsletter Signup';

export interface LeadPayload {
  name?: string; // required for enquiry/brochure forms — enforced by Zod at the form layer
  mobile?: string;
  email?: string;
  interestedIn?: string; // resolved from page context, never re-asked of the visitor
  travelDate?: string; // ISO date string
  travellers?: number;
  city?: string;
  message?: string;
  source: LeadSourceTag;
  sourcePageUrl: string;
  timestamp: string; // ISO 8601, set at submit time
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    content?: string;
    term?: string;
  };
}

export type LeadSubmissionResult =
  | { status: 'success'; confirmationMessage: string }
  | { status: 'error'; retryable: boolean; message: string };

export interface LeadSubmissionPort {
  submitLead(payload: LeadPayload): Promise<LeadSubmissionResult>;
}
