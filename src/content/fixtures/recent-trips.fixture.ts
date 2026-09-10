// NO SOURCE DATA EXISTS for a Recent Trips gallery anywhere in the design
// export, the product spec, or CLAUDE.md — this Home section is [TOKENS]
// per tech spec §4.4 row 9 ("not present in the export's Home block at all
// ... flag for design QA", Open Question Q1). Applying the same principle
// the user set for testimonials (BLOCKERS.md Decision H): build the section
// shell now, fill it with obviously-placeholder content, never fabricate
// real traveller photos/captions/dates for a real travel brand.
//
// TODO(real-recent-trips): replace all entries with real traveller trip
// photos/captions before this section ships publicly. Every entry here is
// greppable via `isPlaceholder: true`.
export interface RecentTripPlaceholder {
  photoKey: string;
  caption: string;
  isPlaceholder: true;
}

const PLACEHOLDER_CAPTION = 'Recent trip photo pending — do not ship without a real traveller photo.';

export const recentTripPlaceholders: RecentTripPlaceholder[] = Array.from({ length: 6 }, (_, index) => ({
  photoKey: `recent-trip-placeholder-${index + 1}`,
  caption: PLACEHOLDER_CAPTION,
  isPlaceholder: true as const,
}));
