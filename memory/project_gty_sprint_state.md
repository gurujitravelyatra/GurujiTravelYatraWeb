---
name: GTY site setup — SPEC pipeline state
description: Where the GTY SPEC pipeline stands on feat/gty-site-setup, and the blockers stopping merge. Read before resuming.
type: project
---

Branch: `feat/gty-site-setup`. No git remote, no `gh` — PR creation is skipped by user instruction.

## Done (committed, all gates green)
- `4d32279` and earlier: scaffold, tokens, Docker, content layer, global components, Home / Tour Packages / package detail pages.
- `79535bc`: Jest config + 13 unit suites.
- `85acf9b`: Footer/BottomContactStrip unit tests + Playwright E2E (24 tests).

Gate status at `85acf9b`: `tsc --noEmit` clean, `eslint` clean, `next build` clean (27 static pages), Jest 15 suites / 98 tests pass, Playwright 24/24 pass.

## Blocked before merge — pre-merge edge-case-adversary returned Blocker: YES
Needs product decisions, do NOT guess:
1. **Duplicate slugs with conflicting prices.** "Do Dham Yatra", "Kashmir Family Escape", "Kashi Darshan" are transcribed in BOTH `popular.fixture.ts` and `packages.fixture.ts` with different values. `get-all-packages.ts` silently lets rails win. Home's card shows Do Dham Yatra was `₹31,900` / Save `₹3,000` / 7 Days; its detail page shows was `₹32,400` / Save `₹3,500` / 6 Days. Which record is canonical?
2. **False visitor-facing copy inherited verbatim from the design export.** "Server-side validated, rate-limited" (no server exists), "Creating your lead in the CRM" (the write always fails by Decision A), Trip Finder's "Showing upcoming departures" and "takes you to the trip builder" (neither exists), video captions "Departed 06 Oct 2026" (a future date). Pixel-fidelity was treated as authority for copy as well as layout.
3. **Legal pages 404 while the site collects name/mobile/email** — `/legal/privacy-policy`, `/terms-and-conditions`, `/cancellation-policy`, `/refund-policy`.

## Fixable without a product decision (not yet done)
- `TestimonialsCarousel` and `JourneyVideoBlock` throw on an empty array (`testimonials[index].travellerName`); the fixtures' own `TODO(real-testimonials)` instructs the action that triggers it.
- Placeholder testimonials still render a fabricated `ratingOutOf5: 5` as five gold stars — contradicts Decision H.
- `get-all-packages.ts` has no tests despite holding the only non-trivial data logic.

**Why:** several prior executor runs were cut off by rate limits; this records verified state so the next run resumes instead of redoing work.
**How to apply:** re-read this file, run `git log --oneline`, then take the product decisions above to the user before touching fixtures or copy.
