# GTY Website — Open Blockers

Pipeline: SPEC. Branch: `feat/gty-site-setup`.
Status: **foundation delivered, component/page implementation paused.**

Raised by the spec-time `edge-case-adversary` gate against
`gty-site-setup.md`, plus two contracts already known to be unconfirmed.
Nothing below was guessed at or worked around.

---

## 1. Blocking cross-repo contracts (already known)

### 1a. ERP lead-creation endpoint — UNCONFIRMED
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

### 1b. ERP public content-read endpoint — UNCONFIRMED
CLAUDE.md §6 requires stopping if the ERP does not expose a public read API for
Tours/Destinations/Brochures, and explicitly forbids working around it with a
duplicate content model. §12 lists "launch with placeholder content first vs.
wait for the API" as a stop-and-ask item.

This blocks the **Tour Packages** page, which is entirely a catalogue of ERP
content.

---

## 2. Decisions needed before component/page work resumes

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

## 3. Data-model defects in the spec (mechanical, fixable once C is answered)

- The `DestinationCategory` union in §6.1 does not contain `Himalaya`,
  `Family Trip`, `Pilgrimage`, `Beach`, `Honeymoon` or `Wildlife`, all of which
  appear in the fixture data §6.3 mandates be transcribed verbatim. As written,
  the spec cannot simultaneously satisfy "verbatim fixtures" and "zero TS
  errors" — `tsc` fails on day one.
- §4.4 cites `DESTS` as the source for `getPopularDestinations()`, but `DESTS`
  has no price/photos/subtitle and cannot produce a `Package`. The real source
  is the inline `popular` array.
- `getInternationalDestinations()` maps to 6 bare name+photo strings; the
  `Destination` type requires `slug`/`region`/`category`/`tagline`.
- `GroupTour` is defined with no `ContentPort` method and no in-scope route.

## 4. Accessibility / correctness items to fix during implementation

- Focus ring is `2px solid #d80000` — invisible against the red footer band
  (`#d80000`, ~15 links) and the active `.pchip`. Needs a light ring on dark
  surfaces.
- Card composition nests a heart button and a photo-count badge inside an outer
  `<button>` — invalid DOM, React warning, Lighthouse a11y failure.
- `utm` capture implies `useSearchParams()`, which requires a Suspense boundary
  or `next build` fails on a static route.
- Hero photo "rotates through 6 keys" with no stated trigger — hydration
  mismatch risk and non-deterministic SEO hero.
- `sourcePageUrl` read during render would cause a hydration mismatch; must be
  event-handler-only.
- Modal focus **restore** is not automatic when the trigger lives outside the
  Radix Dialog tree (which the global modal-context pattern guarantees).
- Category chips need `aria-pressed` / radiogroup semantics and a live region
  for the filtered count.

---

## What was delivered anyway (decision-independent)

Everything below is unaffected by A–H and is committed and verified:
Next.js scaffold, the full extracted design-token layer, self-hosted fonts,
the logo asset, and the Docker files.
