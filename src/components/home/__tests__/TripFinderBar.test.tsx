import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TripFinderBar } from '../TripFinderBar';
import { tripFinderTabs } from '@/lib/trip-finder-tabs';

/**
 * Copy-fidelity regression suite for the Trip Finder tab hints.
 *
 * The hints previously advertised three things the product does not have:
 * departures "with seats still open", a family trip to Nepal, and a "trip
 * builder — nine short questions". None of that is backed by code or data,
 * so these tests assert the absence of such claims structurally rather than
 * pinning the exact marketing sentences (which copywriters may still tune).
 *
 * CRM-migration Step 5 REMOVED the place-name/category-existence checks this
 * file used to run against `@/content/public-listing`'s fixture catalogue
 * (`toursRenderedOnCataloguePage`, `getCategoryChips`) — that catalogue, and
 * the whole fixture content layer behind it, is deleted; the CRM is the only
 * remaining source of "which tours/categories actually exist", and it is
 * live, server-side data this static-copy component test has no business
 * depending on. What is still checked here:
 *   - `tab.category` is typed as `CrmCategory` (`trip-finder-tabs.ts`), so a
 *     category that is not one of the five the CRM contract defines fails
 *     `tsc`, not a runtime assertion that could drift from fixture data.
 *   - The deep-link URL MECHANICS (a mapped tab gets `?category=`, an
 *     unmapped one gets the plain link, the href actually changes per tab).
 *   - The hint COPY makes no claim the product cannot back, independent of
 *     any specific catalogue content.
 */

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
      // The CRM does carry real seat/date data now, but this bar's own three
      // fields (destination/month/travellers) are still decorative
      // (TripFinderBar.tsx's own comment) — a hint claiming otherwise would
      // misdescribe what THIS control does, regardless of what the CRM knows.
      ['seat availability', /\bseats?\b/i],
      ['departure scheduling', /\bdepartures?\b|\bdeparting\b/i],
      ['live availability', /availab(le|ility)/i],
      // There is no trip-builder / questionnaire flow anywhere in the app.
      ['a trip builder', /trip builder|itinerary builder|wizard/i],
      ['a multi-question flow', /\bquestions?\b|questionnaire/i],
      // Instant booking/payment is not implemented anywhere in the app.
      ['instant booking', /book (now|instantly)|instant (booking|confirmation)/i],
    ];

    for (const [label, pattern] of bannedClaims) {
      it(`never claims ${label}`, () => {
        for (const tab of tripFinderTabs) {
          expect(tab.hint).not.toMatch(pattern);
        }
      });
    }

    it('does not use the old "Showing …" framing, which implied the tab filters the page', () => {
      for (const tab of tripFinderTabs) {
        expect(tab.hint).not.toMatch(/^showing\b/i);
      }
    });
  });
});
