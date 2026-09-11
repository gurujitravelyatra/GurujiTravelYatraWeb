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

- `893ccaf`: **Trip Finder tab hints rewritten to describe real behaviour.** No seat/departure claims, no Nepal, no trip builder. Only the three tabs whose theme maps to a real derived filter chip (Spiritual, Family, Adventure) mention filtering. Copy-only — layout untouched.
- `ec889e1`: **Footer copyright year computed** (`new Date().getFullYear()`) instead of a literal 2026. Build-time resolution on statically prerendered routes; documented as such rather than claiming per-request freshness.
- `9177ffd`: **`/legal/privacy-policy` and `/legal/terms-and-conditions` built** on a shared `LegalPageShell` (reuses `SiteShell`, breadcrumb + type scale of the package detail page). Both carry a visible "Placeholder — not final" notice naming legal-counsel review, and disclose that the forms do not submit anywhere yet. Both `robots: index=false`.

Gate status at `9177ffd`: `tsc --noEmit` clean, `eslint` clean, `next build` clean (29 static pages incl. the 2 legal routes), Jest **20 suites / 165 tests** pass, Playwright **32/32** pass.

## Still open before merge
1. **Independent pre-merge adversary gate not yet run** on `893ccaf..9177ffd`. The implementer must not self-review — a separate fresh `edge-case-adversary` owns this.
2. **Legal copy is placeholder** — written by the build, not reviewed by counsel. It must go to GTY's lawyer before launch, and the banner + `robots: index=false` stay until it does.
3. **Four Support links still 404 by Decision G**: `/legal/faqs`, `/legal/travel-tips`, `/legal/cancellation-policy`, `/legal/refund-policy`. Deliberate — invented cancellation terms would be worse than a 404. Pinned by `e2e/legal.spec.ts`.
4. **`pricingUnverified` must be cleared** with confirmed figures for "Do Dham Yatra", "Kashmir Family Escape", "Kashi Darshan" before the site quotes those prices publicly.
5. Consolidation side effect to confirm with the user: Home now shows the rails categorisation for two tours (`Family`, `Spiritual`) rather than the `popular` one (`Family Trip`, `Pilgrimage`). One record means one category; neither transcription is confirmed. `Family Trip`/`Pilgrimage`/`Mountains` now match zero records and so produce no filter chip.
6. Minor smell, not fixed (out of scope, touches 5 files): the GTY phone/email constants are duplicated locally in `Footer`, `BottomContactStrip`, `HeaderControls`, `MobileActionBar`, `MobileMenu` — and now the two legal pages follow that same convention. Worth one extraction pass into a shared contact module.

**Why:** several prior executor runs were cut off by rate limits; this records verified state so the next run resumes instead of redoing work.
**How to apply:** re-read this file, run `git log --oneline`, then take the open items above to the user before touching fixtures or copy.
