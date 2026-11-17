import { render, screen, within } from '@testing-library/react';

import { PopularDestinationsSection } from '../PopularDestinationsSection';
import { DestinationsRail } from '../InternationalDestinationsRail';
import type { CrmTourCard } from '@/server/crm/types';

/**
 * F4 — the rails render fewer cards than the design assumed, and the layout
 * never noticed.
 *
 * CRM-migration Step 2: `PackageRail` (the old 4-themed-rails component) is
 * gone — `/tour-packages` is now one server-filtered grid, not a rail
 * layout, so its own scroll-arrow behaviour has nothing left to test here.
 * What remains is `PopularDestinationsSection`'s adaptive grid/dots (Home)
 * and `DestinationsRail`'s measured-overflow scroll arrow (also Home;
 * brief §C2, 2026-11-14 repointed it at real International tours —
 * `category: 'International'` — after confirming `GET /public/places` has
 * no domestic/international field of its own).
 */

/** jsdom reports 0 for every layout measurement, so overflow must be simulated. */
function withRowOverflow(scrollWidth: number, clientWidth: number, body: () => void) {
  const original = {
    scrollWidth: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollWidth'),
    clientWidth: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth'),
  };

  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', { configurable: true, value: scrollWidth });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: clientWidth });

  try {
    body();
  } finally {
    if (original.scrollWidth) Object.defineProperty(HTMLElement.prototype, 'scrollWidth', original.scrollWidth);
    else Reflect.deleteProperty(HTMLElement.prototype, 'scrollWidth');
    if (original.clientWidth) Object.defineProperty(HTMLElement.prototype, 'clientWidth', original.clientWidth);
    else Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth');
  }
}

function tour(slug: string): CrmTourCard {
  return {
    slug,
    name: `Tour ${slug}`,
    category: 'Adventure',
    shortDescription: 'A trip.',
    coverImageUrl: 'https://res.cloudinary.com/tour-images/abc.jpg',
    price: { amount: 25000, currency: 'INR' },
    durationDays: 6,
    durationNights: 5,
    departureCity: null,
    primaryPlace: { name: 'Place', slug: 'place' },
    nextDeparture: null,
    hasBrochure: false,
  };
}

const fiveTours: CrmTourCard[] = ['a', 'b', 'c', 'd', 'e'].map((slug) => tour(slug));

function internationalTour(slug: string): CrmTourCard {
  return { ...tour(slug), category: 'International' };
}

/**
 * Round 3 (2026-11-17), Parts 1 / 1b / 2: both home tour rows are now ONE
 * shared horizontal scroll row (`TourRailSection`) instead of a wrapping
 * grid (Popular) and a separately-styled scroller (International). The dot
 * pagination stays gone — the arrows next to the heading are the control.
 */
describe('Popular Destinations renders one horizontal scroll row regardless of card count', () => {
  it('is a labelled, focusable list that scrolls sideways and snaps to card edges', () => {
    render(<PopularDestinationsSection tours={fiveTours} />);
    const row = screen.getByRole('list', { name: 'Popular Destinations tours' });

    expect(row).toBe(screen.getByTestId('popular-destinations-grid'));
    expect(row).toHaveAttribute('tabindex', '0');
    expect(row.className).toMatch(/overflow-x-auto/);
    expect(row.className).toMatch(/snap-x/);
    expect(row.className).toMatch(/snap-mandatory/);
    expect(row.className).toMatch(/no-scrollbar/);
    expect(row.className).not.toMatch(/grid-cols/);
  });

  it('sizes cards at ~66vw on mobile and 2 / 3 / 4 per view from 768px up', () => {
    render(<PopularDestinationsSection tours={fiveTours} />);
    const items = within(screen.getByTestId('popular-destinations-grid')).getAllByRole('listitem');

    expect(items).toHaveLength(5);
    for (const item of items) {
      expect(item).toHaveClass('snap-start', 'flex-none', 'w-[clamp(230px,66vw,280px)]');
      expect(item.className).toContain('md:w-[calc((100%-1.25rem)/2)]');
      expect(item.className).toContain('lg:w-[calc((100%-2.5rem)/3)]');
      expect(item.className).toContain('xl:w-[calc((100%-3.75rem)/4)]');
    }
  });

  it('renders one card link per tour, for a sparse list too', () => {
    const sparse = fiveTours.slice(0, 2);
    render(<PopularDestinationsSection tours={sparse} />);
    expect(within(screen.getByTestId('popular-destinations-grid')).getAllByRole('link')).toHaveLength(2);
  });

  it('renders no dot-pagination element at all', () => {
    render(<PopularDestinationsSection tours={fiveTours} />);
    expect(screen.queryByTestId('popular-destinations-dots')).not.toBeInTheDocument();
  });

  it('renders an empty row rather than crashing when there are no tours', () => {
    render(<PopularDestinationsSection tours={[]} />);
    expect(within(screen.getByTestId('popular-destinations-grid')).queryAllByRole('link')).toHaveLength(0);
  });

  it('keeps the "View all" link next to the heading', () => {
    render(<PopularDestinationsSection tours={fiveTours} />);
    expect(screen.getByRole('link', { name: /View All Tour Packages/ })).toHaveAttribute('href', '/tour-packages');
  });

  it('ends the row with a "View all tours" card only when the section has more tours than it shows', () => {
    const { unmount } = render(<PopularDestinationsSection tours={fiveTours} />);
    expect(screen.queryByRole('link', { name: 'View all tours' })).not.toBeInTheDocument();
    unmount();

    render(<PopularDestinationsSection tours={fiveTours} hasMore />);
    const row = screen.getByTestId('popular-destinations-grid');
    const items = within(row).getAllByRole('listitem');
    expect(items).toHaveLength(6);
    expect(within(items[5]).getByRole('link', { name: 'View all tours' })).toHaveAttribute('href', '/tour-packages');
  });
});

