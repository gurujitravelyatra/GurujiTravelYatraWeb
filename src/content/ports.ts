import type {
  Destination,
  FeaturedVideo,
  Package,
  PackageRail,
  Review,
  StatMetric,
} from './types';

/**
 * Content read boundary — tech spec §6.1 / §3 architecture.
 *
 * `FixtureContentAdapter` (src/content/adapters/fixture-content-adapter.ts)
 * is the only implementation this sprint. Swapping to a real
 * `ErpContentAdapter` later is a one-file change; no page or component
 * imports an adapter directly — everything depends on this interface.
 */
export interface ContentPort {
  getPopularDestinations(): Promise<Package[]>;
  getInternationalDestinations(): Promise<Destination[]>;
  getPackageRails(): Promise<PackageRail[]>;
  getFeaturedVideos(): Promise<FeaturedVideo[]>;
  getStats(): Promise<StatMetric[]>;
  getTestimonials(): Promise<Review[]>;
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
