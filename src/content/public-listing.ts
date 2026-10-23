import { formatRupees, readStoredRupeeAmount } from '@/lib/rupees';

import type { GroupDeparture, Package, PackageRail } from './types';
import { resolveDepartureTourSlug } from './departure-tour-link';
import { groupDepartures } from './fixtures/group-departures.fixture';
import { allTours, packageRails } from './fixtures/packages.fixture';
import { popularPackages } from './fixtures/popular.fixture';

/**
 * PUBLIC LISTING GATE.
 *
 * ## CRM-migration decision 1 (removed the PRICE_UNCONFIRMED leg)
 *
 * `Package.pricingUnverified` used to withhold a tour from every public
 * listing — three tours ("Do Dham Yatra", "Kashmir Family Escape", "Kashi
 * Darshan") carried the flag because the design export transcribed them
 * twice with disagreeing prices, and this function 404'd their detail route
 * and hid them from every rail/catalogue/card until someone confirmed a real
 * figure.
 *
 * That check is REMOVED as of the CRM-migration review: once the site is a
 * read-client of the CRM, `isLiveOnWebsite` (the CRM's own publish gate,
 * which already refuses to publish a tour with no price above zero) is the
 * only visibility check the website needs or should second-guess. The
 * website trusting its OWN second opinion about whether a published price is
 * "confirmed enough" duplicated a judgement call that belongs to the CRM.
 *
 * `Package.pricingUnverified` and `PublicWithholdReason`'s `'PRICE_UNCONFIRMED'`
 * member are both left in place (no field is deleted, no migration is
 * needed) — this function simply never returns that reason any more, so a
 * tour that still carries the flag in the fixture/database is listed exactly
 * like any other published, unarchived tour. The one thing that still must
 * never happen is printing "₹0" or a blank figure for a genuinely missing or
 * zero price — that is handled at RENDER time now (`hasConfirmedTourPrice()`
 * in `@/lib/rupees`, rendered as "Price on request" wherever a tour's price
 * appears), not by withholding the whole tour.
 *
 * ## Phase B added two more reasons to withhold, in this SAME function
 *
 * The admin CMS can now leave a tour unfinished (`status: 'DRAFT'`) or retire it
 * (`archivedAt`). Both must be invisible publicly, and both are checked HERE
 * rather than in a second `isPublished()` predicate beside this one.
 *
 * That choice is the lesson of `memory/feedback_qg_unenforced-safety-flag.md`
 * variant 4, where a gate covering `Package` silently did not cover the
 * later-built `/group-tours` surface. Two parallel predicates reproduce that
 * failure *within* one type: every existing call site already funnels through
 * `isPubliclyListable`, so a new check added next to it would have to be
 * retro-fitted to each of them by hand, and the one that got missed would be
 * the leak. Composing into this function means every surface that was already
 * gated — Home's rails, `/tour-packages`, `/tour-packages/[slug]`,
 * `/api/tours`, `/api/tours/[slug]`, `generateStaticParams()`, brochures — got
 * draft and archive protection with no edit at the call site and no way to opt
 * out.
 *
 * The two remaining conditions are ordered strongest-first and read as one
 * sentence: a tour is publicly listable when it has been PUBLISHED and has
 * not been ARCHIVED.
 *
 * ## Phase E: the gate now also answers WHY, for the admin
 *
 * `isPubliclyListable` returns a boolean, which is all the public side needs —
 * but it left the ADMIN side with no way to explain a withheld tour except by
 * re-implementing the three conditions. It did not re-implement them; it
 * ignored them, and showed a green "Published" pill plus the words "This tour
 * is now visible on the public site" for a tour the public gate was silently
 * withholding (the H1 finding, 2026-09-19).
 *
 * So the conditions live in ONE function that returns a reason, and the boolean
 * is derived from it. That ordering matters: a sibling `withholdReason()` beside
 * an independent `isPubliclyListable()` is two copies of a security predicate,
 * and the copy that drifts is the one nobody is testing. Here, a new condition
 * added below is inherited by both the public gate and every admin explanation
 * of it, with no call-site edit — the same composition rule the draft/archive
 * checks followed into this function in Phase B.
 */