describe('Tour row arrows exist only when there is somewhere to scroll', () => {
  it('shows no arrows when every card fits', () => {
    render(<PopularDestinationsSection tours={fiveTours.slice(0, 4)} />);
    expect(screen.queryByRole('button', { name: /Previous/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Next/ })).not.toBeInTheDocument();
  });

  it('shows labelled previous / next arrows once the row overflows, with "previous" disabled at the start', () => {
    withRowOverflow(1400, 500, () => {
      render(<PopularDestinationsSection tours={fiveTours} />);
      expect(screen.getByRole('button', { name: 'Previous Popular Destinations tours' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Next Popular Destinations tours' })).toBeEnabled();
    });
  });

  it('moves by one full view per click', async () => {
    const scrollBy = jest.fn();
    const original = HTMLElement.prototype.scrollBy;
    HTMLElement.prototype.scrollBy = scrollBy as unknown as typeof HTMLElement.prototype.scrollBy;
    try {
      withRowOverflow(1400, 500, () => {
        render(<PopularDestinationsSection tours={fiveTours} />);
        screen.getByRole('button', { name: 'Next Popular Destinations tours' }).click();
      });
      // jsdom has no layout: padding and gap read as 0, so one view is the row's clientWidth.
      expect(scrollBy).toHaveBeenCalledWith({ left: 500, behavior: 'smooth' });
    } finally {
      HTMLElement.prototype.scrollBy = original;
    }
  });
});

/**
 * Brief §C2 (2026-11-14): this rail reads real International tours
 * (`category: 'International'`), not CRM places. Round 3, Part 2: it renders
 * through the same `TourRailSection` as Popular Destinations.
 */
describe('DestinationsRail shares the Popular Destinations row', () => {
  const internationalTours = [internationalTour('x'), internationalTour('y')];

  it('uses the same container, row and card-width classes as Popular Destinations', () => {
    const { unmount } = render(<PopularDestinationsSection tours={fiveTours} />);
    const popularRow = screen.getByTestId('popular-destinations-grid');
    const popularRowClass = popularRow.className;
    const popularItemClass = within(popularRow).getAllByRole('listitem')[0].className;
    const popularContainerClass = popularRow.closest('section')!.firstElementChild!.className;
    unmount();

    render(<DestinationsRail tours={internationalTours} />);
    const row = screen.getByRole('list', { name: 'International tours' });
    expect(row.className).toBe(popularRowClass);
    expect(within(row).getAllByRole('listitem')[0].className).toBe(popularItemClass);
    expect(screen.getByTestId('section-6b-destinations').firstElementChild!.className).toBe(popularContainerClass);
  });

  it('hides the arrows when the row fits on screen', () => {
    render(<DestinationsRail tours={internationalTours} />);
    expect(screen.queryByRole('button', { name: /International tours/ })).not.toBeInTheDocument();
  });

  it('shows them once the row genuinely overflows', () => {
    withRowOverflow(1400, 500, () => {
      render(<DestinationsRail tours={internationalTours} />);
      expect(screen.getByRole('button', { name: 'Next International tours' })).toBeInTheDocument();
    });
  });

  it('links "View all" to the international listing', () => {
    render(<DestinationsRail tours={internationalTours} />);
    expect(screen.getByRole('link', { name: /View All International Tours/ })).toHaveAttribute(
      'href',
      '/tour-packages?scope=international'
    );
  });

  it('renders nothing at all for an empty tour list', () => {
    const { container } = render(<DestinationsRail tours={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
