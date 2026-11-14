import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PackagesFilterBar } from '../PackagesFilterBar';
import type { CrmCategory, CrmPlace } from '@/server/crm/types';

// `PackagesCatalogue` (the real caller) always drops 'International' from
// this prop before it reaches here — it is superseded by the "Destination
// type" scope toggle (brief §C2, 2026-11-14) — so this fixture mirrors what
// `PackagesFilterBar` actually ever receives in the app, not the full CRM
// taxonomy.
const categories: CrmCategory[] = ['Spiritual', 'Adventure', 'Family', 'Group'];
const places: CrmPlace[] = [
  {
    name: 'Maldives',
    slug: 'maldives',
    region: 'Indian Ocean',
    description: 'd',
    imageUrl: 'https://res.cloudinary.com/place-images/maldives.jpg',
    showInCustomBuilder: true,
    liveTourCount: 1,
  },
  {
    name: 'Goa',
    slug: 'goa',
    region: 'West India',
    description: 'd',
    imageUrl: 'https://res.cloudinary.com/place-images/goa.jpg',
    showInCustomBuilder: true,
    liveTourCount: 2,
  },
];
const months = ['2026-07', '2026-08'];

/**
 * CRM-migration Step 2: every filter in `PackagesFilterBar` now maps 1:1 to
 * a `GET /public/tours` query parameter and is reported up via a callback —
 * the parent (`PackagesCatalogue`) is the one that navigates. There is no
 * more "Search Tours" commit button or price-range readout field in this
 * component; each select already applies on change.
 */
function renderBar(overrides: Partial<React.ComponentProps<typeof PackagesFilterBar>> = {}) {
  const props = {
    categories,
    selectedCategory: 'All' as const,
    onSelectCategory: jest.fn(),
    places,
    selectedPlace: 'All' as const,
    onSelectPlace: jest.fn(),
    months,
    selectedMonth: 'All' as const,
    onSelectMonth: jest.fn(),
    selectedScope: 'All' as const,
    onSelectScope: jest.fn(),
    visibleCount: 12,
    totalCount: 12,
    onClear: jest.fn(),
    ...overrides,
  };
  render(<PackagesFilterBar {...props} />);
  return props;
}

describe('PackagesFilterBar', () => {
  it('renders a chip for every CRM category, plus All', () => {
    renderBar();
    const categoryGroup = screen.getByRole('group', { name: 'Filter by travel category' });

    expect(within(categoryGroup).getByRole('button', { name: 'All' })).toBeInTheDocument();
    for (const category of categories) {
      expect(within(categoryGroup).getByRole('button', { name: category })).toBeInTheDocument();
    }
  });

  it('toggles aria-pressed correctly as the selected chip changes', () => {
    renderBar({ selectedCategory: 'Family' });

    const categoryGroup = screen.getByRole('group', { name: 'Filter by travel category' });
    expect(within(categoryGroup).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(categoryGroup).getByRole('button', { name: 'Family' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls onSelectCategory with the clicked category', async () => {
    const user = userEvent.setup();
    const { onSelectCategory } = renderBar();

    await user.click(within(screen.getByRole('group', { name: 'Filter by travel category' })).getByRole('button', { name: 'Family' }));
    expect(onSelectCategory).toHaveBeenCalledWith('Family');
  });

  /**
   * Brief §C2 (2026-11-14): the audit found no CRM domestic/international
   * flag anywhere except the `International` tour category itself — this
   * toggle IS that category, surfaced as its own control rather than one
   * chip buried among five.
   */
  describe('destination-type scope toggle', () => {
    it('renders All/Domestic/International, reporting the clicked one', async () => {
      const user = userEvent.setup();
      const { onSelectScope } = renderBar();
      const scopeGroup = screen.getByRole('group', { name: 'Filter by domestic or international' });

      for (const label of ['All', 'Domestic', 'International']) {
        expect(within(scopeGroup).getByRole('button', { name: label })).toBeInTheDocument();
      }

      await user.click(within(scopeGroup).getByRole('button', { name: 'International' }));
      expect(onSelectScope).toHaveBeenCalledWith('International');
    });

    it('marks the active scope chip pressed', () => {
      renderBar({ selectedScope: 'Domestic' });
      const scopeGroup = screen.getByRole('group', { name: 'Filter by domestic or international' });

      expect(within(scopeGroup).getByRole('button', { name: 'Domestic' })).toHaveAttribute('aria-pressed', 'true');
      expect(within(scopeGroup).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('hides the category chips while International scope is active — the scope already pins the category', () => {
      renderBar({ selectedScope: 'International' });
      expect(screen.queryByRole('group', { name: 'Filter by travel category' })).not.toBeInTheDocument();
    });
  });

  it('announces the visible/total count via an aria-live region', () => {
    renderBar({ visibleCount: 3, totalCount: 12 });
    expect(screen.getByText('3 of 12 journeys')).toBeInTheDocument();
  });

  it('the destination select offers every CRM place and reports a real selection', async () => {
    const user = userEvent.setup();
    const { onSelectPlace } = renderBar();

    const select = screen.getByLabelText('Destination');
    expect(select).toBeEnabled();

    await user.selectOptions(select, 'maldives');
    expect(onSelectPlace).toHaveBeenCalledWith('maldives');

    for (const place of places) {
      expect(screen.getByRole('option', { name: place.name })).toBeInTheDocument();
    }
  });

  /**
   * CRM-migration Step 2: the month filter used to be permanently disabled
   * ("there is no departure-date or availability data anywhere in the
   * system"). The CRM provides exactly that (`GET /public/departures`'s
   * `months` list), so it is a real, working select now.
   */
  it('the travel-month select is a real, enabled control offering the CRM-provided months', async () => {
    const user = userEvent.setup();
    const { onSelectMonth } = renderBar();

    const select = screen.getByLabelText('Travel month');
    expect(select).toBeEnabled();
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument();

    await user.selectOptions(select, '2026-07');
    expect(onSelectMonth).toHaveBeenCalledWith('2026-07');

    for (const month of months) {
      expect(screen.getByRole('option', { name: month })).toBeInTheDocument();
    }
  });

  it('Clear calls the onClear handler', async () => {
    const user = userEvent.setup();
    const { onClear } = renderBar();

    await user.click(screen.getByRole('button', { name: /Clear/ }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
