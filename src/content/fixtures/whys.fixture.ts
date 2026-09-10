// Source: GTY Wireframe Prototype.dc.html, const whys (inline array), line ~1110
//
// Powers the "Why Travel With GTY?" band (Home page, [EXPORT] section — see
// tech spec §4.4). Not part of `ContentPort`: the export treats this as
// static site copy, not fetched content, so it is a plain fixture export
// consumed directly by the page/component in Sprint 2's Home build (part 2
// of this feature).
export interface WhyItem {
  icon: string;
  title: string;
  description: string;
}

export const whyItems: WhyItem[] = [
  { icon: '☸', title: 'Curated Yatras', description: 'Handpicked spiritual journeys & destinations' },
  { icon: '✷', title: 'Trusted Since 8+ Years', description: 'Thousands of happy travellers every year' },
  { icon: '◍', title: '24/7 Travel Support', description: "We're with you at every step of your journey" },
  { icon: '♨', title: 'Pure Veg Meals', description: 'Hygienic & delicious food on all tours' },
  { icon: '✓', title: 'Safe & Comfortable', description: 'Well-planned trips with safety & comfort' },
];
