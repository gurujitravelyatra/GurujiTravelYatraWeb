import type { AudienceTagValue } from '@/server/admin/tours/tour-form-schema';

/**
 * The `TourAudienceTag` enum member names as the Prisma CLIENT spells them.
 *
 * Exactly the problem `prisma-category.ts` solves, for the second enum: Prisma
 * enum members cannot contain a space or a hyphen, so `'Group Tour'` is the
 * member `GroupTour` and `'Custom-eligible'` is `CustomEligible`, both stored in
 * Postgres as the exact domain string via `@map`. The other two members are
 * spelled identically in both worlds.
 */
export type PrismaAudienceTagName = 'Domestic' | 'International' | 'GroupTour' | 'CustomEligible';

/**
 * Domain string → Prisma member name.
 *
 * Typed as `Record<AudienceTagValue, …>` on purpose, for the same reason
 * `CATEGORY_TO_PRISMA` is: adding a tag to `AUDIENCE_TAG_VALUES` without adding
 * it here is a COMPILE ERROR rather than a tag that silently fails to save.
 */
export const AUDIENCE_TAG_TO_PRISMA: Record<AudienceTagValue, PrismaAudienceTagName> = {
  Domestic: 'Domestic',
  International: 'International',
  'Group Tour': 'GroupTour',
  'Custom-eligible': 'CustomEligible',
};

/** Inverted rather than hand-written twice — see `PRISMA_TO_CATEGORY`. */
export const PRISMA_TO_AUDIENCE_TAG = Object.fromEntries(
  Object.entries(AUDIENCE_TAG_TO_PRISMA).map(([domain, prisma]) => [prisma, domain])
) as Record<PrismaAudienceTagName, AudienceTagValue>;

/**
 * Converts a stored tag to the domain string, THROWING on an unknown value.
 *
 * Same contract as `toDomainCategory()`. Dropping an unrecognised tag silently
 * would be the tempting alternative and is worse: the admin form would render
 * with that tag unchecked, and the next save would delete it from the row — a
 * schema/code mismatch quietly destroying data instead of reporting itself.
 */
export function toDomainAudienceTag(value: string): AudienceTagValue {
  const tag = PRISMA_TO_AUDIENCE_TAG[value as PrismaAudienceTagName];
  if (!tag) {
    throw new Error(
      `Unknown TourAudienceTag "${value}" from the database — it is not in AUDIENCE_TAG_VALUES ` +
        `(src/server/admin/tours/tour-form-schema.ts). Schema and code are out of sync; run prisma generate.`
    );
  }
  return tag;
}
