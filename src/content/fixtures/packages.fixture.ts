// Source: GTY Wireframe Prototype.dc.html, const RAILS, line ~970
//
// Verbatim transcription of the 4 rails × 5 packages used by the Tour
// Packages page's `PackageRail` sections. Field mapping (tech spec §4.4 /
// §6.3): photos→photosCount, dur→durationLabel, sub→subtitle,
// save→savingsLabel, price→priceFrom, was→priceWas, dest→destinationSlug
// (kebab-cased via slugify), cat→category. `slug` is derived from `name`,
// never hand-typed, so it can never drift from the display name.
import type { DestinationCategory, Package, PackageRail } from '../types';
import { slugify } from '../slug';

interface RailFixtureItem {
  photos: number;
  name: string;
  dest: string;
  cat: DestinationCategory;
  dur: string;
  sub: string;
  save: string;
  price: string;
  was: string;
}

interface RailFixture {
  t: string;
  items: RailFixtureItem[];
}

const RAILS_FIXTURE: RailFixture[] = [
  {
    t: 'Trending Tour Packages',
    items: [
      { photos: 11, name: 'Explore Ladakh', dest: 'Leh Ladakh', cat: 'Adventure', dur: '7 Days 6 Nights', sub: 'with Turtuk & Sham Valley', save: '4,000', price: '₹19,800', was: '₹23,800' },
      { photos: 14, name: 'Spiti Valley Circuit', dest: 'Spiti Valley', cat: 'Adventure', dur: '9 Days 8 Nights', sub: 'Shimla - Kaza - Chandratal', save: '5,200', price: '₹42,500', was: '₹47,700' },
      { photos: 8, name: 'Do Dham Yatra', dest: 'Kedarnath', cat: 'Spiritual', dur: '6 Days 5 Nights', sub: 'Kedarnath & Badrinath', save: '3,500', price: '₹28,900', was: '₹32,400' },
      { photos: 11, name: 'Kashmir Family Escape', dest: 'Kashmir', cat: 'Family', dur: '6 Days 5 Nights', sub: 'Srinagar - Gulmarg - Pahalgam', save: '4,000', price: '₹34,200', was: '₹38,200' },
      { photos: 14, name: 'Kashi Darshan', dest: 'Varanasi', cat: 'Spiritual', dur: '4 Days 3 Nights', sub: 'Varanasi - Sarnath - Prayagraj', save: '2,000', price: '₹16,400', was: '₹18,400' },
    ],
  },
  {
    t: 'International Tour Packages',
    items: [
      { photos: 8, name: 'Maldives Escape', dest: 'Maldives', cat: 'International', dur: '5 Days 4 Nights', sub: 'Male - Maafushi - Water Villa', save: '8,000', price: '₹78,500', was: '₹86,500' },
      { photos: 11, name: 'Singapore Highlights', dest: 'Singapore', cat: 'International', dur: '6 Days 5 Nights', sub: 'with Sentosa & Universal Studios', save: '6,500', price: '₹64,900', was: '₹71,400' },
      { photos: 14, name: 'Thailand Discovery', dest: 'Thailand', cat: 'International', dur: '7 Days 6 Nights', sub: 'Bangkok - Pattaya - Phuket', save: '7,200', price: '₹58,400', was: '₹65,600' },
      { photos: 8, name: 'Bali Getaway', dest: 'Bali', cat: 'International', dur: '6 Days 5 Nights', sub: 'Ubud - Kuta - Nusa Penida', save: '6,000', price: '₹61,200', was: '₹67,200' },
      { photos: 11, name: 'Dubai City Break', dest: 'Dubai', cat: 'International', dur: '5 Days 4 Nights', sub: 'with Desert Safari & Burj Khalifa', save: '5,500', price: '₹54,800', was: '₹60,300' },
    ],
  },
  {
    t: 'North India Tour Packages',
    items: [
      { photos: 14, name: 'Manali Snow Trip', dest: 'Manali', cat: 'Family', dur: '5 Days 4 Nights', sub: 'Solang - Rohtang - Kasol', save: '3,000', price: '₹18,600', was: '₹21,600' },
      { photos: 8, name: 'Vaishno Devi Yatra', dest: 'Vaishnodevi', cat: 'Spiritual', dur: '4 Days 3 Nights', sub: 'Katra - Bhawan - Bhairon', save: '2,200', price: '₹14,900', was: '₹17,100' },
      { photos: 11, name: 'Golden Triangle', dest: 'Uttarakhand', cat: 'Cultural', dur: '6 Days 5 Nights', sub: 'Delhi - Agra - Jaipur', save: '3,800', price: '₹26,400', was: '₹30,200' },
      { photos: 14, name: 'Rishikesh Adventure', dest: 'Rishikesh', cat: 'Adventure', dur: '4 Days 3 Nights', sub: 'Rafting - Camping - Ganga Aarti', save: '2,400', price: '₹12,800', was: '₹15,200' },
      { photos: 8, name: 'Amritsar & Dharamshala', dest: 'Uttarakhand', cat: 'Cultural', dur: '6 Days 5 Nights', sub: 'Golden Temple - Wagah - McLeodganj', save: '3,200', price: '₹24,700', was: '₹27,900' },
    ],
  },
  {
    t: 'South India Tour Packages',
    items: [
      { photos: 11, name: 'Rameshwaram Darshan', dest: 'Rameshwaram', cat: 'Spiritual', dur: '5 Days 4 Nights', sub: 'Madurai - Rameshwaram - Kanyakumari', save: '2,800', price: '₹21,300', was: '₹24,100' },
      { photos: 14, name: 'Kerala Backwaters', dest: 'Kerala', cat: 'Family', dur: '6 Days 5 Nights', sub: 'Munnar - Alleppey - Kochi', save: '4,200', price: '₹31,500', was: '₹35,700' },
      { photos: 8, name: 'Ooty & Coorg', dest: 'Ooty', cat: 'Family', dur: '5 Days 4 Nights', sub: 'Ooty - Coonoor - Coorg', save: '3,100', price: '₹23,800', was: '₹26,900' },
      { photos: 11, name: 'Tirupati Balaji Yatra', dest: 'Tirupati', cat: 'Spiritual', dur: '4 Days 3 Nights', sub: 'Tirumala - Kanipakam - Srikalahasti', save: '2,000', price: '₹17,200', was: '₹19,200' },
      { photos: 14, name: 'Goa Beach Holiday', dest: 'Goa', cat: 'Beach', dur: '5 Days 4 Nights', sub: 'North Goa - South Goa - Dudhsagar', save: '3,400', price: '₹22,600', was: '₹26,000' },
    ],
  },
];

function toPackage(item: RailFixtureItem): Package {
  return {
    slug: slugify(item.name),
    name: item.name,
    // Opaque string key (Assumption A4) — no real photo files exist. Rendered
    // as a token-coloured placeholder surface by the card component, never a
    // fabricated URL.
    photoUrl: item.dest,
    destinationSlug: slugify(item.dest),
    category: item.cat,
    durationLabel: item.dur,
    subtitle: item.sub,
    photosCount: item.photos,
    priceFrom: item.price,
    priceWas: item.was,
    savingsLabel: item.save,
  };
}

export const packageRails: PackageRail[] = RAILS_FIXTURE.map((rail) => ({
  title: rail.t,
  items: rail.items.map(toPackage),
}));
