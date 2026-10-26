import { render, screen } from '@testing-library/react';

import { JourneyVideoBlock } from '../JourneyVideoBlock';

/**
 * CRM-migration Step 5: this file used to ALSO cover `TestimonialsCarousel`'s
 * empty state. That component (and `ReviewCard`, its only caller) is deleted
 * — it was never rewired to the CRM in Step 2 (the CRM contract has no
 * reviews/testimonials concept at all) and had been orphaned, with no live
 * caller on any page, ever since. What remains here is `JourneyVideoBlock`,
 * which IS live.
 *
 * CRM-migration Step 2: `JourneyVideoBlock` renders a single embed from
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
