import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TripFinderBar } from '../TripFinderBar';
import { tripFinderTabs } from '@/content/fixtures/tabs.fixture';
import { allTours } from '@/content/fixtures/packages.fixture';

/**
 * Copy-fidelity regression suite for the Trip Finder tab hints, in the same
 * spirit as the LeadModal copy tests (BLOCKERS.md Decision H).
 *
 * The hints previously advertised three things the product does not have:
 * departures "with seats still open", a family trip to Nepal, and a "trip
 * builder — nine short questions". None of that is backed by code or data, so
 * these tests assert the absence of such claims structurally rather than
 * pinning the exact marketing sentences (which copywriters may still tune).
 */

/** Everything the tour data actually says, as one lowercase haystack. */
const TOUR_CORPUS = allTours
  .map((tour) => `${tour.name} ${tour.destinationSlug.replace(/-/g, ' ')} ${tour.subtitle} ${tour.category}`)
  .join(' | ')
  .toLowerCase();

/**
 * Capitalised words in the hints that are NOT place names and therefore need
 * no backing tour record: two sentence-initial words and the real name of the
 * page the CTA links to.
 */
const NON_PLACE_WORDS = new Set(['Journeys', 'Tell', 'Tour', 'Packages']);

describe('TripFinderBar', () => {
  it('renders every tab, with the first one active and its hint showing', () => {
    render(<TripFinderBar />);

    for (const tab of tripFinderTabs) {
      expect(screen.getByRole('button', { name: tab.name })).toBeInTheDocument();
    }

    expect(screen.getByRole('button', { name: 'Spiritual Yatra' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(tripFinderTabs[0].hint)).toBeInTheDocument();
  });

  it('swaps the hint when another tab is selected', async () => {
    const user = userEvent.setup();
    render(<TripFinderBar />);

    await user.click(screen.getByRole('button', { name: 'Custom Trip' }));

    expect(screen.getByText(tripFinderTabs[4].hint)).toBeInTheDocument();
    expect(screen.queryByText(tripFinderTabs[0].hint)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Custom Trip' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps the SAME /tour-packages CTA on every tab — no tab has its own destination', async () => {
    const user = userEvent.setup();
    render(<TripFinderBar />);

    // This is why no hint may promise a pre-filtered or tab-specific result
    // set: the button never changes. If a future change does wire per-tab
    // routing, this test should be updated deliberately, alongside the copy.
    for (const tab of tripFinderTabs) {
      await user.click(screen.getByRole('button', { name: tab.name }));
      expect(screen.getByRole('link', { name: /Explore Now/ })).toHaveAttribute('href', '/tour-packages');
    }
  });

  describe('hint copy asserts nothing the product cannot back', () => {
    const bannedClaims: [label: string, pattern: RegExp][] = [
      // No Package record sets `seatsLabel` and no departure-date field exists.
      ['seat availability', /\bseats?\b/i],
      ['departure scheduling', /\bdepartures?\b|\bdeparting\b/i],
      ['live availability', /availab(le|ility)/i],
      // There is no trip-builder / questionnaire flow anywhere in the app.
      ['a trip builder', /trip builder|itinerary builder|wizard/i],
      ['a multi-question flow', /\bquestions?\b|questionnaire/i],
      // Booking/payment is not implemented (NotImplementedLeadAdapter).
      ['instant booking', /book (now|instantly)|instant (booking|confirmation)/i],
    ];

    for (const [label, pattern] of bannedClaims) {
      it(`never claims ${label}`, () => {
        for (const tab of tripFinderTabs) {
          expect(tab.hint).not.toMatch(pattern);
        }
      });
    }

    it('names only places that exist in the tour data (no Nepal)', () => {
      expect(TOUR_CORPUS).not.toContain('nepal');

      for (const tab of tripFinderTabs) {
        const capitalised = tab.hint.match(/\b[A-Z][a-z]+\b/g) ?? [];
        for (const word of capitalised) {
          if (NON_PLACE_WORDS.has(word)) continue;
          expect(TOUR_CORPUS).toContain(word.toLowerCase());
        }
      }
    });

    it('does not use the old "Showing …" framing, which implied the tab filters the page', () => {
      for (const tab of tripFinderTabs) {
        expect(tab.hint).not.toMatch(/^showing\b/i);
      }
    });
  });
});
