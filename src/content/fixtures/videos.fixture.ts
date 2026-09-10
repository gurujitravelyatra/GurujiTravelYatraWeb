// Source: GTY Wireframe Prototype.dc.html, const VIDEOS, line ~1000
//
// Field mapping: t→title, w→whenLabel, k→thumbnailKey (opaque string key,
// see Assumption A4 — resolved to a token-coloured placeholder surface by
// the component, never a real photo URL).
import type { FeaturedVideo } from '../types';

export const featuredVideos: FeaturedVideo[] = [
  { title: 'Spiti Valley Circuit', whenLabel: 'Departed 06 Oct 2026 · 42 travellers', thumbnailKey: 'Spiti_Valley' },
  { title: 'Leh Ladakh Group Trip', whenLabel: 'Departed 12 Sep 2026 · 28 travellers', thumbnailKey: 'Leh' },
  { title: 'Kedarnath Do Dham Yatra', whenLabel: 'Departed 18 Aug 2026 · 36 travellers', thumbnailKey: 'Kedarnath_Temple' },
  { title: 'Kashmir Family Escape', whenLabel: 'Departed 02 Aug 2026 · 24 travellers', thumbnailKey: 'Kashmir_Valley' },
];
