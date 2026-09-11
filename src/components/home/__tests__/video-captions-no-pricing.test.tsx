import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { JourneyVideoBlock } from '../JourneyVideoBlock';
import { featuredVideos } from '@/content/fixtures/videos.fixture';
import { allTours } from '@/content/fixtures/packages.fixture';
import { isPubliclyListable } from '@/content/public-listing';

/**
 * F1 — the product rule, stated exactly: naming a withheld tour is fine;
 * showing a PRICE or a DISCOUNT for one never is.
 *
 * `videos.fixture.ts` legitimately captions two trip previews "Kedarnath Do
 * Dham Yatra" and "Kashmir Family Escape", both of which are `pricingUnverified`
 * and therefore withheld from every public listing. That is allowed — the
 * captions describe trips the company has run, not products on sale. What must
 * never happen is a money figure appearing next to one of those captions, which
 * would reintroduce the exact claim `public-listing.ts` exists to suppress
 * (and would do it on the one surface that bypasses the listing gate entirely,
 * since `getFeaturedVideos()` does not pass through it).
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

  it('still names withheld tours, which the product rule permits', () => {
    render(<JourneyVideoBlock videos={featuredVideos} />);

    // Confirms the test above is actually exercising the interesting case: at
    // least one caption DOES name a tour that no public listing will show.
    const withheldNames = allTours.filter((tour) => !isPubliclyListable(tour)).map((tour) => tour.name.toLowerCase());
    expect(withheldNames.length).toBeGreaterThan(0);

    const captions = featuredVideos.map((video) => video.title.toLowerCase());
    const overlap = captions.filter((caption) =>
      withheldNames.some((name) => name.includes(caption) || caption.includes(name.split(' ')[0]))
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
