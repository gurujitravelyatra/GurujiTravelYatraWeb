import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TestimonialsCarousel } from '../TestimonialsCarousel';
import { JourneyVideoBlock } from '../JourneyVideoBlock';
import type { FeaturedVideo, Review } from '@/content/types';

/**
 * Both sections are fed placeholder fixtures (BLOCKERS.md Decision H) that are
 * expected to be emptied out rather than shipped with fabricated content — so
 * an empty array is a legitimate data state, not a bug. Both used to compute
 * `% 0` = NaN, index with it, and throw on a property of `undefined`, which in
 * a Server Component tree takes the whole Home page down.
 */
describe('TestimonialsCarousel with no testimonials', () => {
  it('renders a graceful empty state instead of throwing', () => {
    expect(() => render(<TestimonialsCarousel testimonials={[]} />)).not.toThrow();

    expect(screen.getByTestId('testimonials-empty')).toBeInTheDocument();
    expect(screen.getByText(/Traveller stories are on their way/)).toBeInTheDocument();
  });

  it('keeps the section heading so the page structure is unchanged', () => {
    render(<TestimonialsCarousel testimonials={[]} />);

    expect(screen.getByTestId('section-10-testimonials')).toBeInTheDocument();
    expect(screen.getByText('What Our Travellers Say')).toBeInTheDocument();
  });

  it('renders no carousel arrows there is nothing to page through', () => {
    render(<TestimonialsCarousel testimonials={[]} />);

    expect(screen.queryByRole('button', { name: 'Previous testimonial' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next testimonial' })).not.toBeInTheDocument();
  });

  it('still renders a single testimonial without arrows misbehaving', async () => {
    const user = userEvent.setup();
    const only: Review[] = [
      { photoUrl: 'p1', quote: 'Only one.', travellerName: 'Solo Traveller', tripLabel: 'Trip', ratingOutOf5: 4 },
    ];

    render(<TestimonialsCarousel testimonials={only} />);
    expect(screen.getByText('Solo Traveller')).toBeInTheDocument();

    // Wrapping a 1-item list must land back on the same item, not on undefined.
    await user.click(screen.getByRole('button', { name: 'Next testimonial' }));
    expect(screen.getByText('Solo Traveller')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Previous testimonial' }));
    expect(screen.getByText('Solo Traveller')).toBeInTheDocument();
  });
});

describe('JourneyVideoBlock with no videos', () => {
  it('renders a graceful empty state instead of throwing', () => {
    expect(() => render(<JourneyVideoBlock videos={[]} />)).not.toThrow();

    expect(screen.getByTestId('journey-video-empty')).toBeInTheDocument();
    expect(screen.getByText('Trip films are coming soon.')).toBeInTheDocument();
  });

  it('keeps the standalone copy column and its CTA, which do not depend on video data', () => {
    render(<JourneyVideoBlock videos={[]} />);

    expect(screen.getByTestId('section-5-8-journey-video')).toBeInTheDocument();
    expect(screen.getByText('Explore Journeys')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Explore All Journeys/ })).toHaveAttribute('href', '/tour-packages');
  });

  it('renders no preview-cycling button when there is nothing to preview', () => {
    render(<JourneyVideoBlock videos={[]} />);
    expect(screen.queryByRole('button', { name: 'Show the next trip preview' })).not.toBeInTheDocument();
  });

  it('still cycles correctly with a single video', async () => {
    const user = userEvent.setup();
    const only: FeaturedVideo[] = [{ title: 'Only Film', whenLabel: 'Trip details pending', thumbnailKey: 'k1' }];

    render(<JourneyVideoBlock videos={only} />);
    expect(screen.getByText('Only Film')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show the next trip preview' }));
    expect(screen.getByText('Only Film')).toBeInTheDocument();
  });
});
