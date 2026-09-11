import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PackagesCatalogue } from '../PackagesCatalogue';
import { getCategoryChips } from '@/content/get-category-chips';
import { publiclyListedRails, toursRenderedOnCataloguePage } from '@/content/public-listing';
import { gridColumnsForCount } from '@/lib/card-grid';

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

/**
 * F6 — a deep link that worked looked like a page that did not.
 *
 * The four themed rails each filtered independently, so
 * `/tour-packages?destination=goa` rendered the one matching card inside the
 * rail that happened to contain it, plus THREE "No journeys match this filter
 * yet." boxes for the rails that did not. Filtering is now a single
 * consolidated results section; the rails are reserved for the unfiltered
 * browsing view they exist for.
 */
describe('a filtered view renders ONE results section, not four near-empty rails', () => {
  const EMPTY_RAIL_COPY = /No journeys match this filter yet\./;

  it('renders exactly one results section and zero empty-rail boxes for a single-destination deep link', () => {
    renderCatalogue({ initialDestination: 'goa' });

    expect(screen.getAllByTestId('packages-filtered-results')).toHaveLength(1);
    expect(screen.queryAllByText(EMPTY_RAIL_COPY)).toHaveLength(0);
    expect(screen.getByRole('link', { name: /Goa Beach Holiday/ })).toBeInTheDocument();
  });

  it('shows every match in that one section, and nothing else', () => {
    renderCatalogue({ initialCategory: 'International' });

    const results = screen.getByTestId('packages-filtered-results');
    const expected = toursRenderedOnCataloguePage.filter((tour) => tour.category === 'International');

    expect(within(results).getAllByRole('link')).toHaveLength(expected.length);
    expect(screen.queryAllByText(EMPTY_RAIL_COPY)).toHaveLength(0);
  });

  it('titles the section from the active filter, naming only real derived values', () => {
    renderCatalogue({ initialDestination: 'goa' });
    expect(screen.getByRole('heading', { name: 'Journeys in Goa' })).toBeInTheDocument();

    cleanup();
    renderCatalogue({ initialCategory: 'International' });
    expect(screen.getByRole('heading', { name: 'International journeys' })).toBeInTheDocument();

    cleanup();
    renderCatalogue({ initialCategory: 'International', initialDestination: 'dubai' });
    expect(screen.getByRole('heading', { name: 'International journeys in Dubai' })).toBeInTheDocument();
  });

  it('sizes the results grid to the number of matches, so one card does not sit in a five-column row', () => {
    renderCatalogue({ initialDestination: 'goa' });

    const grid = screen.getByTestId('filtered-results-grid');
    expect(grid.className).toContain(gridColumnsForCount(1));
    expect(grid.className).not.toMatch(/grid-cols-[2-9]/);
  });

  it('keeps the four rails for the unfiltered default view', () => {
    renderCatalogue();

    expect(screen.queryByTestId('packages-filtered-results')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /View All Packages/ })).toHaveLength(publiclyListedRails.length);
  });

  it('switches to the consolidated view when the visitor clicks a chip, not only on deep links', async () => {
    const user = userEvent.setup();
    renderCatalogue();

    expect(screen.queryByTestId('packages-filtered-results')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Beach$/ }));

    // Clicking "Beach" used to produce 1 card and 3 empty-state boxes — the
    // same defect as the deep link, reached a different way.
    expect(screen.getAllByTestId('packages-filtered-results')).toHaveLength(1);
    expect(screen.queryAllByText(EMPTY_RAIL_COPY)).toHaveLength(0);
  });

  it('returns to the four-rail view when the filters are cleared', async () => {
    const user = userEvent.setup();
    renderCatalogue({ initialCategory: 'International' });

    await user.click(screen.getByRole('button', { name: /View All Packages/ }));

    expect(screen.queryByTestId('packages-filtered-results')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /View All Packages/ })).toHaveLength(publiclyListedRails.length);
  });

  it('still shows the single catalogue-level empty state when nothing matches at all', async () => {
    const user = userEvent.setup();
    renderCatalogue();

    await user.click(screen.getByRole('button', { name: /^Beach$/ }));
    await user.selectOptions(screen.getByLabelText('Destination'), 'maldives');

    expect(screen.queryByTestId('packages-filtered-results')).not.toBeInTheDocument();
    expect(screen.getAllByText(EMPTY_RAIL_COPY)).toHaveLength(1);
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
