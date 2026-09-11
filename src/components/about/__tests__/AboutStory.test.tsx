import { render, screen } from '@testing-library/react';

import { AboutStory } from '../AboutStory';

/**
 * The export renders the brand story as unlabelled `.ln` skeleton bars, and
 * no source (export, product spec) provides real "Our Story" copy. This page
 * must never ship invented brand prose in its place — see BLOCKERS.md
 * Decision H — so the missing copy is disclosed with a visible notice rather
 * than silently rendered as if it were finished.
 */
describe('AboutStory', () => {
  it('renders the real export headline verbatim', () => {
    render(<AboutStory />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: "We don't plan trips, we create lifetime memories.",
      })
    ).toBeInTheDocument();
  });

  it('renders the placeholder notice disclosing the missing brand story', () => {
    render(<AboutStory />);

    const notice = screen.getByTestId('about-story-placeholder-notice');
    expect(notice).toBeInTheDocument();
    expect(notice).toHaveTextContent(/placeholder — not final/i);
    expect(notice).toHaveTextContent(/brand story is not yet written/i);
  });

  it('never renders a fabricated founder note or company history in place of the notice', () => {
    render(<AboutStory />);

    // The notice itself explains what's missing; it must not be replaced by
    // invented brand copy such as a founding narrative.
    expect(screen.queryByText(/founded in|our founder|our mission is/i)).not.toBeInTheDocument();
  });
});
