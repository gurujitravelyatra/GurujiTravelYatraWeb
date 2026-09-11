import { aboutMilestones } from '../fixtures/about.fixture';

/**
 * Guards `about.fixture.ts`. Every milestone quotes a contested figure or an
 * unconfirmed company-history claim (see the fixture's doc comment), so
 * `isPlaceholder` is not incidental here — it is the whole reason these
 * records are allowed to ship at all (BLOCKERS.md Decision H). If any
 * milestone ever loses the flag, this must fail loudly.
 */
describe('aboutMilestones fixture', () => {
  it('holds exactly 4 records', () => {
    expect(aboutMilestones).toHaveLength(4);
  });

  it('flags every single milestone isPlaceholder === true', () => {
    expect(aboutMilestones).toHaveLength(4);
    for (const milestone of aboutMilestones) {
      expect(milestone.isPlaceholder).toBe(true);
    }
  });

  it('never lets a milestone ship unflagged (invariant, not incidental)', () => {
    const unflagged = aboutMilestones.filter((milestone) => milestone.isPlaceholder !== true);
    expect(unflagged).toEqual([]);
  });

  it('gives every milestone a non-empty year and description', () => {
    for (const milestone of aboutMilestones) {
      expect(milestone.year.length).toBeGreaterThan(0);
      expect(milestone.description.length).toBeGreaterThan(0);
    }
  });
});
