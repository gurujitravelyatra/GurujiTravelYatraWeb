# GTY Website — Open Blockers

Pipeline: SPEC. Branch: `feat/gty-site-setup`.
Status: **decisions A–H resolved 2026-09-10 — component/page implementation resumed.**

Raised by the spec-time `edge-case-adversary` gate against
`gty-site-setup.md`, plus two contracts already known to be unconfirmed.
Nothing below was guessed at or worked around.

This file is kept as the audit trail. Resolutions are recorded inline; the
original framing of each decision is preserved above its resolution.

---

## 1. Blocking cross-repo contracts (already known)

### 1a. ERP lead-creation endpoint — STILL UNCONFIRMED
Endpoint, payload schema and auth mechanism are undefined (CLAUDE.md §10, §12).
No URL, field shape, or API-key scheme has been invented.

**Knock-on effect that was not anticipated:** this does not just block the
network call. CLAUDE.md §8 says *"Do not build a sprint UI-only and defer the
ERP integration to a later sprint — brochure and enquiry flows must be real,
working lead submissions by the sprint that introduces them, not stubbed"*, and
§9's Definition of Done requires *"any form on the page successfully creates a
real lead in the ERP (not a mocked/stubbed API call)."*

So the instruction "build the modal UI up to the boundary" and CLAUDE.md's own
DoD are in direct conflict. Every lead surface on the site (Enquiry modal,
Brochure modal, newsletter, and every "Enquire Now" / "Download Brochure" CTA
that opens them) would ship wired to a form that can **never** succeed.

> **RESOLVED 2026-09-10 (user, explicit override — see Decision A).**
> The user has explicitly overridden CLAUDE.md §8/§9 **for this sprint only**.
> The contract itself remains unconfirmed and is **still the real blocker for
> production readiness** — this override unblocks UI work, it does not satisfy
> CLAUDE.md's Definition of Done. See Decision A for the exact terms.

### 1b. ERP public content-read endpoint — STILL UNCONFIRMED
CLAUDE.md §6 requires stopping if the ERP does not expose a public read API for
Tours/Destinations/Brochures, and explicitly forbids working around it with a
duplicate content model. §12 lists "launch with placeholder content first vs.
wait for the API" as a stop-and-ask item.

This blocks the **Tour Packages** page, which is entirely a catalogue of ERP
content.

> **MITIGATED, not resolved.** No duplicate content *model* was created. The
> `ContentPort` interface in the tech spec §6.1 is the single content contract;
> `FixtureContentAdapter` implements it by transcribing the design export's own
> constants verbatim. Swapping to `ErpContentAdapter` is a one-file change and
> touches no page or component code. The read API is still unconfirmed.

---

## 2. Decisions needed before component/page work resumes

All eight are now answered. Original framing preserved; resolution follows each.

| # | Decision | Why it blocks |
|---|---|---|
| A | Ship public CTAs wired to an always-failing form, or visibly disable / mark them "pre-launch"? | Resolves the §8/§9 conflict above. Affects every CTA on the site. |
| B | What user-facing copy replaces the internal `NotImplemented` error string? | Current spec would show a real visitor a message citing "CLAUDE.md §10/§12". |
| C | What renders for a category chip with **0** matches — empty state, hide, or disable? And do `International` / `Beach` / `Himalaya` / `Family Trip` / `Pilgrimage` become real chips or get remapped? | `Honeymoon` and `Wildlife` chips match 0 of 20 items → the whole Tour Packages page renders hero + filter and nothing else. The `International` rail matches no chip at all and vanishes under every filter. |
| D | What does a Package Card click do this sprint, given `/tour-packages/[slug]` detail pages are out of scope? | All 25 cards are otherwise dead links or 404s. |
| E | Is the heart/favourite icon inert decoration this sprint, or removed? | No auth and no storage exists to persist a favourite. |
| F | What does the modal context chip say when there is genuinely **no** package context (navbar "Enquire Now" on Home)? | Product-spec §4's "context is never re-asked" assumes context always exists. The design export's own fallback silently shows a package the visitor never clicked. |
| G | Dead nav/footer links (`/group-tours`, `/customize-tours`, `/about-us`, `/legal/*`) — branded 404, hidden, or ship as-is? | ~12 links across Navbar/Footer/MobileMenu; no `not-found.tsx` in scope. |
| H | **Testimonials and International destinations have no source data in the design export at all.** Invent fixture content, or cut those sections this sprint? | This one needs a human call specifically because inventing customer testimonials means fabricating reviews and traveller names for a real travel brand. Not something to auto-generate. |

