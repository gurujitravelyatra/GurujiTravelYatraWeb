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
 * "Redux" redesign (brief §6, 2026-11-14) REQUIRED CHANGE: a fixed
 * responsive grid (1 col / 2 / 3 / 4 at ≥1280px) replaces the item-count-
 * driven `gridColumnsForCount` ladder this file used to assert here — that
 * helper (and its own test coverage in card-grid.test.ts) still exists
 * unchanged for `/tour-packages`' grid, which is out of scope this round.
 * The dot pagination is gone outright per the brief: "Dots under the grid
 * in the reference are decorative; omit them unless a real carousel is
 * used" — this grid never was a carousel.
 */
describe('Popular Destinations renders a fixed responsive grid regardless of card count', () => {
  it('always declares the same responsive column classes', () => {
    render(<PopularDestinationsSection tours={fiveTours} />);
    const grid = screen.getByTestId('popular-destinations-grid');

    expect(grid.className).toMatch(/sm:grid-cols-2/);
    expect(grid.className).toMatch(/lg:grid-cols-3/);
    expect(grid.className).toMatch(/xl:grid-cols-4/);
  });

  it('renders one card per tour, for a sparse list too', () => {
    const sparse = fiveTours.slice(0, 2);
    render(<PopularDestinationsSection tours={sparse} />);
    expect(within(screen.getByTestId('popular-destinations-grid')).getAllByRole('link')).toHaveLength(2);
  });

  it('renders no dot-pagination element at all', () => {
    render(<PopularDestinationsSection tours={fiveTours} />);
    expect(screen.queryByTestId('popular-destinations-dots')).not.toBeInTheDocument();
  });

  it('renders an empty grid rather than crashing when there are no tours', () => {
    render(<PopularDestinationsSection tours={[]} />);
    expect(within(screen.getByTestId('popular-destinations-grid')).queryAllByRole('link')).toHaveLength(0);
  });
});

/**
 * Brief §C2 (2026-11-14): this rail now reads real International tours
 * (`category: 'International'`), not CRM places — see
 * `InternationalDestinationsRail`'s own header for the audit behind that.
 */
describe('DestinationsRail offers a scroll arrow only when there is somewhere to scroll', () => {
  const internationalTours = [internationalTour('x'), internationalTour('y')];

  it('hides the arrow when the row fits on screen', () => {
    render(<DestinationsRail tours={internationalTours} />);
    expect(screen.queryByRole('button', { name: /scroll destinations/i })).not.toBeInTheDocument();
  });

  it('shows it once the row genuinely overflows', () => {
    withRowOverflow(1400, 500, () => {
      render(<DestinationsRail tours={internationalTours} />);
      expect(screen.getByRole('button', { name: /scroll destinations/i })).toBeInTheDocument();
    });
  });

  it('renders nothing at all for an empty tour list', () => {
    const { container } = render(<DestinationsRail tours={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
