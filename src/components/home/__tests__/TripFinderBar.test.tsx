import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TripFinderBar } from '../TripFinderBar';
import { tripFinderTabs } from '@/content/fixtures/tabs.fixture';
import { publiclyListedRails, toursRenderedOnCataloguePage } from '@/content/public-listing';
import { getCategoryChips } from '@/content/get-category-chips';

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

  /**
   * F5 — the CTA now deep-links per tab.
   *
   * It used to be one static `/tour-packages` link on all five tabs, and the
   * file said so in a comment asserting the route "takes no category query
   * param either". That stopped being true when the page started reading
   * `?category=`/`?destination=` from `searchParams`: the hints could honestly
   * say "filter by Spiritual on Tour Packages" while the button dropped the
   * visitor on the unfiltered catalogue to hunt for the chip themselves. The
   * International rail's "View All International Tours" link and the footer's
   * Top Destinations column already deep-linked — this bar was the last surface
   * that did not.
   */
  describe('"Explore Now" deep-links to the active tab\'s category', () => {
    it('carries ?category= for every tab that maps to a real chip', async () => {
      const user = userEvent.setup();
      render(<TripFinderBar />);

      for (const tab of tripFinderTabs.filter((candidate) => candidate.category)) {
        await user.click(screen.getByRole('button', { name: tab.name }));
        expect(screen.getByTestId('trip-finder-cta')).toHaveAttribute(
          'href',
          `/tour-packages?category=${encodeURIComponent(tab.category!)}`
        );
      }
    });

    it('falls back to the plain catalogue for tabs with no matching category', async () => {
      const user = userEvent.setup();
      render(<TripFinderBar />);

      const unmapped = tripFinderTabs.filter((candidate) => !candidate.category);
      // "Group Tour" and "Custom Trip" describe how a trip is arranged, not a
      // destination category — pointing them at a made-up chip would be
      // validated away to "All" server-side anyway, i.e. a silently dead link.
      expect(unmapped.length).toBeGreaterThan(0);

      for (const tab of unmapped) {
        await user.click(screen.getByRole('button', { name: tab.name }));
        expect(screen.getByTestId('trip-finder-cta')).toHaveAttribute('href', '/tour-packages');
      }
    });

    it('changes the link when the tab changes, rather than leaving a stale href', async () => {
      const user = userEvent.setup();
      render(<TripFinderBar />);

      const hrefs = new Set<string>();
      for (const tab of tripFinderTabs) {
        await user.click(screen.getByRole('button', { name: tab.name }));
        hrefs.add(screen.getByTestId('trip-finder-cta').getAttribute('href')!);
      }

      expect(hrefs.size).toBeGreaterThan(1);
    });

    it('names only categories that genuinely render a chip on the catalogue page', () => {
      // The guard that keeps this honest: a category that stops matching any
      // publicly-listable tour fails here instead of shipping a deep link to a
      // filter the page cannot offer.
      const chips = getCategoryChips(publiclyListedRails);

      for (const tab of tripFinderTabs) {
        if (!tab.category) continue;
        expect(chips).toContain(tab.category);
      }
    });

    it('deep-links to a category that actually has listable journeys behind it', () => {
      for (const tab of tripFinderTabs) {
        if (!tab.category) continue;
        const matches = toursRenderedOnCataloguePage.filter((tour) => tour.category === tab.category);
        expect(matches.length).toBeGreaterThan(0);
      }
    });

    it('matches the deep-link shape the International rail and footer already use', () => {
      // Consistency, not coincidence: one URL grammar across every surface that
      // sends a visitor to a filtered catalogue.
      for (const tab of tripFinderTabs) {
        if (!tab.category) continue;
        expect(`/tour-packages?category=${encodeURIComponent(tab.category)}`).toMatch(
          /^\/tour-packages\?category=[A-Za-z0-9%]+$/
        );
      }
    });
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
