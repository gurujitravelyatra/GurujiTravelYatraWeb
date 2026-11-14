import { getDepartures, getPlaces, getTours } from '@/server/crm/client';
import type { CrmCategory, CrmPlace, CrmTourCard } from '@/server/crm/types';

/**
 * Trip Finder server-side resolver (brief §B, scoped per the user's
 * "lean but real" decision, 2026-11-14). Runs behind `POST /api/trip-finder`
 * — see that route's own header for why this lives server-side at all
 * (brief: "do the routing on the server").
 *
 * Business rules this resolver encodes (user's own words, 2026-11-14):
 * 1. Non-Group tours have no fixed departures (hotels/tickets are only
 *    confirmed after the visitor enquires) — Month/Travellers never filter,
 *    hide or rank them. They are only ever carried through as a PREFILL for
 *    the enquiry form (the tour page or Customized Tours), never applied as
 *    a server-side filter for those three category tabs.
 * 2. Group tours are the only ones with real limited seats/departures.
 *    Month matching for the Group tab uses `GET /public/departures` for
 *    real. If a destination match exists but none of the matching Group
 *    tours has a departure in the chosen month, the visitor still lands on
 *    the match (the tour page, or `/group-tours` filtered to it) with a
 *    `monthMismatchNote` — never redirected to Customized Tours for that
 *    reason alone.
 * 3. Destination suggestions (built by the caller, not here) are real CRM
 *    place names + states (`CrmPlace.region`) — no tour-title suggestions
 *    (would need a separate, unbounded tour fetch).
 * 5. No seat-count filtering is added to `/tour-packages` or `/group-tours`
 *    themselves — Travellers never narrows a listing, on any tab.
 */

export type TripFinderTabKey = 'group' | 'spiritual' | 'family' | 'adventure' | 'custom';

const TAB_CATEGORY: Record<Exclude<TripFinderTabKey, 'custom'>, CrmCategory> = {
  group: 'Group',
  spiritual: 'Spiritual',
  family: 'Family',
  adventure: 'Adventure',
};

export interface TripFinderInput {
  tab: TripFinderTabKey;
  /** Free text — a place name, a state/region, or (incidentally) a tour name. May be ''. */
  destination: string;
  /** A full month name ('January'..'December'), or '' for "Any month". */
  month: string;
  /** '1' | '2' | '3-4' | '5+' — carried through as prefill only, see rule 1/5 above. */
  travellers: string;
}

