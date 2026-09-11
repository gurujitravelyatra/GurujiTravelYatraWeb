// Source: GTY Wireframe Prototype.dc.html, `timeline`, line ~1182.
// Field mapping: y→year, d→description.
//
// EVERY entry is flagged `isPlaceholder`, for the same reason every entry in
// `stats.fixture.ts` is:
//
//  - "10,000th traveller" and "150+ destinations, 10,000+ travellers" quote
//    the exact figures Assumption A3 records as CONTESTED — the export says
//    10,000+/8 years, the product spec says 25,000+/10 years, and the product
//    spec itself (§14) says these are not final and should become
//    admin-editable.
//  - "2015 — First Kedarnath yatra, 22 travellers" and "2018 — Group tours
//    across four states" are company-history claims. Nobody at GTY has
//    confirmed a founding year, a first-yatra date or a traveller count, and
//    product-spec §5.8 (the whole About Us section, two lines long) states
//    none of them. A fabricated founding year on a real company's About page
//    is precisely the class of claim BLOCKERS.md Decision H forbids.
//
// They are kept because the export is what is wired to render, but the
// consumer MUST visibly mark them — see `AboutTimeline`.
//
// TODO(about-history-confirm): replace with GTY's real milestones and drop the
// flags. Greppable alongside `TODO(stats-confirm)` and `TODO(pricing-confirm)`.
import type { AboutMilestone } from '../types';

export const aboutMilestones: AboutMilestone[] = [
  { year: '2015', description: 'First Kedarnath yatra, 22 travellers', isPlaceholder: true },
  { year: '2018', description: 'Group tours across four states', isPlaceholder: true },
  { year: '2022', description: '10,000th traveller', isPlaceholder: true },
  { year: '2026', description: '150+ destinations, 10,000+ travellers', isPlaceholder: true },
];

/**
 * The four photo slots in the "Our Travellers" strip (export line 735: one
 * `ph.group` tile plus `aboutTiles`, a 4-item slice of the same rotating stock
 * `pool` every other screen draws from).
 *
 * Opaque keys (Assumption A4). The export has no real traveller photography —
 * and unlike a destination photo, a "traveller" photo is a picture of a real
 * customer, so there is nothing to substitute. These render as labelled
 * placeholders.
 */
export const aboutTravellerPhotoKeys: string[] = ['Group', 'Himalayas', 'Varanasi', 'Kashmir Valley'];