---

### RESOLUTIONS

#### A — Build the modal UI fully; submit is an explicit, single-point stub
**Decided by:** user, 2026-09-10. **Explicit override of CLAUDE.md §8 / §9, this sprint only.**

- Build the Enquiry modal and Brochure modal **UI, validation and local state fully** —
  form step, sending step, done step, error step, context chip, focus management.
- The actual submit call is a **clearly-marked stub**: one well-named function
  (`submitLead` in `src/content/adapters/not-implemented-lead-adapter.ts`) carrying a
  single `TODO(ERP-LEAD-API)` comment. **Not** scattered fakes across components.
- **Do not fabricate** an endpoint URL, payload shape, or auth mechanism. The
  `LeadPayload` type (tech spec §6.2) is derived from the *form fields the design
  export actually renders*, not from any assumed ERP schema.
- **This does not satisfy CLAUDE.md's Definition of Done.** The ERP lead contract
  remains the blocker for production readiness and must be reported as such.

#### B — Visitor-facing copy for the stubbed submit
**Decided by:** executor, 2026-09-10, as a direct consequence of A. **Conservative default — needs product sign-off before any public deploy.**

The internal string citing "CLAUDE.md §10/§12" must never reach a visitor. Applying the
same principle the user set for H (*obvious placeholder, never plausible-looking fake*):

- The `NotImplementedLeadAdapter` keeps its **internal** developer message
  (surfaced to `console.warn` in dev only), and returns a separate
  `message` field carrying visitor-safe copy.
- Visitor-facing copy is deliberately marked as unfinished rather than written as
  polished marketing text, so it cannot be mistaken for shippable copy:
  `"Online enquiry submission isn't connected yet — please call +91 90999 57658. (Placeholder copy — pending ERP integration.)"`
- The phone number is the real one from the design export (verified), so the
  fallback path is genuinely actionable.

#### C — Filter chips are derived from real data; `Honeymoon` and `Wildlife` removed
**Decided by:** user, 2026-09-10.

Only categories with **actual matching tour data** among the design export's 20
`RAILS` items are rendered as chips. Verified counts:

| Chip | Matching items |
|---|---|
| All | 20 |
| Spiritual | 5 |
| International | 5 |
| Family | 4 |
| Adventure | 3 |
| Cultural | 2 |
| Beach | 1 |
| ~~Honeymoon~~ | 0 → **chip removed** |
| ~~Wildlife~~ | 0 → **chip removed** |

Consequences:
- The zero-match empty state becomes **unreachable by design** — no chip can produce it.
  An empty-state branch is still implemented as a defensive fallback (it renders a
  "no journeys match" message rather than a blank page), but no chip reaches it.
- `International` is now a real chip, so the International rail no longer vanishes
  under every filter.
- The chip list is **generated from the fixture data**, not hardcoded, so it stays
  correct automatically when the ERP adapter replaces the fixtures.

#### D — Build a minimal `/tour-packages/[slug]` detail page
**Decided by:** user, 2026-09-10.

- Build the route now, using the existing 20 tours' data from the design export.
- **Keep it small and in scope.** Reuse existing card/data structures.
- **Do not invent content fields** not present in the export. The detail page renders
  only: photo, name, destination, category, duration, subtitle/route, photo count,
  price, "was" price, savings. There is no day-by-day itinerary, no inclusions /
  exclusions list, no map — the export has those only on its own `packDetail` screen,
  fed by `PACKS[0]` regardless of which card was clicked (i.e. it is not real
  per-tour data and would have to be fabricated).
- Package cards become `<Link href="/tour-packages/{slug}">` instead of dead buttons.

#### E — Heart icon stays as inert decoration (matches the export exactly)
**Decided by:** executor, 2026-09-10. **Verified against the export, not a guess.**