export interface TripFinderResult {
  url: string;
  /** True only when the visitor asked for a category/destination and none exists — the brief's own "let's design one for you" case. */
  isFallbackToCustom: boolean;
  /** Set only for the Group-tab month-mismatch case (rule 2) — never a reason to redirect away. */
  monthMismatchNote?: string;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** The nearest upcoming `YYYY-MM` for a month name — this year if not yet passed, else next year. */
export function resolveMonthKey(monthName: string, now: Date = new Date()): string | undefined {
  const index = MONTH_NAMES.indexOf(monthName as (typeof MONTH_NAMES)[number]);
  if (index === -1) return undefined;
  const currentYear = now.getUTCFullYear();
  const year = index >= now.getUTCMonth() ? currentYear : currentYear + 1;
  return `${year}-${String(index + 1).padStart(2, '0')}`;
}

function matchesDestination(tour: CrmTourCard, placesBySlug: Map<string, CrmPlace>, needle: string): boolean {
  if (tour.name.toLowerCase().includes(needle)) return true;
  if (tour.primaryPlace?.name.toLowerCase().includes(needle)) return true;
  const place = tour.primaryPlace ? placesBySlug.get(tour.primaryPlace.slug) : undefined;
  return place?.region.toLowerCase().includes(needle) ?? false;
}

/** Best-effort place slug for a `/tour-packages?place=` filter — see this file's header, rule 1's "no new search param" scoping note. */
function resolvePlaceSlugForListing(matches: CrmTourCard[], places: CrmPlace[], needle: string): string | undefined {
  const placeMatch = places.find((place) => place.name.toLowerCase().includes(needle) || place.region.toLowerCase().includes(needle));
  if (placeMatch) return placeMatch.slug;

  const distinctSlugs = new Set(matches.map((tour) => tour.primaryPlace?.slug).filter((slug): slug is string => Boolean(slug)));
  return distinctSlugs.size === 1 ? [...distinctSlugs][0] : undefined;
}

function tourDetailUrl(slug: string): string {
  return `/tour-packages/${slug}`;
}

function tourPackagesUrl(category: CrmCategory, place: string | undefined, month: string | undefined): string {
  const params = new URLSearchParams({ category });
  if (place) params.set('place', place);
  if (month) params.set('month', month);
  return `/tour-packages?${params.toString()}`;
}

function groupToursUrl(destination: string | undefined): string {
  if (!destination) return '/group-tours';
  return `/group-tours?${new URLSearchParams({ destination }).toString()}`;
}

/** Prefills the enquiry form on `/customize-tours` — fields stay visible/editable there, never auto-submitted. */
export function customizeToursUrl(destination: string, month: string, travellers: string): string {
  const params = new URLSearchParams();
  if (destination) params.set('destination', destination);
  if (month) params.set('month', month);
  if (travellers) params.set('travellers', travellers);
  const query = params.toString();
  return query ? `/customize-tours?${query}` : '/customize-tours';
}

export async function resolveTripFinder(input: TripFinderInput): Promise<TripFinderResult> {
  const destination = input.destination.trim();
  const month = input.month.trim();

  if (input.tab === 'custom') {
    return { url: customizeToursUrl(destination, month, input.travellers), isFallbackToCustom: false };
  }

  const category = TAB_CATEGORY[input.tab];

  // Bullet 4: empty destination goes to the plain listing — no destination
  // filter, and (rule 1/5) no month/travellers filter applied either.
  if (destination === '') {
    return {
      url: input.tab === 'group' ? groupToursUrl(undefined) : tourPackagesUrl(category, undefined, undefined),
      isFallbackToCustom: false,
    };
  }

  const [places, toursResponse] = await Promise.all([getPlaces(), getTours({ category, pageSize: 100 })]);
  const placesBySlug = new Map(places.map((place) => [place.slug, place]));
  const needle = destination.toLowerCase();
  const matches = toursResponse.tours.filter((tour) => matchesDestination(tour, placesBySlug, needle));

  if (matches.length === 0) {
    return { url: customizeToursUrl(destination, month, input.travellers), isFallbackToCustom: true };
  }

  if (input.tab !== 'group') {
    // Rule 1: month/travellers never filter non-Group tabs — always the listing, never a direct detail-page redirect.
    return { url: tourPackagesUrl(category, resolvePlaceSlugForListing(matches, places, needle), undefined), isFallbackToCustom: false };
  }

  // Group tab: month matching against real departures (rule 2).
  const monthKey = month ? resolveMonthKey(month) : undefined;
  const matchSlugs = new Set(matches.map((tour) => tour.slug));
  const { departures } = await getDepartures();
  const matchingDepartures = departures.filter((departure) => departure.category === 'Group' && matchSlugs.has(departure.slug));
  const slugsInMonth = monthKey
    ? new Set(matchingDepartures.filter((departure) => departure.departureDate.startsWith(monthKey)).map((d) => d.slug))
    : new Set(matchingDepartures.map((d) => d.slug));

  const monthMismatch = Boolean(monthKey) && slugsInMonth.size === 0 && matchingDepartures.length > 0;
  const monthMismatchNote = monthMismatch ? `No departure in ${month}, here are the upcoming dates` : undefined;

  if (matches.length === 1) {
    return { url: tourDetailUrl(matches[0].slug), isFallbackToCustom: false, monthMismatchNote };
  }
  return { url: groupToursUrl(destination), isFallbackToCustom: false, monthMismatchNote };
}
