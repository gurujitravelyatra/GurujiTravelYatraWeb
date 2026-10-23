import { render, screen } from '@testing-library/react';

import { PackageCard } from '../PackageCard';
import type { Package } from '@/content/types';

const basePackage: Package = {
  slug: 'spiti-valley-circuit',
  name: 'Spiti Valley Circuit',
  destinationSlug: 'spiti-valley',
  destinationName: 'Spiti Valley',
  category: 'Adventure',
  durationLabel: '9 Days 8 Nights',
  subtitle: 'Shimla - Kaza - Chandratal',
  photoUrl: 'Spiti Valley',
  photosCount: 14,
  priceFrom: '₹42,500',
  priceWas: '₹47,700',
  savingsLabel: '5,200',
  // Required on `Package` (see the note on the field). A card only ever renders
  // a tour that already passed the public-listing gate, so PUBLISHED is the only
  // state this component is ever handed.
  status: 'PUBLISHED',
};

describe('PackageCard', () => {
  it('renders name, price, duration and savings from the Package fixture', () => {
    render(<PackageCard package={basePackage} />);

    expect(screen.getByText('Spiti Valley Circuit')).toBeInTheDocument();
    expect(screen.getByText('₹42,500')).toBeInTheDocument();
    expect(screen.getByText('₹47,700')).toBeInTheDocument();
    expect(screen.getByText('9 Days 8 Nights')).toBeInTheDocument();
    expect(screen.getByText('Save ₹5,200')).toBeInTheDocument();
    expect(screen.getByText('14 Photos')).toBeInTheDocument();
    expect(screen.getByText('Adventure')).toBeInTheDocument();
  });

  it('omits the savings pill when the package has no savingsLabel', () => {
    const noSavings: Package = { ...basePackage, savingsLabel: undefined };
    render(<PackageCard package={noSavings} />);

    expect(screen.queryByText(/^Save ₹/)).not.toBeInTheDocument();
  });

  it('links to the /tour-packages/{slug} detail route (BLOCKERS.md Decision D)', () => {
    render(<PackageCard package={basePackage} />);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/tour-packages/spiti-valley-circuit');
  });

  /**
   * CRM-migration decision 1: the public-listing gate no longer withholds a
   * tour for an unconfirmed price, so a card may now reach this component
   * with a missing/zero `priceFrom` (today only via a hand-edited row;
   * tomorrow via a CRM response with `price: null`/`{amount: 0}`). It must
   * render "Price on request" with a real call-to-action, never "₹0" or a
   * blank figure, and it must not pair a "Save ₹X" badge with no real price.
   */
  it.each([
    ['a missing price', undefined],
    ['an empty price', ''],
    ['a price that reads as zero', '₹0'],
  ])('renders "Price on request" instead of "₹0"/blank for %s', (_label, priceFrom) => {
    const unpriced: Package = { ...basePackage, priceFrom: priceFrom as string };
    render(<PackageCard package={unpriced} />);

    expect(screen.getByText('Price on request')).toBeInTheDocument();
    expect(screen.queryByText('₹0')).not.toBeInTheDocument();
    expect(screen.queryByText('Spiti Valley Circuit')).toBeInTheDocument(); // the rest of the card still renders
    // No fabricated saving beside a price the card is not showing.
    expect(screen.queryByText(/^Save ₹/)).not.toBeInTheDocument();
    // The phone/WhatsApp facts are still there, as plain text — never a
    // SECOND link nested inside the card's own outer <Link> (BLOCKERS.md
    // Decision E: every element in this card but the outer link is
    // non-interactive, by construction).
    expect(screen.getByText(/Call \+91 90999 57658/)).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('still renders the real price and savings badge once a confirmed price exists', () => {
    render(<PackageCard package={basePackage} />);

    expect(screen.queryByText('Price on request')).not.toBeInTheDocument();
    expect(screen.getByText('₹42,500')).toBeInTheDocument();
    expect(screen.getByText('Save ₹5,200')).toBeInTheDocument();
  });

  it('contains no nested interactive element — heart, category pill and photo-count badge are not buttons or links (BLOCKERS.md Decision E)', () => {
    const { container } = render(<PackageCard package={basePackage} />);

    // Exactly one focusable/interactive element in the whole card: the
    // outer <Link>. If the heart/pill/badge were buttons or links, this
    // would find more than one.
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.queryAllByRole('button')).toHaveLength(0);

    // Belt-and-suspenders: assert directly that no <button> element exists
    // anywhere inside the rendered card.
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });
});
