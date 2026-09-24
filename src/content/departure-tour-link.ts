import { slugify } from './slug';

/**
 * Which catalogue tour a departure is a dated batch OF — or `null` when that
 * cannot be said with certainty.
 *
 * Moved here from `prisma/seed.ts` (2026-09-24, the departures pass) so there is
 * ONE link rule with two consumers:
 *
 *  - `prisma/seed.ts` writes it into `GroupDeparture.tourSlug`;
 *  - `publiclyListedDepartures` in `public-listing.ts` (what
 *    `FixtureContentAdapter` serves) uses it to apply the departure visibility
 *    gate on the no-database path, so "a departure of a hidden tour is hidden"
 *    holds on both adapters rather than only on the one that happens to have a
 *    column.
 *
 * Only the SEED and the FIXTURE path derive the link. Once a row is in the
 * database, `GroupDeparture.tourSlug` is the fact and nothing re-derives it; the
 * admin form writes it directly for the batches it creates.
 *
 * ## Why matching is needed at all
 *
 * The two fixtures were transcribed from different parts of the design export
 * and name the same tour differently: a departure carries a route suffix the
 * catalogue does not ("Do Dham Yatra — Kedarnath & Badrinath" vs "Do Dham
 * Yatra"). There is no shared identifier, so the link has to be derived.
 *
 * ## Why NOT a price match
 *
 * `assertSafetyFlagsAgree` in the seed matches on `priceFrom`, which is right
 * for what it checks — "is this the same unconfirmed FIGURE" — and wrong for
 * identity. Two unrelated tours may legitimately cost ₹28,900, and a price match
 * would then attach one tour's real dates and seat counts to the other.
 *
 * ## The rule, and its deliberate refusal to guess
 *
 * A tour matches when its slug is the departure's slug or a hyphen-bounded
 * PREFIX of it. The longest match wins, so "do-dham-yatra" beats a hypothetical
 * "do-dham". Zero matches, or two of the same length (a genuine ambiguity), is
 * `null` — an honest, supported state: a departure with no tour link is listed
 * as-is and is not subject to any tour's visibility.
 */
export function resolveDepartureTourSlug(departureName: string, tours: readonly { slug: string }[]): string | null {
  const departureSlug = slugify(departureName);

  const candidates = tours
    .filter((tour) => departureSlug === tour.slug || departureSlug.startsWith(`${tour.slug}-`))
    .sort((a, b) => b.slug.length - a.slug.length);

  const best = candidates[0];
  if (!best) return null;

  // Two equally-specific matches is an ambiguity, not a tie to break arbitrarily.
  if (candidates[1] && candidates[1].slug.length === best.slug.length) return null;

  return best.slug;
}
