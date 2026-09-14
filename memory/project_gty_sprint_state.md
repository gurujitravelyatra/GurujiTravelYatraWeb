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

- `14c6a65`, `3862a5d`, `617f8d8`: **independent pre-merge review findings fixed** (verdict was BLOCK: 2 Critical, 4 High, 7 Medium, 6 Low; 3 items needed and got user product decisions).
  - `pricingUnverified` is now ENFORCED, not just documented: `src/content/public-listing.ts` withholds those 3 tours from every listing query, and their detail URLs 404. Fixture data kept — re-including one is deleting a single flag line.
  - Instagram handle confirmed by the user: **`gurujitravelyatra`** (no underscores). Contact facts extracted to `src/lib/gty-contact.ts`.
  - Stats marked `isPlaceholder` (user chose placeholder treatment over picking a number); `Hero`'s duplicate `HERO_STATS` deleted — one `getStats()` feeds hero, stats bar and the "Why" band.
  - `/tour-packages` now reads validated `?category=` / `?destination=`; destination cards, "View All International Tours", footer Top Destinations and the rail "View All" buttons deep-link to real filtered results. Route is now server-rendered per request (documented tradeoff).

Gate status at `617f8d8`: `tsc --noEmit` clean, `eslint` clean, `next build` clean (19 SSG tour paths — down from 22, the 3 withheld), Jest **25 suites / 242 tests** pass, Playwright **55/55** pass.

- `edc328f`..`21067e1`: **THIRD fix round — second independent pre-merge review's 8 findings (F1-F8) all closed.** All were downstream ripples of the earlier fixes, not new defects; see `feedback_qg_stale-invariant-after-fix.md`.
  - F1 no code change (product decision: naming a withheld tour is fine, showing its price never is) — pinned by a new regression test.
  - F2 placeholder footnotes now reach assistive tech on all three surfaces (id + `aria-describedby` on a **roled** group + visible asterisk).
  - F3 `alternates.canonical: '/tour-packages'` + `metadataBase` from `NEXT_PUBLIC_SITE_URL` (no guessed domain).
  - F4 `src/lib/card-grid.ts` drives columns from item count; one dot per card; `src/hooks/use-horizontal-overflow.ts` gates both rails' scroll arrows on measured overflow.
  - F5 Trip Finder CTA deep-links per tab; stale "takes no category param" comment corrected.
  - F6 a filtered view renders ONE `FilteredResults` section; the 4 rails are the unfiltered view only.
  - F7/F8 stale test reference and "Thousands of happy travellers every year" removed.

Gate status at `21067e1`: `tsc --noEmit` clean, `eslint` clean, `next build` clean, Jest **29 suites / 302 tests** pass, Playwright **58/58** pass. Zero admin/login/CMS surface and the pricing gate both still verified by E2E.

- `853b29e`..`0cc96e2`: **the three primary nav routes built and covered** (Decision G2 reversed Decision G for them — the Navbar/Footer/mobile menu linked to `/group-tours`, `/customize-tours` and `/about-us` with no pages behind them, i.e. three real 404s found in manual testing).
  - `853b29e` content models, `2d0f6c8` the three pages, `08b2047` E2E (incl. `nav-routes.spec.ts`, which fails if any nav link outlives its page), `24051c4` 66 unit tests.
  - `2e683f0`: Jest `testTimeout: 30_000`. Three pre-existing suites were failing in full runs and passing alone — `userEvent` + large client components crossing the 5s default under worker contention. The timeout was measuring machine load, not correctness.
  - `10dabca`: **E2E now boots the standalone server the Dockerfile ships.** `playwright.config.ts` ran `next start`, which Next rejects under `output: "standalone"` — it warned and served a non-standalone server anyway, so the suite was green against a server production never runs. `scripts/start-standalone.mjs` mirrors the runner stage's asset layout; `npm start` delegates to it.

Gate status at `0cc96e2`: `tsc --noEmit` clean, `eslint` clean (0/0), `next build` clean, Jest **41 suites / 371 tests** pass, Playwright **84/84** pass against the standalone server.

