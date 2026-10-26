import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TestimonialsCarousel } from '../TestimonialsCarousel';
import { JourneyVideoBlock } from '../JourneyVideoBlock';
import type { Review } from '@/content/types';

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

/**
 * CRM-migration Step 2: `JourneyVideoBlock` now renders a single embed from
 * `site.settings.profileVideoUrl` instead of cycling through fixture
 * captions — see the component for why (the CRM has exactly one video
 * field, not a list).
 */
describe('JourneyVideoBlock with no video configured', () => {
  it('renders a graceful empty state instead of throwing', () => {
    expect(() => render(<JourneyVideoBlock profileVideoUrl={null} />)).not.toThrow();

    expect(screen.getByTestId('journey-video-empty')).toBeInTheDocument();
    expect(screen.getByText('Our journey video is coming soon.')).toBeInTheDocument();
  });

  it('keeps the standalone copy column and its CTA, which do not depend on video data', () => {
    render(<JourneyVideoBlock profileVideoUrl={null} />);

    expect(screen.getByTestId('section-5-8-journey-video')).toBeInTheDocument();
    expect(screen.getByText('Explore Journeys')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Explore All Journeys/ })).toHaveAttribute('href', '/tour-packages');
  });
});

describe('JourneyVideoBlock with a configured video', () => {
  it('renders the embed for a recognised host', () => {
    render(<JourneyVideoBlock profileVideoUrl="https://www.youtube.com/embed/example" />);

    const iframe = screen.getByTitle('Guruji Travel Yatra — our journey');
    expect(iframe).toHaveAttribute('src', 'https://www.youtube.com/embed/example');
    expect(screen.queryByTestId('journey-video-empty')).not.toBeInTheDocument();
  });

  it('falls back to the empty state for an unrecognised/untrusted URL, rather than rendering it', () => {
    render(<JourneyVideoBlock profileVideoUrl="javascript:alert(1)" />);

    expect(screen.getByTestId('journey-video-empty')).toBeInTheDocument();
    expect(screen.queryByTitle('Guruji Travel Yatra — our journey')).not.toBeInTheDocument();
  });
});
