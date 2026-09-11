import { render, screen } from '@testing-library/react';

import { ReviewCard } from '../ReviewCard';
import type { Review } from '@/content/types';

const realReview: Review = {
  photoUrl: 'trip-photo-1',
  quote: 'Everything was planned perfectly, we never had to worry about a thing.',
  travellerName: 'Asha Mehta',
  tripLabel: 'Spiti Valley Circuit',
  ratingOutOf5: 4,
};

const placeholderReview: Review = {
  photoUrl: 'testimonial-placeholder-1',
  quote: 'Testimonial copy pending — do not ship without real customer quotes.',
  travellerName: '[Traveller name pending]',
  tripLabel: '[Trip pending]',
  // No `ratingOutOf5` — a rating is a factual claim about a real customer.
  isPlaceholder: true,
};

describe('ReviewCard', () => {
  it('renders quote, traveller name, trip label and correct star count', () => {
    render(<ReviewCard review={realReview} />);

    expect(screen.getByText(/Everything was planned perfectly/)).toBeInTheDocument();
    expect(screen.getByText('Asha Mehta')).toBeInTheDocument();
    expect(screen.getByText('Spiti Valley Circuit')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Rated 4 out of 5 stars' })).toBeInTheDocument();
  });

  it('rounds a fractional rating to the nearest whole star count', () => {
    render(<ReviewCard review={{ ...realReview, ratingOutOf5: 4.6 }} />);
    expect(screen.getByRole('img', { name: 'Rated 5 out of 5 stars' })).toBeInTheDocument();
  });

  it('renders a placeholder review plainly, with its placeholder text as-is, never dressed up as a real testimonial', () => {
    render(<ReviewCard review={placeholderReview} />);

    // The literal placeholder copy renders unchanged — nothing invents a
    // realistic-sounding quote/name in its place. Matched as a substring
    // because ReviewCard wraps every quote in typographic quote marks
    // (&#8220;/&#8221;), so the element's textContent is not the bare string.
    expect(
      screen.getByText((_content, element) => element?.textContent === `“${placeholderReview.quote}”`, {
        selector: 'p',
      })
    ).toBeInTheDocument();
    expect(screen.getByText('[Traveller name pending]')).toBeInTheDocument();
    expect(screen.getByText('[Trip pending]')).toBeInTheDocument();

    // And it is visibly marked as a placeholder, not indistinguishable from
    // a real review.
    expect(screen.getByText('Placeholder')).toBeInTheDocument();
  });

  it('does not mark a real (non-placeholder) review with the Placeholder badge', () => {
    render(<ReviewCard review={realReview} />);
    expect(screen.queryByText('Placeholder')).not.toBeInTheDocument();
  });

  // BLOCKERS.md Decision H — five filled gold stars read as a real 5/5 rating
  // no matter what badge sits under them, so an unrated review renders none.
  it('renders no stars at all when the review carries no rating', () => {
    const { container } = render(<ReviewCard review={placeholderReview} />);

    expect(screen.queryByRole('img', { name: /out of 5 stars/ })).not.toBeInTheDocument();
    expect(container.textContent ?? '').not.toContain('★');
  });

  it('still renders stars for a real review that does carry a rating', () => {
    render(<ReviewCard review={{ ...realReview, ratingOutOf5: 5 }} />);
    expect(screen.getByRole('img', { name: 'Rated 5 out of 5 stars' })).toBeInTheDocument();
  });

  it('renders no stars for a rating of 0 rather than treating it as absent', () => {
    render(<ReviewCard review={{ ...realReview, ratingOutOf5: 0 }} />);

    // The row still renders (0 is a real rating, not a missing one) — it just
    // shows five empty stars. This pins the `=== undefined` check against a
    // regression to a falsy check.
    expect(screen.getByRole('img', { name: 'Rated 0 out of 5 stars' })).toBeInTheDocument();
  });
});