The export renders the heart at `.dc.html` line 201 as a **`<span>`**, not a button —
alongside the category pill (line 200) and photo-count badge (line 202), all `<span>`s
inside the outer card element. It has no click handler anywhere in the file.

- Keep it visually identical (pixel accuracy preserved), rendered as a
  non-interactive `<span>` with `aria-hidden="true"`.
- This **also removes the nested-interactive-element defect** listed in §4 below:
  keeping the export's own `<span>` structure means the card contains no nested
  button, so making the card a `<Link>` (Decision D) is valid DOM.
- Nothing is added to persist a favourite. No auth, no storage.

#### F — No fabricated context; the chip reflects real context or is omitted
**Decided by:** executor, 2026-09-10. **Already resolved by the tech spec; the export is the defect.**

The export's fallback (`.dc.html` line 1193–1195) resolves `ctxValue` to
`p.name + ' · ' + p.dur` where `p` defaults to `PACKS[0]` — so a visitor clicking
"Enquire Now" in the navbar on Home sees *"Spiti Valley Circuit · 9 Nights / 10 Days"*,
a package they never clicked. That is misleading and is **not** ported.

- Opened from a package card → chip shows `{ label: 'Package', value: <that package> }`.
- Opened from header / hero / mobile bar → chip shows `{ label: 'Page', value: <current page> }`,
  exactly as tech spec §4.4 and acceptance criterion 6 already require.
- If neither is available → the chip is **omitted entirely**. Never a fallback package.

#### G — Links ship as designed, backed by a branded 404
**Decided by:** executor, 2026-09-10. **Conservative default — needs product confirmation.**

- Nav/footer links render **exactly as the export designs them** (`/group-tours`,
  `/customize-tours`, `/about-us`, `/legal/*`, …). Hiding them would break the
  pixel-accuracy requirement and cause churn when those pages land in Sprints 3–6.
- A minimal branded `src/app/not-found.tsx` is added so those links land on a GTY-styled
  "this page is coming soon" shell instead of Next.js's unstyled default 404.
- The 404 page invents **no content** — headline, a line of copy, and links back to
  the two routes that do exist.
- This does **not** create any route: `not-found.tsx` is Next.js's 404 handler, so
  tech spec acceptance criterion 9 ("no route other than `/` and `/tour-packages`")
  and E2E test 10 (`/admin` etc. must 404) both still hold.

#### H — Section shells built; content is obvious placeholder, never fabricated
**Decided by:** user, 2026-09-10.

No real source content exists for Testimonials. Therefore:

- **Build the layout / section shell and styling now**, matching the design export's
  visual treatment (single-slide arrow carousel, `ReviewCard` composition).
- **Fill it with obviously-placeholder content.** Quote text reads
  *"Testimonial copy pending — do not ship without real customer quotes."*
  Traveller names are marked placeholders (e.g. `[Traveller name pending]`), never
  realistic-sounding Indian names that could be mistaken for real customers.
- **Never fabricate** realistic customer reviews, names, ratings presented as real,
  or destination copy.
- Placeholder entries carry a `isPlaceholder: true` flag in the fixture and a
  `TODO(real-testimonials)` comment, so they are greppable before launch.

> **Note on International Destinations:** the original framing of H was partly
> incorrect. The design export **does** contain International destination data —
> `.dc.html` line 1127 lists Maldives, Singapore, Thailand, Malaysia, Bali, Dubai,
> and the `International Tour Packages` rail (lines 978–984) carries five fully
> specified packages. Only *taglines/region/slug* are absent for the six-item
> `DestinationCard` rail, and the export renders only the name over a photo, so
> nothing needs inventing. **International Destinations is built from real export
> data. The placeholder treatment applies to Testimonials only.**

---

## 3. Data-model defects in the spec (mechanical — fixed during implementation)

> **RESOLVED 2026-09-10** — all four fixed while implementing, now that C is answered.

