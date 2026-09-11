---
name: GTY site setup — SPEC pipeline state
description: Where the GTY SPEC pipeline stands on feat/gty-site-setup, and what remains before merge. Read before resuming.
type: project
---

Branch: `feat/gty-site-setup`. No git remote, no `gh` — PR creation is skipped by user instruction.

## Done (committed, all gates green)
- `4d32279` and earlier: scaffold, tokens, Docker, content layer, global components, Home / Tour Packages / package detail pages.
- `79535bc`, `85acf9b`: Jest config + unit suites, Playwright E2E.
- `35ff926`: **tour data consolidated to a single source of truth.** `packages.fixture.ts` now holds all 22 tour records (20 rail + 2 popular-only); rails and `popular.fixture.ts` are derived views sharing the same object instances. Duplicate slug throws at construction. The 3 tours the export transcribed inconsistently are flagged `pricingUnverified` + `TODO(pricing-confirm)` — no winner guessed, no third number invented. `ContentPort.getAllTours()` added; `get-all-packages.ts` is now a pass-through and has tests.
- `80d46e3`: **false copy removed, fabricated content removed, empty states guarded.** LeadModal disclaimer + sending-step copy made honest and variant-aware; video captions de-dated; placeholder testimonials no longer carry `ratingOutOf5` (now optional, ReviewCard gates the star row); `TestimonialsCarousel` / `JourneyVideoBlock` render "coming soon" instead of throwing on an empty array.

Gate status at `80d46e3`: `tsc --noEmit` clean, `eslint` clean, `next build` clean (27 static pages, 22 tour routes), Jest **18 suites / 135 tests** pass, Playwright **24/24** pass.

## Still open before merge
1. **Trip Finder tab hints assert filters that do not run** (`src/content/fixtures/tabs.fixture.ts`) — "Showing upcoming departures with seats still open", "Showing family-paced trips: Kashmir, Nepal, Rameshwaram" (Nepal is in no fixture), "Takes you to the trip builder — nine short questions" (no trip builder exists). Same class as the resolved LeadModal copy; was part of the original blocker #2 but the user's resolution scoped only LeadModal + the video dates. Needs a product decision on what the tabs should say.
2. **Legal pages 404 while the site collects name/mobile/email** — `/legal/privacy-policy`, `/terms-and-conditions`, `/cancellation-policy`, `/refund-policy`. Flagged by the pre-merge adversary; not in the user's 2-critical resolution set.
3. **`pricingUnverified` must be cleared** with confirmed figures for "Do Dham Yatra", "Kashmir Family Escape", "Kashi Darshan" before the site quotes those prices publicly.
4. Consolidation side effect to confirm with the user: Home now shows the rails categorisation for two tours (`Family`, `Spiritual`) rather than the `popular` one (`Family Trip`, `Pilgrimage`). One record means one category; neither transcription is confirmed. `Family Trip`/`Pilgrimage`/`Mountains` now match zero records and so produce no filter chip.

**Why:** several prior executor runs were cut off by rate limits; this records verified state so the next run resumes instead of redoing work.
**How to apply:** re-read this file, run `git log --oneline`, then take the open items above to the user before touching fixtures or copy.