/**
 * The fields the gate actually reads — nothing else. Declared structurally so
 * the ADMIN row types can be passed in directly, rather than being mapped into
 * a full `Package` (which would mean inventing the dozen fields the gate does
 * not look at) or checked against a second predicate.
 *
 * `archivedAt` is the widest of the three, because the two sides genuinely spell
 * the same fact differently and neither spelling is wrong:
 *
 *  - the domain `Package` carries an ISO `string` and OMITS it when not archived
 *    (it is fixture/JSON-shaped, and a `Date` does not survive a JSON round trip);
 *  - a Prisma row carries a `Date` and holds `null`.
 *
 * Accepting all four is what lets one predicate serve both, and it costs nothing
 * in safety: the check below is `!= null`, so every non-null spelling —
 * including an empty string — reads as ARCHIVED, which is the closed direction.
 */
export interface PublicListingFacts {
  status: Package['status'];
  archivedAt?: Date | string | null;
  pricingUnverified?: boolean;
}

/**
 * Why the public site withholds this tour, or `null` when it does not.
 *
 * THE single source of truth for public visibility. `isPubliclyListable` is a
 * thin derivation of it, and the admin UI renders the reason.
 */
export type PublicWithholdReason = 'DRAFT' | 'ARCHIVED' | 'PRICE_UNCONFIRMED';

export function publicWithholdReason(pkg: PublicListingFacts): PublicWithholdReason | null {
  /**
   * DEFAULT-CLOSED. An equality test against `'PUBLISHED'`, never
   * `!== 'DRAFT'` — those are identical today and stop being identical the
   * moment a third status exists, at which point `!== 'DRAFT'` silently
   * publishes it. The safe direction is to name what may be shown, not what
   * may not.
   */
  if (pkg.status !== 'PUBLISHED') return 'DRAFT';

  /**
   * Archived means withdrawn from sale. The row is kept (product-spec §7's
   * "never hard-delete something with lead history"), the listing is not.
   *
   * `== null` (loose, deliberately) rather than truthiness, so a hypothetical
   * empty-string timestamp cannot read as "not archived" — while still treating
   * the domain type's `undefined` and a database row's `null` as the same fact.
   */
  if (pkg.archivedAt != null) return 'ARCHIVED';

  /**
   * CRM-migration decision 1: deliberately NOT checking `pricingUnverified`
   * here any more — see the file-level doc comment above. The CRM's own
   * `isLiveOnWebsite` publish gate is trusted fully; this function no longer
   * second-guesses a published tour's price.
   */

  return null;
}

export function isPubliclyListable(pkg: PublicListingFacts): boolean {
  return publicWithholdReason(pkg) === null;
}

/**
 * The reason, as a sentence an admin can act on.
 *
 * Lives here, beside the predicate, rather than in the admin components: the
 * copy and the condition it describes are the thing that must not drift, and
 * `feedback_qg_stale-invariant-after-fix` is a catalogue of what happens when
 * prose is authored away from the rule it describes.
 */
export const WITHHOLD_REASON_TEXT: Record<PublicWithholdReason, string> = {
  DRAFT: 'Not published — this tour is a draft and is not on the public site.',
  ARCHIVED: 'Archived — this tour is hidden from the public site regardless of its publish status.',
  PRICE_UNCONFIRMED:
    'Withheld from the public site — price unconfirmed. This tour is published in the CMS, but the public ' +
    'site refuses to quote a price that was never confirmed, so its card does not appear anywhere and its ' +
    'page returns “not found”.',
};

// -----------------------------------------------------------------------------
// DEPARTURES — the same gate, reached through the parent tour
// -----------------------------------------------------------------------------

/**
 * The parent tour a departure is gated by, or `null` when the departure is not
 * linked to any tour (`GroupDeparture.tourSlug` is NULL — a genuinely partial
 * link, see `departure-tour-link.ts`).
 */
export type DepartureParent = PublicListingFacts | null;

