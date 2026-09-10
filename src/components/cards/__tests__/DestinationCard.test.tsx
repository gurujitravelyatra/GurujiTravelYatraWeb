import { render, screen } from '@testing-library/react';

import { DestinationCard } from '../DestinationCard';
import type { Destination } from '@/content/types';

const destination: Destination = {
  slug: 'maldives',
  name: 'Maldives',
  photoUrl: 'Maldives',
};

describe('DestinationCard', () => {
  it('renders the destination name over the overlay exactly once to assistive tech', () => {
    render(<DestinationCard destination={destination} />);

    // `photoUrl` legitimately equals `name` for international destinations
    // (international.fixture.ts maps `photoUrl: name`), so the string appears
    // twice in the DOM: once as PhotoPlaceholder's decorative caption
    // (aria-hidden) and once as the real visible overlay label. Only the
    // latter should be exposed, so assert on the non-hidden one.
    const exposed = screen.getAllByText('Maldives').filter((el) => !el.closest('[aria-hidden="true"]'));

    expect(exposed).toHaveLength(1);
    expect(exposed[0]).toBeInTheDocument();
  });

  it('renders no price, heart, or category elements (guards against merging with PackageCard)', () => {
    const { container } = render(<DestinationCard destination={destination} />);

    // No currency figure of any kind.
    expect(container.textContent).not.toMatch(/₹/);
    // No "Photos" badge, no category-pill text, no favourite icon container.
    expect(screen.queryByText(/Photos/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Save ₹/)).not.toBeInTheDocument();
    // Only one visible text node (the name) — no duration/subtitle rows.
    expect(container.querySelectorAll('svg')).toHaveLength(0);
  });
});
