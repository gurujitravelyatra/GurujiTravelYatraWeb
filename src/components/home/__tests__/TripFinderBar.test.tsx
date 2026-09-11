import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TripFinderBar } from '../TripFinderBar';
import { tripFinderTabs } from '@/content/fixtures/tabs.fixture';
import { toursRenderedOnCataloguePage } from '@/content/public-listing';

/**
 * Copy-fidelity regression suite for the Trip Finder tab hints, in the same
 * spirit as the LeadModal copy tests (BLOCKERS.md Decision H).
 *
 * The hints previously advertised three things the product does not have:
 * departures "with seats still open", a family trip to Nepal, and a "trip
 * builder — nine short questions". None of that is backed by code or data, so
 * these tests assert the absence of such claims structurally rather than
 * pinning the exact marketing sentences (which copywriters may still tune).
 *
 * THE CORPUS IS THE RENDERED SET, not `allTours`. This test used to check
 * hint place-names against all 22 fixture records, while the CTA lands on
 * `/tour-packages`, which renders only the rails — and only the publicly
 * listable ones. So it passed a hint naming the "Leh Ladakh group trip from
 * Delhi" (a popular-only tour, on no rail) and hints naming Kedarnath,
 * Varanasi and Kashmir (whose tours are withheld as `pricingUnverified`):
 * four promises a visitor could not find at the destination the button sends
 * them to. Checking the rendered set closes that gap.
 */
const TOUR_CORPUS = toursRenderedOnCataloguePage
  .map((tour) => `${tour.name} ${tour.destinationName} ${tour.subtitle} ${tour.category}`)
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

    it('names only places a visitor can actually reach at the CTA destination (no Nepal)', () => {
      expect(TOUR_CORPUS).not.toContain('nepal');

      for (const tab of tripFinderTabs) {
        const capitalised = tab.hint.match(/\b[A-Z][a-z]+\b/g) ?? [];
        for (const word of capitalised) {
          if (NON_PLACE_WORDS.has(word)) continue;
          expect(TOUR_CORPUS).toContain(word.toLowerCase());
        }
      }
    });

    it('names no tour that is withheld from the catalogue', () => {
      // These three are `pricingUnverified` and appear in no public listing,
      // so a hint pointing a visitor at them sends them to nothing.
      for (const tab of tripFinderTabs) {
        expect(tab.hint).not.toMatch(/kedarnath|badrinath|varanasi|kashmir|kashi/i);
      }
    });

    it('names no popular-only tour, which the catalogue does not render', () => {
      // "Leh Ladakh Group Trip from Delhi" belongs to no rail, so it is on
      // Home only — the previous Group Tour hint sent visitors to
      // /tour-packages to look for it.
      for (const tab of tripFinderTabs) {
        expect(tab.hint).not.toMatch(/group trip from delhi/i);
      }
    });

    it('does not use the old "Showing …" framing, which implied the tab filters the page', () => {
      for (const tab of tripFinderTabs) {
        expect(tab.hint).not.toMatch(/^showing\b/i);
      }
    });
  });
});
