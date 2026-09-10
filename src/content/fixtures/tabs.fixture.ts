// Source: GTY Wireframe Prototype.dc.html, const TABS, line ~927
//
// Powers the Trip Finder bar's tab row (Home page hero, [EXPORT] section —
// tech spec §4.4). Not part of `ContentPort`: local, static UI copy, not
// fetched content. Each tuple is [name, hint].
export interface TripFinderTab {
  name: string;
  hint: string;
}

export const tripFinderTabs: TripFinderTab[] = [
  { name: 'Spiritual Yatra', hint: 'Showing handpicked yatras — Kedarnath, Badrinath, Varanasi, Rameshwaram.' },
  { name: 'Group Tour', hint: 'Showing upcoming departures with seats still open.' },
  { name: 'Family Holiday', hint: 'Showing family-paced trips: Kashmir, Nepal, Rameshwaram.' },
  { name: 'Adventure', hint: 'Showing Spiti, Leh Ladakh and high-altitude routes.' },
  { name: 'Custom Trip', hint: 'Takes you to the trip builder — nine short questions.' },
];
