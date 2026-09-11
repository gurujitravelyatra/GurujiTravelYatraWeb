import { render, screen, within } from '@testing-library/react';

import { PopularDestinationsSection } from '../PopularDestinationsSection';
import { InternationalDestinationsRail } from '../InternationalDestinationsRail';
import { PackageRail } from '@/components/tour-packages/PackageRail';
import { publiclyListedPopular, publiclyListedRails } from '@/content/public-listing';
import { internationalDestinations } from '@/content/fixtures/international.fixture';
import { gridColumnsForCount } from '@/lib/card-grid';
import type { Package } from '@/content/types';

/**
 * F4 — the rails render fewer cards than the design assumed, and the layout
 * never noticed.
 *
 * Withholding the three `pricingUnverified` tours took Popular Destinations
 * from 5 cards to 2. The grid still declared five columns, the dot indicator
 * still drew five dots, and `PackageRail`'s scroll arrow still appeared for a
 * row with nothing to scroll. Each of those is a piece of UI asserting there is
 * more content than there is.
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

const TRENDING = publiclyListedRails.find((rail) => rail.title.includes('Trending'));

describe('Popular Destinations adapts to how many cards there actually are', () => {
  it('declares exactly as many grid columns as it has cards', () => {
    render(<PopularDestinationsSection packages={publiclyListedPopular} />);
    const grid = screen.getByTestId('popular-destinations-grid');

    expect(grid.className).toContain(gridColumnsForCount(publiclyListedPopular.length));
    for (const match of grid.className.matchAll(/grid-cols-(\d+)/g)) {
      expect(Number(match[1])).toBeLessThanOrEqual(publiclyListedPopular.length);
    }
  });

  it('no longer hardcodes the five-column ladder the design was drawn against', () => {
    // The live fixture currently yields 2 listable popular tours. If confirmed
    // pricing ever restores the other three, the assertion below flips
    // automatically — the point is that the grid tracks the data either way.
    expect(publiclyListedPopular.length).toBeLessThan(5);

    render(<PopularDestinationsSection packages={publiclyListedPopular} />);
    expect(screen.getByTestId('popular-destinations-grid').className).not.toMatch(/grid-cols-5/);
  });

  it('draws one dot per card, not a fixed five', () => {
    render(<PopularDestinationsSection packages={publiclyListedPopular} />);

    const dots = screen.getByTestId('popular-destinations-dots');
    const cards = within(screen.getByTestId('popular-destinations-grid')).getAllByRole('link');

    expect(dots.children).toHaveLength(publiclyListedPopular.length);
    expect(dots.children).toHaveLength(cards.length);
  });

  it('keeps grid and dots in step at any count', () => {
    const sample: Package[] = publiclyListedPopular.slice(0, 1);
    render(<PopularDestinationsSection packages={sample} />);

    expect(screen.getByTestId('popular-destinations-dots').children).toHaveLength(1);
    expect(screen.getByTestId('popular-destinations-grid').className).not.toMatch(/grid-cols-[2-9]/);
  });

  it('renders no dots at all for an empty list rather than a lone orphan dot', () => {
    render(<PopularDestinationsSection packages={[]} />);
    expect(screen.getByTestId('popular-destinations-dots').children).toHaveLength(0);
  });
});

describe('a rail offers a scroll arrow only when there is somewhere to scroll', () => {
  it('hides the arrow on the 2-card Trending rail, which fits on screen', () => {
    expect(TRENDING).toBeDefined();

    render(<PackageRail title={TRENDING!.title} items={TRENDING!.items} background="white" onViewAll={jest.fn()} />);

    expect(screen.queryByRole('button', { name: `Scroll ${TRENDING!.title}` })).not.toBeInTheDocument();
  });

  it('shows it again once the row genuinely overflows', () => {
    withRowOverflow(1200, 400, () => {
      render(<PackageRail title="Trending" items={TRENDING!.items} background="white" onViewAll={jest.fn()} />);
      expect(screen.getByRole('button', { name: 'Scroll Trending' })).toBeInTheDocument();
    });
  });

  it('treats a sub-pixel rounding difference as "fits", not as overflow', () => {
    withRowOverflow(400.5, 400, () => {
      render(<PackageRail title="Trending" items={TRENDING!.items} background="white" onViewAll={jest.fn()} />);
      expect(screen.queryByRole('button', { name: 'Scroll Trending' })).not.toBeInTheDocument();
    });
  });

  it('never offers the arrow for an empty rail', () => {
    withRowOverflow(1200, 400, () => {
      render(<PackageRail title="Trending" items={[]} background="white" onViewAll={jest.fn()} />);
      expect(screen.queryByRole('button', { name: 'Scroll Trending' })).not.toBeInTheDocument();
    });
  });

  it('applies the same rule to the International rail, which shrank for the same reason', () => {
    render(<InternationalDestinationsRail destinations={internationalDestinations} />);
    expect(screen.queryByRole('button', { name: /scroll international destinations/i })).not.toBeInTheDocument();

    withRowOverflow(1400, 500, () => {
      render(<InternationalDestinationsRail destinations={internationalDestinations} />);
      expect(screen.getAllByRole('button', { name: /scroll international destinations/i })[0]).toBeInTheDocument();
    });
  });
});
