import { render, screen, within } from '@testing-library/react';

import { AboutTimeline } from '../AboutTimeline';
import { aboutMilestones } from '@/content/fixtures/about.fixture';

describe('AboutTimeline', () => {
  it('renders all 4 milestones with their year and description', () => {
    render(<AboutTimeline milestones={aboutMilestones} />);

    const group = screen.getByRole('group', { name: "GTY's journey so far" });
    for (const milestone of aboutMilestones) {
      expect(within(group).getByText(milestone.description)).toBeInTheDocument();
    }
  });

  it('renders a visible placeholder marker for every milestone (all 4 are flagged)', () => {
    render(<AboutTimeline milestones={aboutMilestones} />);

    for (const milestone of aboutMilestones) {
      const marker = screen.getByTestId(`about-timeline-placeholder-marker-${milestone.year}`);
      expect(marker).toBeInTheDocument();
      expect(marker).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('renders the shared footnote, wired via aria-describedby on the roled group', () => {
    render(<AboutTimeline milestones={aboutMilestones} />);

    const note = screen.getByTestId('about-timeline-placeholder-note');
    expect(note).toHaveTextContent(/pending confirmation/i);

    const group = screen.getByRole('group', { name: "GTY's journey so far" });
    expect(group).toHaveAttribute('aria-describedby', note.id);
  });

  it('renders no marker and no footnote when every milestone is confirmed', () => {
    const confirmed = aboutMilestones.map((milestone) => ({ ...milestone, isPlaceholder: false }));
    render(<AboutTimeline milestones={confirmed} />);

    for (const milestone of confirmed) {
      expect(screen.queryByTestId(`about-timeline-placeholder-marker-${milestone.year}`)).not.toBeInTheDocument();
    }
    expect(screen.queryByTestId('about-timeline-placeholder-note')).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: "GTY's journey so far" })).not.toHaveAttribute('aria-describedby');
  });
});
