import { getCategoryChips } from '../get-category-chips';
import { packageRails } from '../fixtures/packages.fixture';
import type { PackageRail } from '../types';

describe('getCategoryChips', () => {
  it('derives chips from the real fixture data (BLOCKERS.md Decision C)', () => {
    const chips = getCategoryChips(packageRails);

    expect(chips).toContain('International');
    expect(chips).toContain('Beach');
    expect(chips).not.toContain('Honeymoon');
    expect(chips).not.toContain('Wildlife');
  });

  it('produces no chip for a hypothetical category with zero matching items', () => {
    const railsWithoutMatches: PackageRail[] = [
      { title: 'Empty rail', items: [] },
      {
        title: 'Some rail',
        items: [
          {
            slug: 'a',
            name: 'A',
            destinationSlug: 'a',
            category: 'Adventure',
            durationLabel: '1 Day',
            subtitle: 'sub',
            photoUrl: 'a',
            photosCount: 1,
            priceFrom: '₹1',
          },
        ],
      },
    ];

    const chips = getCategoryChips(railsWithoutMatches);
    expect(chips).toEqual(['Adventure']);
  });

  it('returns an empty list for no rails/items', () => {
    expect(getCategoryChips([])).toEqual([]);
  });

  it('never returns a duplicate category', () => {
    const chips = getCategoryChips(packageRails);
    expect(new Set(chips).size).toBe(chips.length);
  });
});
