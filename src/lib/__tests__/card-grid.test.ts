import { GRID_DEFAULT, MAX_GRID_COLUMNS, gridColumnsForCount } from '../card-grid';

/** Every `grid-cols-N` this class string declares, at any breakpoint. */
function declaredColumnCounts(classes: string): number[] {
  return [...classes.matchAll(/grid-cols-(\d+)/g)].map((match) => Number(match[1]));
}

/**
 * F4 — the root cause of the sparse rails.
 *
 * Both card grids were authored against a fixed item count, because the export
 * always had 5 popular tours. Withholding the three `pricingUnverified` tours
 * left 2, so a ≥1080px viewport drew a five-column grid with three empty
 * trailing columns and two cards stretched across the rest.
 */
describe('gridColumnsForCount', () => {
  it('never declares more columns than there are cards to put in them', () => {
    for (let count = 1; count <= MAX_GRID_COLUMNS + 3; count += 1) {
      for (const columns of declaredColumnCounts(gridColumnsForCount(count))) {
        expect(columns).toBeLessThanOrEqual(Math.max(count, 1));
      }
    }
  });

  it('gives the 2-card case a 2-column grid — the actual regression', () => {
    const classes = gridColumnsForCount(2);

    expect(declaredColumnCounts(classes)).toEqual([2]);
    expect(classes).not.toMatch(/grid-cols-5/);
  });

  it('caps a short row so two cards do not stretch into two posters', () => {
    expect(gridColumnsForCount(1)).toMatch(/max-w-/);
    expect(gridColumnsForCount(2)).toMatch(/max-w-/);
  });

  it('restores the original uncapped ladder at 5 or more, so nothing regresses when pricing is confirmed', () => {
    expect(gridColumnsForCount(5)).toBe(GRID_DEFAULT);
    expect(gridColumnsForCount(9)).toBe(GRID_DEFAULT);
    expect(GRID_DEFAULT).not.toMatch(/max-w-/);
  });

  it('survives an empty list rather than emitting a zero-column grid', () => {
    expect(declaredColumnCounts(gridColumnsForCount(0))).toEqual([1]);
  });

  it('emits full literal class names Tailwind can actually see', () => {
    // Interpolated class names (`grid-cols-${n}`) are invisible to Tailwind's
    // scanner and silently produce no CSS — which would look exactly like the
    // bug this helper fixes.
    for (let count = 0; count <= MAX_GRID_COLUMNS + 2; count += 1) {
      expect(gridColumnsForCount(count)).not.toMatch(/\$\{|undefined|NaN/);
      expect(gridColumnsForCount(count).trim()).not.toBe('');
    }
  });
});
