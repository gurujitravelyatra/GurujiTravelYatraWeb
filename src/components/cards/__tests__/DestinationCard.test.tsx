import { render, screen } from '@testing-library/react';

import { DestinationCard } from '../DestinationCard';
import type { CrmPlace } from '@/server/crm/types';

const place: CrmPlace = {
  name: 'Maldives',
  slug: 'maldives',
  region: 'Indian Ocean',
  description: 'Overwater villas and turquoise lagoons.',
  imageUrl: 'https://res.cloudinary.com/place-images/maldives.jpg',
  showInCustomBuilder: true,
  liveTourCount: 2,
};

describe('DestinationCard', () => {
  it('renders the place name over the overlay exactly once to assistive tech', () => {
    render(<DestinationCard place={place} />);

    // `photoKey` (the placeholder fallback) is also the place name here, so the
    // name could appear twice in the DOM — once as PhotoPlaceholder's decorative
    // caption (aria-hidden, only rendered when there's no real image) and once
    // as the visible overlay label. With a real `imageUrl`, only the overlay
    // label renders.
    const exposed = screen.getAllByText('Maldives').filter((el) => !el.closest('[aria-hidden="true"]'));
    expect(exposed).toHaveLength(1);
  });

  it('links to the place-filtered catalogue using the CRM contract\'s own query param name', () => {
    render(<DestinationCard place={place} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/tour-packages?place=maldives');
  });

  it('renders no price, heart, or category elements (guards against merging with PackageCard)', () => {
    render(<DestinationCard place={place} />);

    expect(screen.queryByText(/₹/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Photos/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Save ₹/)).not.toBeInTheDocument();
  });
});
