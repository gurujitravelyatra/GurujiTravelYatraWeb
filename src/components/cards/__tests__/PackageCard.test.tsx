import { render, screen } from '@testing-library/react';

import { PackageCard } from '../PackageCard';
import type { Package } from '@/content/types';

const basePackage: Package = {
  slug: 'spiti-valley-circuit',
  name: 'Spiti Valley Circuit',
  destinationSlug: 'spiti-valley',
  category: 'Adventure',
  durationLabel: '9 Days 8 Nights',
  subtitle: 'Shimla - Kaza - Chandratal',
  photoUrl: 'Spiti Valley',
  photosCount: 14,
  priceFrom: '₹42,500',
  priceWas: '₹47,700',
  savingsLabel: '5,200',
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
