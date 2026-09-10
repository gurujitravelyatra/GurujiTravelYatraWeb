// NO SOURCE DATA EXISTS for an Instagram strip anywhere in the design
// export — this Home section is [TOKENS] per tech spec §4.4 row 12 ("not
// present in the export ... no real Instagram API integration this sprint
// ... flag for design QA", Open Question Q1). Same treatment as
// recent-trips.fixture.ts: obvious placeholder tiles, never a fabricated
// photo grid presented as real Instagram content.
//
// TODO(real-instagram-feed): replace with a real Instagram Graph API feed
// (or CMS-managed tile set) before this section ships publicly.
export interface InstagramTilePlaceholder {
  photoKey: string;
  isPlaceholder: true;
}

export const instagramTilePlaceholders: InstagramTilePlaceholder[] = Array.from({ length: 6 }, (_, index) => ({
  photoKey: `instagram-placeholder-${index + 1}`,
  isPlaceholder: true as const,
}));