/**
 * Why the public site withholds this DEPARTURE, or `null` when it does not.
 *
 * ## The defect this closes (2026-09-25, the departures pass)
 *
 * A `GroupDeparture` linked to a tour was listed on `/group-tours` and by
 * `GET /api/group-tours` with no reference to that tour at all. The listing
 * query was written before `status`/`archivedAt` existed, so archiving or
 * un-publishing a tour withdrew the tour everywhere EXCEPT its departures — real
 * dates, real seat counts and a price, with an "Enquire" button, for a trip the
 * business had pulled. That is `memory/feedback_qg_unenforced-safety-flag.md`
 * variant 4 reproduced by a later schema change: the gate was written against
 * `Package`, and a sibling type holding the same real-world entity was not
 * covered.
 *
 * ## Composed from `publicWithholdReason`, not re-implemented beside it
 *
 * This calls THE gate on the parent tour. A second predicate that re-stated
 * "published and not archived" would be two copies of a security rule, and the
 * copy nobody tests is the one that drifts.
 *
 * ## `PRICE_UNCONFIRMED` exemption — now a no-op, kept for the record
 *
 * This used to exempt `PRICE_UNCONFIRMED` explicitly so a departure of a
 * price-doubtful tour stayed listed and merely MARKED (BLOCKERS.md item 9).
 * CRM-migration decision 1 removed `PRICE_UNCONFIRMED` from
 * `publicWithholdReason()`'s possible outputs entirely, so this comparison
 * can no longer match anything — `reason` is always `'DRAFT'`, `'ARCHIVED'`
 * or `null` now. Left in place rather than deleted because it is harmless,
 * it costs nothing, and it is the honest record of why a departure's price
 * doubt was never supposed to withhold it even before decision 1. If
 * `publicWithholdReason` ever grows a price-related reason again, this line
 * is where to decide whether departures should inherit it.
 *
 * ## Default-closed against a FUTURE reason
 *
 * The exemption names `PRICE_UNCONFIRMED` explicitly and passes every OTHER
 * reason through. So a fourth reason added to `publicWithholdReason` later is
 * inherited by departures automatically — the safe direction. Writing it as
 * "withhold on DRAFT or ARCHIVED" would have silently exempted the new one.
 */
export function departureWithholdReason(parent: DepartureParent): PublicWithholdReason | null {
  if (parent === null) return null;
  const reason = publicWithholdReason(parent);
  if (reason === 'PRICE_UNCONFIRMED') return null;
  return reason;
}

/**
 * A departure as the public may see it — or `undefined` when it is withheld.
 *
 * THE function every public departure read ends in, on both adapters.
 *
 * Besides withholding, it carries the parent tour's price doubt onto the
 * departure: a departure of a `pricingUnverified` tour is returned with
 * `priceUnverified: true` whatever its own column says. The seed asserts the two
 * flags agree for the fixture data (BLOCKERS.md item 9), but a departure created
 * through the admin form has no such check, and "the tour's price is
 * unconfirmed, but this batch of it quotes a price with no marker" is the
 * cross-model drift that item exists for. Deriving it at READ time means no write
 * path can get it wrong — the photosCount lesson applied in the safe direction:
 * nothing is written, so no unrelated edit can clear it.
 */
export function toPublicDeparture<D extends { priceUnverified?: boolean }>(
  departure: D,
  parent: DepartureParent
): D | undefined {
  if (departureWithholdReason(parent) !== null) return undefined;
  if (parent?.pricingUnverified === true && departure.priceUnverified !== true) {
    return { ...departure, priceUnverified: true };
  }
  return departure;
}

/** Every tour the site may show publicly, each exactly once. */
export const publiclyListedTours: Package[] = allTours.filter(isPubliclyListable);

/**
 * The fixture path's departures, through the SAME gate the database path uses.
 *
 * The fixtures carry no `tourSlug`, so the link is derived with
 * `resolveDepartureTourSlug` — the one rule `prisma/seed.ts` writes into the
 * column, so both adapters attach each departure to the same tour (or to none).
 * Every fixture tour is PUBLISHED and unarchived, so today this withholds
 * nothing and only carries price doubt across; it exists so that "a departure of
 * a hidden tour is hidden" holds on both adapters rather than only on the one
 * that happens to have a column, and so a fixture tour set to DRAFT would take
 * its departure with it.
 */
