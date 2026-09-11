import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PackagesFilterBar } from '../PackagesFilterBar';
import { getCategoryChips } from '@/content/get-category-chips';
import {
  getDestinationOptions,
  getPriceRange,
  publiclyListedRails,
  toursRenderedOnCataloguePage,
} from '@/content/public-listing';

const categories = getCategoryChips(publiclyListedRails);
const destinations = getDestinationOptions(toursRenderedOnCataloguePage);

function renderBar(overrides: Partial<React.ComponentProps<typeof PackagesFilterBar>> = {}) {
  const props = {
    categories,
    selected: 'All' as const,
    onSelect: jest.fn(),
    visibleCount: toursRenderedOnCataloguePage.length,
    destinations,
    selectedDestination: 'All' as const,
    onSelectDestination: jest.fn(),
    onSearch: jest.fn(),
    priceRangeLabel: getPriceRange(toursRenderedOnCataloguePage)?.label,
    ...overrides,
  };
  render(<PackagesFilterBar {...props} />);
  return props;
}

describe('PackagesFilterBar', () => {
  it('renders the chip list derived from fixture data — no Honeymoon/Wildlife, includes International and Beach', () => {
    renderBar();

    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'International' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Beach' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Honeymoon' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Wildlife' })).not.toBeInTheDocument();
  });

  it('toggles aria-pressed correctly as the selected chip changes', () => {
    renderBar({ selected: 'International' });

    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'International' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls onSelect with the clicked category', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderBar();

    await user.click(screen.getByRole('button', { name: 'Beach' }));
    expect(onSelect).toHaveBeenCalledWith('Beach');
  });

  it('announces the visible count via an aria-live region', () => {
    renderBar({ selected: 'Beach', visibleCount: 1 });
    expect(screen.getByText('1 journey found')).toBeInTheDocument();
  });

  /**
   * H4: "Search Tours" was `<button type="button">` with no `onClick` at all —
   * focusable, announced as actionable, doing nothing. Same for "Clear"'s
   * destination half once a second filter existed.
   */
  describe('primary CTAs do real work (no inert buttons)', () => {
    it('Search Tours invokes the search handler', async () => {
      const user = userEvent.setup();
      const { onSearch } = renderBar();

      await user.click(screen.getByRole('button', { name: /Search Tours/ }));

      expect(onSearch).toHaveBeenCalledTimes(1);
    });

    it('Search Tours is not a no-op — it has a real onClick handler bound', () => {
      const { onSearch } = renderBar();
      const button = screen.getByRole('button', { name: /Search Tours/ });

      // Fire a raw click rather than going through user-event, so this fails
      // loudly if the handler is ever dropped from the element itself.
      button.click();
      expect(onSearch).toHaveBeenCalled();
    });

    it('Clear resets BOTH filters, not just the category', async () => {
      const user = userEvent.setup();
      const { onSelect, onSelectDestination } = renderBar({ selected: 'Beach', selectedDestination: 'goa' });

      await user.click(screen.getByRole('button', { name: /Clear/ }));

      expect(onSelect).toHaveBeenCalledWith('All');
      expect(onSelectDestination).toHaveBeenCalledWith('All');
    });
  });

  /** M6 — controls must not present as functional unless they are. */
  describe('field honesty', () => {
    it('the destination field is a real select, offering only destinations that have journeys', async () => {
      const user = userEvent.setup();
      const { onSelectDestination } = renderBar();

      const select = screen.getByLabelText('Destination');
      expect(select).toBeEnabled();

      await user.selectOptions(select, 'maldives');
      expect(onSelectDestination).toHaveBeenCalledWith('maldives');

      // Derived, so a destination with zero tours cannot be offered. Malaysia
      // is the regression case: the export listed it, no tour goes there.
      expect(screen.queryByRole('option', { name: 'Malaysia' })).not.toBeInTheDocument();
      for (const destination of destinations) {
        expect(screen.getByRole('option', { name: destination.name })).toBeInTheDocument();
      }
    });

    it('marks the unwired travel-month field aria-disabled with a visible "coming soon"', () => {
      renderBar();
      const field = screen.getByTestId('filter-travel-month');

      expect(field).toHaveAttribute('aria-disabled', 'true');
      expect(field).toHaveTextContent(/coming soon/i);
    });

    it('shows the REAL price bounds of the listed journeys, never a hardcoded band', () => {
      renderBar();

      const range = getPriceRange(toursRenderedOnCataloguePage);
      expect(range).toBeDefined();
      expect(screen.getByTestId('filter-price-range')).toHaveTextContent(range!.label);

      // The old hardcoded label excluded both the cheapest and the priciest
      // journey on the site.
      expect(screen.queryByText(/₹15,000 — ₹75,000/)).not.toBeInTheDocument();
      expect(range!.min).toBeLessThanOrEqual(12800);
      expect(range!.max).toBeGreaterThanOrEqual(78500);
    });
  });
});
