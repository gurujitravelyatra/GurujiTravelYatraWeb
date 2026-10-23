import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { JourneyVideoBlock } from '../JourneyVideoBlock';
import { featuredVideos } from '@/content/fixtures/videos.fixture';
import { allTours } from '@/content/fixtures/packages.fixture';

/**
 * F1 — the product rule, stated exactly: naming a tour in a trip-preview
 * caption is fine; showing a PRICE or a DISCOUNT for one never is.
 *
 * `videos.fixture.ts` legitimately captions two trip previews "Kedarnath Do
 * Dham Yatra" and "Kashmir Family Escape" — real tours, not products with a
 * price quoted on this surface. What must never happen is a money figure
 * appearing next to one of those captions, since `getFeaturedVideos()` does
 * not pass through the public-listing gate at all.
 *
 * (Before CRM-migration decision 1, these two tours also carried
 * `pricingUnverified` and were withheld from every OTHER public listing,
 * which made this surface the one place their names appeared without a
 * price. That withholding is gone now — both tours list normally elsewhere
 * too — but the rule this suite guards is independent of that: a trip
 * preview names a trip, never a price.)
 *
 * So this suite asserts the boundary structurally rather than pinning captions:
 * the video block renders NO currency, discount or savings figure at all, for
 * any video, on any cycle step.
 */

/** Anything that would read as a price, a discount or a saving. */
const MONEY_PATTERNS: [label: string, pattern: RegExp][] = [
  ['a rupee figure', /₹/],
  ['a written rupee figure', /\b(rs\.?|inr)\b/i],
  ['any other currency symbol', /[$€£]/],
  ['a percentage (discount badges are "N% off")', /\d\s*%/],
  ['a "save" claim', /\bsave[ds]?\b/i],
  ['a "was/now" price comparison', /\bwas\b.*\bnow\b/i],
  ['a per-person rate', /\bper\s+(person|head|pax)\b/i],
  ['a "starting from" price lead-in', /\b(starting|starts|from)\s*(at|@)?\s*[₹$]/i],
  ['an "off" discount', /\d\s*(%|₹)?\s*off\b/i],
];

function blockText(): string {
  return screen.getByTestId('section-5-8-journey-video').textContent ?? '';
}

describe('trip-preview captions never carry a price', () => {
  it.each(MONEY_PATTERNS)('renders no %s', (_label, pattern) => {
    render(<JourneyVideoBlock videos={featuredVideos} />);
    expect(blockText()).not.toMatch(pattern);
  });

  it('holds to that on every video, not just the first one shown', async () => {
    const user = userEvent.setup();
    render(<JourneyVideoBlock videos={featuredVideos} />);

    const next = screen.getByRole('button', { name: /next trip preview/i });

    for (let step = 0; step < featuredVideos.length; step += 1) {
      const text = blockText();
      for (const [, pattern] of MONEY_PATTERNS) {
        expect(text).not.toMatch(pattern);
      }
      await user.click(next);
    }
  });

  it('names real tours in its captions, which the product rule permits', () => {
    render(<JourneyVideoBlock videos={featuredVideos} />);

    // Confirms the tests above are exercising a genuine case: at least one
    // caption corresponds to a real catalogue tour, so "no price leaks next
    // to a tour name" is actually being tested, not a no-op on empty data.
    const tourNames = allTours.map((tour) => tour.name.toLowerCase());
    const captions = featuredVideos.map((video) => video.title.toLowerCase());
    const overlap = captions.filter((caption) =>
      tourNames.some((name) => name.includes(caption) || caption.includes(name.split(' ')[0]))
    );
    expect(overlap.length).toBeGreaterThan(0);
  });

  it('carries no price-shaped field in the fixture itself, so none can leak into a caption', () => {
    for (const video of featuredVideos) {
      for (const value of Object.values(video)) {
        expect(String(value)).not.toMatch(/₹|\brs\.?\b|\bsave\b/i);
      }
      expect(Object.keys(video).sort()).toEqual(['thumbnailKey', 'title', 'whenLabel']);
    }
  });
});
