// Source: GTY Wireframe Prototype.dc.html, const whys (inline array), line ~1110
//
// Powers the "Why Travel With GTY?" band (Home page, [EXPORT] section — see
// tech spec §4.4). Not part of `ContentPort`: the export treats this as
// static site copy, not fetched content, so it is a plain fixture export
// consumed directly by the page/component in Sprint 2's Home build (part 2
// of this feature).
//
// SINGLE SOURCE OF TRUTH FOR FIGURES: this file may not re-type a number that
// `stats.fixture.ts` already owns. "Trusted Since 8+ Years" used to hardcode
// its own "8+", a third independent phrasing of the same figure that also
// appeared in the Hero and the Stats bar — three places to edit, three places
// to drift. It is now composed from the canonical `Years of Experience` stat,
// and inherits that stat's `isPlaceholder` flag so the band marks the figure
// exactly like the stats bar does.
import type { WhyItem } from '../types';
import { getStatByLabel } from './stats.fixture';

export type { WhyItem };

const yearsOfExperience = getStatByLabel('Years of Experience');

/**
 * The band's trust item, built from the canonical years figure. Falls back to
 * figure-free copy if that stat ever disappears, rather than inventing a
 * number or rendering "Trusted Since undefined Years".
 */
const trustedSince: WhyItem = yearsOfExperience
  ? {
      icon: '✷',
      title: `Trusted Since ${yearsOfExperience.value} Years`,
      description: 'Thousands of happy travellers every year',
      isPlaceholder: yearsOfExperience.isPlaceholder,
    }
  : { icon: '✷', title: 'Trusted For Years', description: 'Thousands of happy travellers every year' };

export const whyItems: WhyItem[] = [
  { icon: '☸', title: 'Curated Yatras', description: 'Handpicked spiritual journeys & destinations' },
  trustedSince,
  { icon: '◍', title: '24/7 Travel Support', description: "We're with you at every step of your journey" },
  { icon: '♨', title: 'Pure Veg Meals', description: 'Hygienic & delicious food on all tours' },
  { icon: '✓', title: 'Safe & Comfortable', description: 'Well-planned trips with safety & comfort' },
];