- `ae7466f`, `af92be2`: **BLOCKERS.md item 9 closed — `/group-tours` no longer publishes the price `/tour-packages` withholds.** User chose marking over withholding: the departure card carries no fabricated "was ₹X / Save ₹Y" badge, so a standalone unconfirmed figure gets the asterisk + footnote treatment, and withholding would have emptied a quarter of the page. `GroupDeparture.priceUnverified` set on "Do Dham Yatra"; `GroupDepartureCard` renders the three-part marker (visible `aria-hidden` asterisk + `aria-describedby` + a **role** on the container), `GroupDeparturesList` renders one `#group-price-note` per filtered view, separate from the duration note. The duration marker's own `aria-describedby` was on an unroled `<span>` and got the role too. A fixture cross-check test now compares `priceUnverified` and the price string against `packages.fixture.ts`, so the two fixtures cannot drift — including when GTY confirms the price and only one flag is cleared.

Gate status at `af92be2`: `tsc --noEmit` clean, `eslint` clean (0/0), `next build` clean (19 SSG tour paths), Jest **41 suites / 384 tests** pass, Playwright **84/84** pass. Note: E2E is load-sensitive on this machine — a first run showed 4 `toHaveURL` failures in `home.spec.ts`/`tour-packages.spec.ts` that all passed on a serial re-run against a pre-built standalone server. When the 300s `webServer` build times out it leaves `.next` incomplete; rebuild before re-running.

- `51165c0`: **lead modals are code-split — the first real perf fix on this branch.** `layout.tsx` static-imported `<EnquiryModal />` + `<BrochureModal />`, so react-hook-form + zod + framer-motion + Radix Dialog rode along in a single 249,143-byte chunk (76,946 gzipped) referenced by **all 26** prerendered routes. New `src/components/modals/ModalHost.tsx` (client, `next/dynamic` + `ssr: false` — illegal in `layout.tsx`, which is a Server Component) loads them on first open. `ModalProvider`/`useModal()` stay eager and unmodified, so all nine trigger call sites are untouched. Once opened, a variant stays mounted rendering closed — required, because `ModalShell`'s exit animation (`AnimatePresence` + `forceMount`) only runs when `open` flips true→false on a *mounted* subtree.
  - Initial JS per route: `/about-us` and the 16 tour detail pages **862 → 612 KiB (-250)**, `/legal/*` **861 → 587 (-274)**, `/group-tours` 874 → 625, `/customize-tours` 883 → 629. Home only **881 → 874 (-7)** and that is correct, not a miss: its `Newsletter` uses react-hook-form + zod and `RecentTripsGallery` uses Radix Dialog directly, so the chunk is genuinely part of its own payload. Heavy chunk now on 1/26 routes instead of 26/26.
  - Chromium network trace against the standalone server: on `/about-us` the chunk was request #11 of 14 in the initial burst (+198ms) before, and is absent from the initial burst after (it only appears at +395ms as idle prefetch for `/`). With route prefetch suppressed, clicking "Enquire Now" fetches exactly it plus the 16 KiB modal chunk; form types, Escape closes, re-open fetches nothing.

Gate status at `51165c0`: `tsc --noEmit` clean, `eslint` clean (0/0), `next build` clean, Jest **41 suites / 384 tests** pass, Playwright **84/84** pass (the enquiry + brochure modal flows exercise exactly the changed path). No PR — still no git remote.

- `f0f1bbb`..`df5257b`: **interim Postgres content database added — CLAUDE.md line 56 overridden by the user.** Full reasoning in `BLOCKERS.md` §5 and `project_gty_content_database.md`. Prisma schema + initial migration + seed for tours/destinations/group departures/brochures; `PrismaContentAdapter` implements `ContentPort` (and a new, separate `BrochurePort`) and delegates testimonials/stats/videos/milestones/places to `FixtureContentAdapter`. The `contentAdapter` singleton moved out of `fixture-content-adapter.ts` into a real composition root, `src/content/content-adapter.ts`; pages changed by one import line each and `ContentPort`'s contract is unchanged.
  - The seed **imports** the fixtures rather than restating them (a hand-copy would be occurrence 3 of `feedback_qg_duplicate-fixture-transcription`) and re-asserts the item 9 cross-model price-flag invariant before writing.
  - All three safety flags are real columns AND still enforced: every public tour query ends in the same `isPubliclyListable()` predicate the fixture path uses. A test returns a flagged row from the mock *despite* the `where` clause and asserts the adapter still withholds it.
  - No fabricated assets: every brochure row has `pdfUrl` NULL / `status` PENDING_UPLOAD (no PDFs exist), `dateRangeLabel` NULL (tours have no dates in any source), `priceLabel` NULL for withheld tours.
  - `DATABASE_URL` chooses the adapter; unset = fixtures = the supported mode all gates run in. `jest.setup.ts` deletes it so the suite is hermetic.

