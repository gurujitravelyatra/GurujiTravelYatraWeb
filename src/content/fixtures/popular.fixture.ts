// Source: GTY Wireframe Prototype.dc.html, const popular (inline array), line ~1112
//
// This is the real source for `ContentPort.getPopularDestinations()` — NOT
// `DESTS` (tech spec §4.4 cites `DESTS`, corrected per BLOCKERS.md §3). The
// export's own composition for these 5 cards is the `PackageCard` visual
// (price/duration/savings/heart), so this resolves to `Package[]`, not
// `Destination[]`, matching the `ContentPort` signature.
import type { DestinationCategory, Package } from '../types';
import { slugify } from '../slug';

interface PopularFixtureItem {
  name: string;
  cat: DestinationCategory;
  photos: number;
  dest: string;
  dur: string;
  sub: string;
  save: string;
  price: string;
  was: string;
}

const POPULAR_FIXTURE: PopularFixtureItem[] = [
  { name: 'Spiti Valley Bike Trip', cat: 'Adventure', photos: 12, dest: 'Spiti Valley', dur: '8 Days 7 Nights', sub: 'Delhi - Chitkul - Kaza - Chandratal - Manali', save: '4,000', price: '₹25,800', was: '₹29,800' },
  { name: 'Leh Ladakh Group Trip from Delhi', cat: 'Himalaya', photos: 14, dest: 'Leh Ladakh', dur: '10 Days 9 Nights', sub: 'with Umling La & Tso Moriri', save: '4,000', price: '₹33,800', was: '₹37,800' },
  { name: 'Do Dham Yatra', cat: 'Spiritual', photos: 10, dest: 'Kedarnath', dur: '7 Days 6 Nights', sub: 'Haridwar - Guptkashi - Kedarnath - Badrinath', save: '3,000', price: '₹28,900', was: '₹31,900' },
  { name: 'Kashmir Family Escape', cat: 'Family Trip', photos: 14, dest: 'Kashmir', dur: '6 Days 5 Nights', sub: 'Srinagar - Gulmarg - Pahalgam - Sonmarg', save: '4,000', price: '₹34,200', was: '₹38,200' },
  { name: 'Kashi Darshan', cat: 'Pilgrimage', photos: 10, dest: 'Varanasi', dur: '4 Days 3 Nights', sub: 'Varanasi - Sarnath - Prayagraj', save: '2,000', price: '₹16,400', was: '₹18,400' },
];

export const popularPackages: Package[] = POPULAR_FIXTURE.map((item) => ({
  slug: slugify(item.name),
  name: item.name,
  photoUrl: item.dest, // opaque string key — see Assumption A4
  destinationSlug: slugify(item.dest),
  category: item.cat,
  durationLabel: item.dur,
  subtitle: item.sub,
  photosCount: item.photos,
  priceFrom: item.price,
  priceWas: item.was,
  savingsLabel: item.save,
}));
