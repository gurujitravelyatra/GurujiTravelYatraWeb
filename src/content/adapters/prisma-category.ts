import type { DestinationCategory } from '../types';

/**
 * The `DestinationCategory` enum member names as the Prisma CLIENT spells them.
 *
 * These are NOT always the domain strings: Prisma enum members cannot contain a
 * space, so `'Family Trip'` is the member `FamilyTrip`, stored in Postgres as the
 * exact domain string via `@map("Family Trip")` (see `prisma/schema.prisma`).
 * Every other member is spelled identically in both worlds.
 */
export type PrismaCategoryName =
  | 'Spiritual'
  | 'Mountains'
  | 'Cultural'
  | 'Family'
  | 'Adventure'
  | 'International'
  | 'Beach'
  | 'Himalaya'
  | 'FamilyTrip'
  | 'Pilgrimage';

/**
 * Domain string → Prisma member name.
 *
 * Typed as `Record<DestinationCategory, …>` ON PURPOSE: adding a category to the
 * union in `types.ts` without adding it here is a COMPILE ERROR, not a runtime
 * surprise. That is stronger than a test, and it matters because these values
 * drive the public filter chips (`get-category-chips.ts`) — a category that
 * silently failed to map would quietly drop a chip, which is the same class of
 * defect as the Malaysia card that pointed at an empty catalogue.
 */
export const CATEGORY_TO_PRISMA: Record<DestinationCategory, PrismaCategoryName> = {
  Spiritual: 'Spiritual',
  Mountains: 'Mountains',
  Cultural: 'Cultural',
  Family: 'Family',
  Adventure: 'Adventure',
  International: 'International',
  Beach: 'Beach',
  Himalaya: 'Himalaya',
  'Family Trip': 'FamilyTrip',
  Pilgrimage: 'Pilgrimage',
};

/**
 * Prisma member name → domain string. Built by inverting the map above rather
 * than hand-written a second time, so the two can never disagree — hand-writing
 * both directions is how you get a pair that drifts by one entry.
 */
export const PRISMA_TO_CATEGORY = Object.fromEntries(
  Object.entries(CATEGORY_TO_PRISMA).map(([domain, prisma]) => [prisma, domain])
) as Record<PrismaCategoryName, DestinationCategory>;

/**
 * Converts a stored category to the domain union.
 *
 * Throws rather than defaulting: an unrecognised category means the database
 * holds a value this build does not know about (a migration ran ahead of the
 * code, say). Coercing it to some fallback category would file a tour under the
 * wrong filter chip silently; failing loudly surfaces the mismatch at the
 * boundary where it can still be understood.
 */
export function toDomainCategory(value: string): DestinationCategory {
  const category = PRISMA_TO_CATEGORY[value as PrismaCategoryName];
  if (!category) {
    throw new Error(
      `Unknown DestinationCategory "${value}" from the database — it is not in the union in src/content/types.ts. ` +
        `Schema and code are out of sync; run prisma generate and check prisma/schema.prisma.`
    );
  }
  return category;
}