Gate status at `df5257b`: `tsc --noEmit` clean, `eslint` clean (0/0), `next build` clean (19 SSG tour paths — gate intact), Jest **43 suites / 401 tests** pass, Playwright **84/84** pass. **All on the fixture path** — see open item 8.

## Still open before merge
1. **Independent verification of the third fix round** on `6c38291..21067e1` — a fresh `edge-case-adversary` owns this; the implementer must not self-review. (Rounds 1 and 2 are verified and closed.) The three new nav-route pages (`853b29e`..`0cc96e2`) have NOT had an adversary pass either.
1b. ~~**`/group-tours` publishes the ₹28,900 the catalogue withholds**~~ — **CLOSED `af92be2`** (user chose the asterisk-mark option). Folded into open item 4: the underlying price is still unconfirmed.
2. **Legal copy is placeholder** — written by the build, not reviewed by counsel. It must go to GTY's lawyer before launch, and the banner + `robots: index=false` stay until it does.
3. **Four Support links still 404 by Decision G**: `/legal/faqs`, `/legal/travel-tips`, `/legal/cancellation-policy`, `/legal/refund-policy`. Deliberate — invented cancellation terms would be worse than a 404. Pinned by `e2e/legal.spec.ts`.
4. **`pricingUnverified` still needs real figures** for "Do Dham Yatra", "Kashmir Family Escape", "Kashi Darshan". No longer a correctness risk (withheld from every listing, 404 by slug) and no longer a layout risk as of `ac1ffc5` (grid, dots and arrows all track the real count), but Home's Popular rail and the Trending rail each show only 2 cards until this is confirmed. Same for `stats.fixture.ts`'s `isPlaceholder` figures, which render with an asterisk + "pending confirmation" footnote. **Do Dham Yatra is now flagged in two fixtures** — clearing `pricingUnverified` in `packages.fixture.ts` without also clearing `priceUnverified` in `group-departures.fixture.ts` (or vice versa) fails `group-departures.test.ts` by design.
5. Consolidation side effect to confirm with the user: Home now shows the rails categorisation for two tours (`Family`, `Spiritual`) rather than the `popular` one (`Family Trip`, `Pilgrimage`). One record means one category; neither transcription is confirmed. `Family Trip`/`Pilgrimage`/`Mountains` now match zero records and so produce no filter chip.
6. Contact-constant duplication **partly fixed**: `src/lib/gty-contact.ts` now owns phone/WhatsApp/email/address/Instagram, and `Footer`, `BottomContactStrip`, `MobileActionBar`, `InstagramStrip` use it. `HeaderControls`, `MobileMenu` and the two legal pages still hold local copies — finish the pass when next in those files.
7. Non-Instagram social handles (`YouTube`, `Facebook`, `X`, `LinkedIn`) remain `href="#"` — still unconfirmed, deliberately not invented.

8. **The content database has never touched a real Postgres.** Docker is still not installed, so the migration was never applied and the seed never inserted a row. `prisma validate` / `generate` / `migrate diff` pass and the adapter is unit-tested against a **mocked** client — but no SQL has executed, and every green gate above ran on the fixture path with `DATABASE_URL` unset. First run against a real database should be treated as untested code. (`binaries.prisma.sh` is also unreachable here — `prisma` installs only with `--ignore-scripts`, which is enough for `validate`/`generate` but not for `migrate dev`/`db seed`.)
9. **Content now exists in two places** (`prisma/seed.ts` projects `src/content/fixtures/*`) until the ERP content API lands. The seed importing the fixtures keeps them from drifting, but the real fix is still §1b.

**Why:** several prior executor runs were cut off by rate limits; this records verified state so the next run resumes instead of redoing work.
**How to apply:** re-read this file, run `git log --oneline`, then take the open items above to the user before touching fixtures or copy.