- ~~The `DestinationCategory` union in §6.1 does not contain `Himalaya`,~~
  ~~`Family Trip`, `Pilgrimage`, `Beach`, `Honeymoon` or `Wildlife`~~ →
  **Fixed.** The union is now derived from the values that actually appear in the
  export's fixtures: `Spiritual | Mountains | Cultural | Family | Adventure |
  International | Beach | Himalaya | Family Trip | Pilgrimage`. `Honeymoon` and
  `Wildlife` appear in **no** fixture record (they existed only in the chip list)
  and are correctly absent — consistent with Decision C. Verbatim fixtures and
  zero TS errors are now simultaneously satisfiable.
- ~~§4.4 cites `DESTS` as the source for `getPopularDestinations()`~~ →
  **Fixed.** The real source is the inline `popular` array (`.dc.html` lines 1112–1119),
  which does carry price/photos/subtitle. `DESTS` is not used for this method.
- ~~`getInternationalDestinations()` maps to 6 bare name+photo strings~~ →
  **Fixed.** `Destination` fields not present in the export (`region`, `category`,
  `tagline`) are optional on the type. The rail renders only name + photo, which is
  all the export renders — so nothing is invented to satisfy the type.
- ~~`GroupTour` is defined with no `ContentPort` method and no in-scope route~~ →
  **Fixed.** `GroupTour` is removed from this sprint's contract entirely. `/group-tours`
  is a Sprint 3–6 route (Decision G); the type belongs to the sprint that builds it.

## 4. Accessibility / correctness items (fixed during implementation)

> **RESOLVED 2026-09-10** — all seven addressed in the implementation.

- ~~Focus ring is `2px solid #d80000` — invisible against the red footer band~~ →
  **Fixed.** Global `:focus-visible` keeps the red ring; a `.on-red` scope in
  `globals.css` overrides it to a white ring on the footer band, active `.pchip`,
  and stats band.
- ~~Card composition nests a heart button and a photo-count badge inside an outer `<button>`~~ →
  **Fixed by Decision E** — the export's own `<span>` structure is preserved, so there
  is no nested interactive element and the card can be a `<Link>`.
- ~~`utm` capture implies `useSearchParams()`, which requires a Suspense boundary~~ →
  **Fixed.** UTM values are read **only inside the submit event handler** via
  `window.location.search`, never during render. No `useSearchParams()`, so no
  Suspense boundary is needed and no route is forced dynamic.
- ~~Hero photo "rotates through 6 keys" with no stated trigger~~ →
  **Fixed.** The hero photo is **deterministic** — a fixed key chosen at build time,
  not rotated. No `Math.random()`, no `Date`-derived index, so no hydration mismatch
  and a stable SEO hero. Rotation was never in the export's Home render path.
- ~~`sourcePageUrl` read during render would cause a hydration mismatch~~ →
  **Fixed.** Read in the submit event handler only, same as UTM.
- ~~Modal focus **restore** is not automatic when the trigger lives outside the Radix tree~~ →
  **Fixed.** `modal-context.tsx` captures `document.activeElement` when a modal opens
  and restores focus to it on close.
- ~~Category chips need `aria-pressed` / radiogroup semantics and a live region~~ →
  **Fixed.** The chip row is a `role="group"` of `aria-pressed` toggle buttons, with
  an `aria-live="polite"` region announcing the filtered journey count.

---

## What was delivered

**Before the pause (decision-independent):** Next.js scaffold, the full extracted
design-token layer, self-hosted fonts, the logo asset, the Docker files.

**After A–H were answered:** the global component set, Home, Tour Packages, and the
`/tour-packages/[slug]` detail page — per the resolutions above.

## Still open after this sprint

1. **ERP lead-creation contract (1a)** — the genuine production blocker. Decision A
   unblocked the UI; it did not satisfy CLAUDE.md's Definition of Done.
2. **ERP public content-read API (1b)** — fixtures are a documented stand-in behind
   `ContentPort`, not a resolution.
3. **Real testimonial content (H)** — placeholders are greppable via
   `TODO(real-testimonials)` and must be replaced before launch.
4. **Visitor-facing stub copy (B)** and **the branded 404 (G)** were conservative
   executor defaults and need product sign-off.
5. **Social media URLs** — still `href="#"` with `TODO(social-links)`.
6. **Docker** — `Dockerfile` / `docker-compose.yml` are written but **unvalidated**;
   Docker is not installed in this environment.
