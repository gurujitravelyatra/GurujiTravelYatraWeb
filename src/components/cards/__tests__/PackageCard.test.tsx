import { render, screen } from '@testing-library/react';

import { PackageCard } from '../PackageCard';
import type { CrmTourCard } from '@/server/crm/types';

const baseTour: CrmTourCard = {
  slug: 'spiti-valley-circuit',
  name: 'Spiti Valley Circuit',
  category: 'Adventure',
  shortDescription: 'Shimla - Kaza - Chandratal',
  coverImageUrl: 'https://res.cloudinary.com/tour-images/spiti.jpg',
  price: { amount: 42500, currency: 'INR' },
  durationDays: 9,
  durationNights: 8,
  departureCity: null,
  primaryPlace: { name: 'Spiti Valley', slug: 'spiti-valley' },
  nextDeparture: { date: '2026-07-01', seatsLeft: 8 },
  hasBrochure: true,
};

describe('PackageCard', () => {
  it('renders name, price and duration from the CRM tour card', () => {
    render(<PackageCard tour={baseTour} />);

    expect(screen.getByText('Spiti Valley Circuit')).toBeInTheDocument();
    expect(screen.getByText('₹42,500')).toBeInTheDocument();
    expect(screen.getByText('9 Days 8 Nights')).toBeInTheDocument();
    expect(screen.getByText('Adventure')).toBeInTheDocument();
  });

  it('never renders a struck-through "was" price or a "Save ₹X" badge — the CRM has no such fields', () => {
    render(<PackageCard tour={baseTour} />);

    expect(screen.queryByText(/^Save ₹/)).not.toBeInTheDocument();
    expect(screen.queryByText(/line-through/)).not.toBeInTheDocument();
  });

  it('shows remaining seats when a next departure exists', () => {
    render(<PackageCard tour={baseTour} />);
    expect(screen.getByText('8 seats left')).toBeInTheDocument();
  });

  it('shows nothing extra when there is no next departure', () => {
    render(<PackageCard tour={{ ...baseTour, nextDeparture: null }} />);
    expect(screen.queryByText(/seats left/)).not.toBeInTheDocument();
  });

  /**
   * CRM-migration decision 1's rider, still true under the CRM shape: a
   * price that is missing or reads as zero must render "Price on request",
   * never "₹0" or a blank figure.
   */
  it.each([
    ['a zero amount', { amount: 0, currency: 'INR' }],
    ['a negative amount', { amount: -100, currency: 'INR' }],
  ])('renders "Price on request" for %s', (_label, price) => {
    render(<PackageCard tour={{ ...baseTour, price }} />);

    expect(screen.getByText('Price on request')).toBeInTheDocument();
    expect(screen.queryByText('₹0')).not.toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(1); // no nested <a> inside the card's own link
  });

  it('links to the /tour-packages/{slug} detail route (BLOCKERS.md Decision D)', () => {
    render(<PackageCard tour={baseTour} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/tour-packages/spiti-valley-circuit');
  });

  it('contains no nested interactive element (BLOCKERS.md Decision E)', () => {
    const { container } = render(<PackageCard tour={baseTour} />);

    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });
});
