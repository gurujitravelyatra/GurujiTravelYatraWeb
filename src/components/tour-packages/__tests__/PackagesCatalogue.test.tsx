import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PackagesCatalogue } from '../PackagesCatalogue';
import { getCategoryChips } from '@/content/get-category-chips';
import { publiclyListedRails, toursRenderedOnCataloguePage } from '@/content/public-listing';

const categories = getCategoryChips(publiclyListedRails);
const TOTAL = toursRenderedOnCataloguePage.length;

function renderCatalogue(props: Partial<React.ComponentProps<typeof PackagesCatalogue>> = {}) {
  return render(<PackagesCatalogue rails={publiclyListedRails} categories={categories} {...props} />);
}

/** jsdom does not implement scrollIntoView; the components legitimately call it. */
beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
  Element.prototype.scrollBy = jest.fn();
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PackagesCatalogue filtering', () => {
  it('starts unfiltered, listing every publicly-listed catalogue tour', () => {
    renderCatalogue();
    expect(screen.getByText(`${TOTAL} journeys found`)).toBeInTheDocument();
  });

  it('filters by category', async () => {
    const user = userEvent.setup();
    renderCatalogue();

    await user.click(screen.getByRole('button', { name: /^Beach$/ }));
    expect(screen.getByText('1 journey found')).toBeInTheDocument();
  });

  it('filters by destination through the real select', async () => {
    const user = userEvent.setup();
    renderCatalogue();

    await user.selectOptions(screen.getByLabelText('Destination'), 'maldives');

    expect(screen.getByText('1 journey found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Maldives Escape/ })).toBeInTheDocument();
  });

  it('combines both filters rather than letting one override the other', async () => {
    const user = userEvent.setup();
    renderCatalogue();

    await user.click(screen.getByRole('button', { name: /^International$/ }));
    await user.selectOptions(screen.getByLabelText('Destination'), 'dubai');

    expect(screen.getByText('1 journey found')).toBeInTheDocument();
  });

  it('shows the empty state when the combination matches nothing, instead of a misleading partial list', async () => {
    const user = userEvent.setup();
    renderCatalogue();

    await user.click(screen.getByRole('button', { name: /^Beach$/ }));
    await user.selectOptions(screen.getByLabelText('Destination'), 'maldives');

    expect(screen.getByText('0 journeys found')).toBeInTheDocument();
    expect(screen.getByText('No journeys match this filter yet.')).toBeInTheDocument();
  });
});

/** M2/M3 — deep links must land on real filtered results, not the full catalogue. */
describe('deep links from ?category= / ?destination=', () => {
  it('opens pre-filtered to a category', () => {
    renderCatalogue({ initialCategory: 'International' });

    expect(screen.getByRole('button', { name: /^International$/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByText('5 journeys found')).toBeInTheDocument();
  });

  it('opens pre-filtered to a destination', () => {
    renderCatalogue({ initialDestination: 'goa' });

    expect(screen.getByLabelText('Destination')).toHaveValue('goa');
    expect(screen.getByText('1 journey found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Goa Beach Holiday/ })).toBeInTheDocument();
  });

  it('ignores nothing — an omitted param simply means "All"', () => {
    renderCatalogue();

    expect(screen.getByRole('button', { name: /^All$/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Destination')).toHaveValue('All');
  });
});

/**
 * H4 — "View All Packages →" was a `<button type="button">` with no handler,
 * four times on this page: focusable, announced as actionable, inert.
 */
describe('rail "View All Packages" CTAs do real work', () => {
  it('clears every active filter and returns the visitor to the full list', async () => {
    const user = userEvent.setup();
    renderCatalogue({ initialCategory: 'International' });

    expect(screen.getByText('5 journeys found')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: /View All Packages/ })[0]);

    expect(screen.getByText(`${TOTAL} journeys found`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^All$/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Destination')).toHaveValue('All');
  });

  it('moves the visitor to the results rather than leaving the page where it was', async () => {
    const user = userEvent.setup();
    renderCatalogue();

    await user.click(screen.getAllByRole('button', { name: /View All Packages/ })[0]);

    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('every rail on the page has a working CTA, not just the first', async () => {
    const user = userEvent.setup();
    renderCatalogue({ initialDestination: 'goa' });

    const buttons = screen.getAllByRole('button', { name: /View All Packages/ });
    expect(buttons.length).toBeGreaterThan(0);

    for (const button of buttons) {
      await user.click(button);
      expect(screen.getByLabelText('Destination')).toHaveValue('All');
    }
  });
});

/** H4 — "Search Tours →" likewise had no handler at all. */
describe('"Search Tours" applies the current selection and shows the results', () => {
  it('is not inert — clicking it moves the visitor to the results', async () => {
    const user = userEvent.setup();
    renderCatalogue();

    await user.click(screen.getByRole('button', { name: /Search Tours/ }));

    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('leaves the active selection applied, rather than resetting it', async () => {
    const user = userEvent.setup();
    renderCatalogue({ initialCategory: 'Beach' });

    await user.click(screen.getByRole('button', { name: /Search Tours/ }));

    expect(screen.getByText('1 journey found')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Beach$/ })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('price readout tracks what is on screen', () => {
  it('reports the filtered range once a filter narrows the list', async () => {
    const user = userEvent.setup();
    renderCatalogue();

    expect(within(screen.getByTestId('filter-price-range')).getByText('₹12,800 — ₹78,500')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^International$/ }));

    expect(within(screen.getByTestId('filter-price-range')).getByText('₹54,800 — ₹78,500')).toBeInTheDocument();
  });
});
