import type { DestinationCategory, PackageRail } from './types';

/**
 * BLOCKERS.md Decision C: chips are DERIVED from the fixture data, not
 * hardcoded — `Honeymoon`/`Wildlife` (0 matches in the export's own 20
 * `RAILS` items) can never reappear, and this list stays correct
 * automatically once the ERP adapter replaces the fixtures. Order is
 * first-appearance order scanning rails-then-items (a genuine derivation,
 * not a hand-picked sequence).
 */
export function getCategoryChips(rails: PackageRail[]): DestinationCategory[] {
  const seen = new Set<DestinationCategory>();
  for (const rail of rails) {
    for (const item of rail.items) {
      seen.add(item.category);
    }
  }
  return Array.from(seen);
}