export const publiclyListedDepartures: GroupDeparture[] = groupDepartures.flatMap((departure) => {
  const tourSlug = resolveDepartureTourSlug(departure.name, allTours);
  const parent = tourSlug === null ? null : (allTours.find((tour) => tour.slug === tourSlug) ?? null);
  const visible = toPublicDeparture(departure, parent);
  return visible ? [visible] : [];
});

/** Home's "Popular Destinations" selection, minus anything not publicly listable. */
export const publiclyListedPopular: Package[] = popularPackages.filter(isPubliclyListable);

/**
 * The 4 Tour Packages rails, each narrowed to publicly-listable items. Rails
 * are kept even when narrowing empties them — `PackageRail` already renders a
 * defensive empty state, and dropping a whole rail would change the page's
 * structure based on a temporary data flag. (Today none empty: the 3 flagged
 * tours all sit in "Trending Tour Packages", which keeps 2 items.)
 */
export const publiclyListedRails: PackageRail[] = packageRails.map((rail) => ({
  ...rail,
  items: rail.items.filter(isPubliclyListable),
}));

/**
 * Tours that are rendered at `/tour-packages` specifically — i.e. the rails,
 * NOT the 2 popular-only tours (which belong to no rail and therefore appear
 * on Home only). Copy that points a visitor at the catalogue may only name
 * tours in THIS set; `tabs.fixture.ts`'s COPY FIDELITY RULE is tested against
 * it.
 */
export const toursRenderedOnCataloguePage: Package[] = publiclyListedRails.flatMap((rail) => rail.items);

export interface DestinationOption {
  slug: string;
  name: string;
}

/**
 * The destinations a visitor can actually filter to, DERIVED from the tours
 * passed in — same principle as `getCategoryChips`: an option that matches
 * zero journeys must not exist. (This is why the Malaysia card had to go:
 * `international.fixture.ts` named it, no tour backs it.)
 *
 * Sorted by name so the select order is stable and predictable rather than
 * rail-authoring order.
 */
export function getDestinationOptions(tours: Package[]): DestinationOption[] {
  const bySlug = new Map<string, DestinationOption>();
  for (const tour of tours) {
    if (!bySlug.has(tour.destinationSlug)) {
      bySlug.set(tour.destinationSlug, { slug: tour.destinationSlug, name: tour.destinationName });
    }
  }
  return Array.from(bySlug.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export interface PriceRange {
  min: number;
  max: number;
  label: string; // e.g. "₹12,800 — ₹78,500"
}

/**
 * The real price bounds of a set of tours, formatted for display.
 *
 * The Tour Packages filter bar used to hard-code "₹15,000 — ₹75,000", which
 * matched no actual bound in the data (the true range is ₹12,800 — ₹78,500) and
 * silently excluded the cheapest and the most expensive journeys on the site.
 * Computing it means it can never drift from the catalogue again.
 *
 * ## Robust to what is already stored (M6, 2026-09-19)
 *
 * This used to strip every non-digit and read the rest, so a stored
 * `₹42,500 per 2 pax` became ₹4,25,002 and silently became the catalogue's
 * maximum. The admin form now refuses anything but `₹42,500`, but rows written
 * before that rule are NOT rewritten — so this reads with
 * `readStoredRupeeAmount()`, which tolerates spacing and grouping variants and
 * returns nothing, rather than a made-up number, for a value that carries any
 * other text. Such a tour still lists; it simply does not move the bounds.
 */
export function getPriceRange(tours: Package[]): PriceRange | undefined {
  const amounts = tours
    .map((tour) => readStoredRupeeAmount(tour.priceFrom))
    .filter((amount): amount is number => amount !== undefined);

  if (amounts.length === 0) return undefined;

  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  return { min, max, label: `${formatRupees(min)} — ${formatRupees(max)}` };
}
