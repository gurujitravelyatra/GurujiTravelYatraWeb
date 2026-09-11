/**
 * Card-grid column ladders keyed on how many cards there ACTUALLY are.
 *
 * Both card grids on the site were authored against a fixed item count — Home's
 * Popular Destinations at `grid-cols-2 640:grid-cols-3 1080:grid-cols-5`
 * because the export always had 5 popular tours. Withholding the three
 * `pricingUnverified` tours (`src/content/public-listing.ts`) left 2, so a
 * ≥1080px viewport drew a 5-column grid with three empty trailing columns and
 * two cards stretched across the remaining width.
 *
 * Driving the column count from the data means it cannot go stale again the
 * next time the listable set changes — including the other direction, when
 * confirmed pricing puts the withheld tours back.
 *
 * The `max-w` caps keep a short row reading as a row of cards rather than two
 * ~800px-wide posters. At 5+ items nothing is capped and the layout is exactly
 * what it was before.
 *
 * Class strings are full literals, never interpolated, so Tailwind's scanner
 * can see every one of them.
 */
const GRID_BY_COUNT: Record<number, string> = {
  0: 'grid-cols-1',
  1: 'grid-cols-1 max-w-[330px]',
  2: 'grid-cols-2 max-w-[680px]',
  3: 'grid-cols-2 640:grid-cols-3 640:max-w-[1030px]',
  4: 'grid-cols-2 1080:grid-cols-4',
};

/** 5 or more: the export's original ladder, uncapped. */
export const GRID_DEFAULT = 'grid-cols-2 640:grid-cols-3 1080:grid-cols-5';

/**
 * The Tailwind column classes for a grid of exactly `count` cards, chosen so no
 * viewport ever renders an empty trailing column.
 */
export function gridColumnsForCount(count: number): string {
  return GRID_BY_COUNT[count] ?? GRID_DEFAULT;
}

/** The highest column count `gridColumnsForCount` will ever ask for. */
export const MAX_GRID_COLUMNS = 5;
