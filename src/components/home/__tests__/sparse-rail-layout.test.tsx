import { render, screen, within } from '@testing-library/react';

import { PopularDestinationsSection } from '../PopularDestinationsSection';
import { DestinationsRail } from '../InternationalDestinationsRail';
import { gridColumnsForCount } from '@/lib/card-grid';
import type { CrmPlace, CrmTourCard } from '@/server/crm/types';

/**
 * F4 — the rails render fewer cards than the design assumed, and the layout
 * never noticed.
 *
 * CRM-migration Step 2: `PackageRail` (the old 4-themed-rails component) is
 * gone — `/tour-packages` is now one server-filtered grid, not a rail
 * layout, so its own scroll-arrow behaviour has nothing left to test here.
 * What remains is `PopularDestinationsSection`'s adaptive grid/dots (Home)
 * and `DestinationsRail`'s measured-overflow scroll arrow (also Home,
 * renamed from "International Destinations" — CRM-migration Step 2 removed
 * the fixture-only `isInternational` curation flag this rail used to filter
 * by, since `GET /public/places` has no such field).
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

const fiveTours: CrmTourCard[] = ['a', 'b', 'c', 'd', 'e'].map(tour);

function place(slug: string): CrmPlace {
  return {
    name: `Place ${slug}`,
    slug,
    region: 'Region',
    description: 'A place.',
    imageUrl: 'https://res.cloudinary.com/place-images/abc.jpg',
    showInCustomBuilder: true,
    liveTourCount: 1,
  };
}

describe('Popular Destinations adapts to how many cards there actually are', () => {
  it('declares exactly as many grid columns as it has cards', () => {
    render(<PopularDestinationsSection tours={fiveTours} />);
    const grid = screen.getByTestId('popular-destinations-grid');

    expect(grid.className).toContain(gridColumnsForCount(fiveTours.length));
    for (const match of grid.className.matchAll(/grid-cols-(\d+)/g)) {
      expect(Number(match[1])).toBeLessThanOrEqual(fiveTours.length);
    }
  });

  it('does not hardcode the five-column ladder the design was drawn against', () => {
    const sparse = fiveTours.slice(0, 2);
    render(<PopularDestinationsSection tours={sparse} />);
    expect(screen.getByTestId('popular-destinations-grid').className).not.toMatch(/grid-cols-5/);
  });

  it('draws one dot per card, not a fixed five', () => {
    render(<PopularDestinationsSection tours={fiveTours} />);

    const dots = screen.getByTestId('popular-destinations-dots');
    const cards = within(screen.getByTestId('popular-destinations-grid')).getAllByRole('link');

    expect(dots.children).toHaveLength(fiveTours.length);
    expect(dots.children).toHaveLength(cards.length);
  });

  it('keeps grid and dots in step at any count', () => {
    render(<PopularDestinationsSection tours={fiveTours.slice(0, 1)} />);

    expect(screen.getByTestId('popular-destinations-dots').children).toHaveLength(1);
    expect(screen.getByTestId('popular-destinations-grid').className).not.toMatch(/grid-cols-[2-9]/);
  });

  it('renders no dots at all for an empty list rather than a lone orphan dot', () => {
    render(<PopularDestinationsSection tours={[]} />);
    expect(screen.getByTestId('popular-destinations-dots').children).toHaveLength(0);
  });
});

describe('DestinationsRail offers a scroll arrow only when there is somewhere to scroll', () => {
  const places = [place('a'), place('b')];

  it('hides the arrow when the row fits on screen', () => {
    render(<DestinationsRail places={places} />);
    expect(screen.queryByRole('button', { name: /scroll destinations/i })).not.toBeInTheDocument();
  });

  it('shows it once the row genuinely overflows', () => {
    withRowOverflow(1400, 500, () => {
      render(<DestinationsRail places={places} />);
      expect(screen.getByRole('button', { name: /scroll destinations/i })).toBeInTheDocument();
    });
  });

  it('renders nothing at all for an empty place list', () => {
    const { container } = render(<DestinationsRail places={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
