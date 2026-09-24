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

#### G2 — SUPERSEDES G for the three primary nav routes
**Decided by:** user, 2026-09-11, after manual browser testing. **This is the product
confirmation Decision G was explicitly waiting on — and it came back the other way.**

Decision G was recorded as a *"conservative default — needs product confirmation"*
and listed as still-open item 4 below. The user then hit the 404s in a browser and
reported them as a bug. The framing that matters: `/about-us`, `/group-tours` and
`/customize-tours` are linked from the **Navbar, the Footer AND the mobile menu**.
Three of the site's primary nav items sent every visitor to a 404. A branded 404 is
an acceptable landing for a footer link to an unbuilt policy page; it is not an
acceptable landing for a top-level nav item.

Re-checking the sources also showed the deferral rested on a false premise. The
design export carries **complete artboards for all three screens** — `isGroup`
(lines 480–559), `isCustom` (lines 561–722), `isAbout` (lines 724–738) — plus their
backing constants `GROUPS`, `PLACES` and `timeline`. Product-spec §5.4, §5.5 and
§5.8 specify all three. Nothing had to be invented for Group Tours or Customize
Tours.

- **Built:** `/group-tours`, `/customize-tours`, `/about-us`.
- **Unchanged:** `/destinations`, `/our-services`, `/travel-guide`, `/contact-us`
  are still unbuilt, still Footer-only links, still backed by the branded 404.
  Decision G still governs those four.
- **Unchanged:** the Hard Architecture Boundary. No admin, login or CMS surface was
  added at any route, and E2E test 10 still guards it.

**The one real content gap — About Us.** Unlike the other two screens, the export's
About artboard is a *low-fidelity wireframe*: the brand-story body copy is two grey
`.ln` skeleton bars, i.e. the design itself marks that copy as unwritten. Product-spec
§5.8 is two lines of outline with no prose. Applying Decision H rather than working
around it:

- The headline *"We don't plan trips, we create lifetime memories."*, the section
  labels and the closing CTA are real export copy and are used verbatim.
- The story body renders a **visible placeholder notice** (same treatment as the
  `/legal/*` pages), not approximated brand prose. Writing a founder's note or an
  origin story for a real travel company is exactly what H forbids.
- Every "Our Journey" milestone is flagged `isPlaceholder` and visibly marked: they
  quote the traveller/destination counts Assumption A3 records as contested, and a
  founding year no source confirms.
- §5.8's "team section (optional)" and "certifications/badges if applicable" are
  **not built at all** — no names, roles, photos or certifications exist anywhere,
  both are marked optional, and an empty shell would be worse than their absence.

**Also applied, on Customize Tours:** the export computes an estimated per-person
trip cost as `nights × 3200 | 5400 | 8600` (line ~1157). Those per-night rates appear
in no spec, price list or fixture — they are prototype filler — so the figure is a
fabricated price quote and is **not** reproduced. The Estimated Cost row is kept
(it is part of the design) carrying the placeholder-marker treatment instead of a
number, which matches the export's own footnote: *"A GTY planner will confirm hotels,
transport and the final price before anything is booked."*

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

## 5. Interim content database — CLAUDE.md §2/§6/§10 OVERRIDDEN

**Raised:** 2026-09-14, during the work that introduced it. Not raised by an
adversary gate — recorded here by the implementing agent because it contradicts a
written constraint, and an override that lives only in a chat message is an
override nobody can find in six months.

### What contradicts what

`Documents/guruji-travel-yatra-website-CLAUDE.md` **line 56** (§2, Tech stack):

> Lead/Content API | Guruji Travel Yatra ERP API | This site is a **client** of
> the ERP's API — see section 10. **Do not build a parallel database for leads or
> tour content**

§10 makes the same point structurally (this repo is a read-client of the ERP), and
**§1b of this file** already recorded that CLAUDE.md §6 *"explicitly forbids working
around it with a duplicate content model"* — which is why the fixture stand-in was
described there as **MITIGATED, not resolved**, with the explicit note that "no
duplicate content *model* was created".

A Postgres database in this repo holding tours, destinations, departures and
brochures **is** a parallel content database. It is the thing §1b said had not been
done. `docker-compose.yml` carried a matching guardrail comment — *"There is
deliberately NO database service here… if you think you need one, that is a signal
the architecture boundary is being crossed"* — which this change rewrites rather
than deletes.

### Why it is overridden anyway

> **OVERRIDDEN 2026-09-14 (user, explicit and informed).**
>
> The user was aware of CLAUDE.md line 56 and overrode it deliberately. The ERP's
> content-read endpoint (§1b) is **still** unconfirmed with no delivery date, and
> the CRM side is finishing its own lead endpoint first. Rather than hold the site
> on hard-coded fixtures indefinitely, content moves to a database this repo owns
> so it can be edited without a code deploy.
>
> **Scope of the override — deliberately narrow:**
> - **CONTENT ONLY.** Tours, destinations, group departures, brochure metadata.
> - **NO LEADS.** CLAUDE.md's prohibition on a parallel *lead* store is **NOT**
>   overridden. Lead submission remains `NotImplementedLeadAdapter` (§1a / Decision
>   A) and no lead table exists in `prisma/schema.prisma`. If a lead model ever
>   appears there, it did not come from this decision.
> - **NO ADMIN SURFACE.** No `/admin`, no login, no CMS. Product-spec §7 puts
>   content management inside the existing CRM, and CLAUDE.md §1 says this repo
>   "does not implement its own admin/login UI". This is a data layer and a seed
>   script; content is edited by running the seed or by direct SQL until the ERP
>   takes over.
> - **Deployment detail, not an architecture claim:** the database is intended to
>   live in the same Railway Postgres instance as the CRM, under its **own schema
>   and its own credentials**. It is not the CRM's database and must not be pointed
>   at the CRM's tables.

### This is temporary, and here is the exit

The port architecture that made the fixture stand-in survivable makes this one
survivable too, and the exit is unchanged from §1b:

1. The ERP ships its public content-read API.
2. Someone writes `ErpContentAdapter implements ContentPort`.
3. `src/content/content-adapter.ts` (the composition root) constructs it instead of
   `PrismaContentAdapter`.
4. `prisma/` is deleted, along with the `db` service in `docker-compose.yml`.

**No page or component changes at any step** — none of them import an adapter, and
`ContentPort`'s signature was not altered to accommodate the database. Brochures
were given a **separate** `BrochurePort` rather than being added to `ContentPort`,
specifically so the content contract the ERP will eventually satisfy stays exactly
as it was.

**The real resolution is still §1b.** This override buys editability; it does not
make the ERP contract any less missing, and it adds a second copy of the content
that must be kept honest in the meantime. Migrating back is the plan, not a
courtesy sentence.

### Safety flags survived the move — that was the main risk

The three unverified-data flags (`Package.pricingUnverified`,
`GroupDeparture.durationUnverified`, `GroupDeparture.priceUnverified`) are real
columns in the schema **and** are still enforced: `PrismaContentAdapter` routes every
public query through the same `isPubliclyListable()` predicate in
`src/content/public-listing.ts` that the fixture path uses, so a flagged tour cannot
reach a listing and its detail route still 404s. A migration is the classic moment a
safety flag decays into an inert column —
`memory/feedback_qg_unenforced-safety-flag.md` records four occurrences of exactly
that failure — so the adapter tests assert the *returned* rows, not the flags.

---

## 6. Lead submission — log-only, RESOLVED 2026-09-17

### The decision

`POST /api/leads` exists and **persists nothing**. No `LeadSubmission` model was
added to `prisma/schema.prisma`; the tripwire comment at the top of that file
("It holds NO LEADS") is still accurate and is still enforced. Every submission is
instead written to the server log, in full, by
`src/server/leads/lead-log.ts`.

This is an explicit user decision, taken after a first attempt at this route was
correctly stopped by that tripwire.

### Why log-only rather than a local table

§5 overrode CLAUDE.md's "no database" constraint for CONTENT ONLY, and was
explicit that leads were excluded from that override. The boundary being
protected is CLAUDE.md §6's: this site holds **no lead data of its own** — the
CRM owns the Customer/Lead tables, and a second copy of a person's contact
details living in a website database is precisely what that rule exists to
prevent.

Adding a lead table would have been the easy answer and would have quietly
widened §5's override from "content" to "content and personal data". Logging
keeps the boundary intact while still satisfying the other requirement that
matters: **nothing a visitor submits is silently lost.**

### What this costs, stated plainly

- **A log line is the only record of a lead.** There is no table to query, no
  dead-letter queue, no retry, no admin surface. If someone has to follow a lead
  up by hand they will do it by reading logs: `grep LEAD-SUBMISSION`.
- **The logs now contain personal data** — name, mobile, email, free text. That
  is a deliberate inversion of `NotImplementedLeadAdapter`, which logs only
  non-identifying routing fields specifically to avoid this. Redaction would
  defeat the purpose: an unreachable lead is a lost lead. **Consequence:**
  wherever this app's stdout is shipped or retained is now a personal-data store
  and must be access-controlled and retention-bounded like one. This is the main
  risk this decision accepts, and it should be revisited before launch traffic.
- **Log retention is now lead retention.** A platform that rotates stdout after
  N days silently sets the lead-retention policy. Nobody has chosen that number.

Design details that follow from the above: the full record is written *before*
the CRM hand-off is attempted (so a hang or crash downstream cannot take the only
copy with it); the record is serialised with a blanket `JSON.stringify` rather
than a hand-listed field set (a hand-written list goes stale and silently drops
new fields); and the expected not-configured outcome is logged concisely rather
than dumping the payload a second time on every single lead.

### What is NOT resolved by this

**§1a is still open.** `src/server/crm-client.ts` is a stub: it makes no network
call, invents no endpoint/schema/auth, and — importantly — cannot report a
delivery that did not happen. Its `CrmSubmissionOutcome` type makes
`'delivered'` require a `reference` only a real CRM response can supply, so no
stub can fabricate one. `CRM_LEADS_ENDPOINT`/`CRM_API_KEY` are reserved in
`.env.example` and do nothing yet.

~~**The frontend is not wired to this route.**~~ — **CLOSED 2026-09-17.** All four
reachable forms now POST to it. See item 0 below for what changed.

### Scope: four source tags, not six

Only the four reachable triggers are accepted: `Enquire Now – [Page]`,
`Brochure Download – [Package Name]`,
`Group Tour Reservation – [Batch Date]`, `Custom Trip Request`. `Contact Page`
and `Service Enquiry` are unbuilt pages and `Newsletter Signup` has no wired
form, so accepting them would mean shipping a contract with no caller to
validate it against. They remain in the docs as pending, not removed.

---

## What was delivered

**Before the pause (decision-independent):** Next.js scaffold, the full extracted
design-token layer, self-hosted fonts, the logo asset, the Docker files.

**After A–H were answered:** the global component set, Home, Tour Packages, and the
`/tour-packages/[slug]` detail page — per the resolutions above.

## Still open after this sprint

0. ~~**The frontend does not call `POST /api/leads` yet (§6).**~~ — **RESOLVED
   2026-09-17.** All four accepted `formType`s now have a real client-side
   producer, and the route has callers. Original framing preserved below the
   resolution.

   **What was built**
   - `src/lib/leads/lead-api-client.ts` — `submitLeadRequest()`, the browser's
     side of the route. Never throws; every outcome resolves to a success or to
     an error carrying visitor-safe text. A 200 is treated as success *only* if
     the envelope confirms receipt, so an unparsed body cannot become a
     fabricated "GTY has your details".
   - `src/components/modals/lead-details.ts` — `LeadDetails`, the `formType`-
     tagged context a trigger passes alongside the display chip. This is the
     channel that did not exist: previously a trigger could pass one display
     string and nothing else.
   - `src/components/modals/build-lead-request.ts` — merges form values +
     trigger context into the exact union member the server validates. Its
     return type is the server's own `LeadSubmissionInput` (imported
     type-only), so a contract drift fails `tsc` instead of 400ing a visitor.
   - `modal-context.tsx` gained `openGroupReservation()` and `openCustomTrip()`.
     Both open the **same enquiry modal** as before — the UX is deliberately
     unchanged, because neither the departure card nor the trip builder collects
     a name or mobile, so the modal is still where contact details come from.
     Only the payload it builds is different.
   - `LeadModal`'s error path now reads `ApiFailure.fields` and routes each
     message to its own input via RHF `setError` — the same `Field`/`error`
     slot client-side Zod already renders into, not a second error UI. Paths
     with no input behind them (`batchDate`, `sourcePageUrl`, `stops.0.nights`,
     `utm.*`) are appended to the form-level banner rather than dropped.

   **What did NOT change:** `LeadSubmissionPort`/`NotImplementedLeadAdapter`
   still exist and still back the **newsletter** form. That flow has no server
   contract — `'Newsletter Signup'` is a `LeadSourceTag` with no union member
   behind it (see "four source tags, not six" above) — so pointing it at this
   route would make it 400 on a `formType` it cannot supply. Two submit paths is
   the honest state of the system; one path claiming to cover all five forms
   would not be.

   **No `budget` was invented.** `TripBuilder`'s "Budget (Per Person)" control
   is `aria-disabled` with a visible "coming soon" and holds no state, so
   `travelStyle` remains the only price-tier signal transmitted. Asserted
   explicitly in `build-lead-request.test.ts` and in both E2E suites.

   **Verification:** `build-lead-request.test.ts` re-runs the *real*
   `leadSubmissionSchema` over every built payload, so a schema change breaks
   the tests rather than a visitor's submission. The E2E specs intercept
   `/api/leads`, assert the body, and `route.continue()` to the real handler —
   a payload the server would reject fails the run.

   <details><summary>Original blocker text (2026-09-17, now resolved)</summary>

   The route is built, validated and tested, but **no component submits to it** —
   every form still goes through `leadAdapter.submitLead()`, i.e.
   `NotImplementedLeadAdapter`, which returns an error and transmits nothing.
   Until an adapter is pointed at the route, the endpoint has zero callers and no
   lead reaches the log.

   Two of the four accepted `formType`s have no client-side producer *at all*,
   and this is not just missing plumbing — the data is actively discarded today:
   - `TripBuilder.handleGetQuote` calls `openEnquiry({ value: routeSummary })`.
     It opens the generic enquiry modal and **drops the entire trip**: nights per
     stop, travel style, travel month, adults, children and notes never reach any
     payload. A "custom trip" lead currently arrives tagged
     `Enquire Now – Manali → Kasol`, not `Custom Trip Request`.
   - `GroupDepartureCard`'s "Reserve a Seat" calls
     `openEnquiry({ value: departure.name })` — it sends the departure NAME and
     never `dateRangeLabel`, so the batch date the
     `Group Tour Reservation – [Batch Date]` tag is built from is not currently
     transmitted by anything.

   So the "four source tags" are four on the server and two in practice
   (`Enquire Now – …`, `Brochure Download – …`). Wiring is a separate piece of
   work and needs: an adapter implementing `LeadSubmissionPort` that POSTs to
   this route; `formType` + context threaded from each trigger; and
   `LeadModal`'s error path taught to read `ApiFailure.fields` (it currently
   handles only a single flat `message` string, so field-level 400s would be
   shown as one generic banner).

   </details>

   **Still true after this fix:** a submitted lead reaches the server log and
   nothing else. §1a (the ERP/CRM endpoint) is untouched and remains the real
   production blocker — the modal's done step may say "GTY has your details",
   which is now true, but no CRM has them.

1. **ERP lead-creation contract (1a)** — the genuine production blocker. Decision A
   unblocked the UI; it did not satisfy CLAUDE.md's Definition of Done.
2. **ERP public content-read API (1b)** — fixtures are a documented stand-in behind
   `ContentPort`, not a resolution.
3. **Real testimonial content (H)** — placeholders are greppable via
   `TODO(real-testimonials)` and must be replaced before launch.
4. **Visitor-facing stub copy (B)** still needs product sign-off. ~~**the branded 404
   (G)**~~ — **CLOSED 2026-09-11 by Decision G2**: the user reversed it for the three
   primary nav routes, which are now built. G still governs the four remaining
   Footer-only links (`/destinations`, `/our-services`, `/travel-guide`,
   `/contact-us`).
7. **About Us brand-story copy** — the export's About artboard is a wireframe with
   skeleton bars where the story should be, and product-spec §5.8 has no prose. The
   page ships with a visible placeholder notice (Decision G2). GTY must supply the
   real story/founder note, and confirm the "Our Journey" milestones, before launch.
   Greppable via `TODO(about-history-confirm)`.
8. **Group departure durations** — the export states different durations for the same
   tour in `GROUPS` than in `RAILS` (Do Dham Yatra, Spiti Valley Circuit). Both
   records are surfaced with a visible marker rather than a silently-picked winner.
   Greppable via `TODO(duration-confirm)`.
9. ~~**`/group-tours` publishes a price the catalogue deliberately withholds**~~ —
   **RESOLVED 2026-09-11 (user): marked, not withheld.** Original framing preserved
   below; resolution follows it.

   `public-listing.ts` withholds "Do Dham Yatra" from Home
   and `/tour-packages` (and 404s its detail route) because `pricingUnverified` marks
   its ₹28,900 as unconfirmed. But `group-departures.fixture.ts` is a *separate*
   transcription of the same tour from the export's `GROUPS` const, it carries the
   same ₹28,900, and `GroupDepartureCard` renders it as the card's most prominent
   figure. The public-listing gate only covers `Package` records, so the
   later-built `/group-tours` page bypasses it entirely.

   The site therefore suppresses a figure as untrustworthy on one surface and
   publishes it on another. Note the duration conflict for this same record *was*
   carried across (item 8, `durationUnverified`) — the price was not.

   Two defensible fixes, and which one applies is a business call:
   - extend the gate so a `pricingUnverified` tour's departures are withheld too
     (consistent with `/tour-packages`, but empties a quarter of the departures page); or
   - mark the price with the asterisk + `aria-describedby` footnote used by
     `StatsBar` / `WhyGtyBand` / `AboutTimeline` (the established treatment for an
     unconfirmed *standalone* figure; the full withholding gate exists because a
     fabricated "was ₹X / Save ₹Y" discount badge was at stake, and
     `GroupDepartureCard` shows no such badge).

   Simplest real resolution: GTY confirms the Do Dham Yatra price, and the flag goes.

   > **RESOLUTION — the second option: marker + footnote, not withholding.**
   > **Decided by:** user, 2026-09-11.
   >
   > The card carries no fabricated "was ₹X / Save ₹Y" badge — it shows a single
   > standalone unconfirmed figure — so the proportionate treatment is the one
   > `StatsBar` / `WhyGtyBand` / `Hero` / `AboutTimeline` already use for exactly
   > that case, not the full withholding gate (which exists because a fabricated
   > discount was at stake) that would empty a quarter of the departures page.
   >
   > - `GroupDeparture` gains `priceUnverified?: boolean` (`src/content/types.ts`),
   >   the sibling of the `durationUnverified` flag item 8 already carries. Set on
   >   the Do Dham record in `group-departures.fixture.ts` under a
   >   `TODO(pricing-confirm)` comment, greppable alongside the existing ones.
   > - `GroupDepartureCard` renders the established three-part treatment on the
   >   price: a visible `aria-hidden` asterisk, an `aria-describedby` pointing at a
   >   footnote id, and — the piece that makes it reach assistive tech — a `role`
   >   on the container carrying that `aria-describedby`.
   > - `GroupDeparturesList` renders one `#group-price-note` footnote for every
   >   marked card, keyed off the FILTERED set, the same "one shared note, many
   >   markers" contract as the Home surfaces. It is a second, separate note from
   >   the duration one: Do Dham is flagged on both counts, and a single merged
   >   note would point the duration marker at text about price.
   > - **Also fixed, same commit:** the duration marker shipped with its
   >   `aria-describedby` on an unroled `<span>` — the exact defect
   >   `stats-single-source.test.tsx` records as "correct on paper and silent in
   >   practice". Both flags now route through one helper, so duration got the
   >   role too.
   >
   > **Root cause worth keeping:** the flag did not fail to be *written*, it failed
   > to *propagate*. `pricingUnverified` is enforced in one place against one type
   > (`Package`), and `GroupDeparture` is a deliberately separate model (see the
   > note above its interface). A safety flag enforced per-type silently stops at
   > the boundary of a sibling type describing the same real-world thing. The new
   > fixture test `flags priceUnverified on exactly the departures whose tour the
   > catalogue flags pricingUnverified` cross-checks the two fixtures against each
   > other, so they cannot drift again — including in the good direction, when GTY
   > confirms the price and only one of the two flags gets cleared.
   >
   > **Still the real fix:** GTY confirms the Do Dham Yatra price, and both flags go.
   > This resolution makes the site honest about the doubt; it does not remove it.
5. **Social media URLs** — still `href="#"` with `TODO(social-links)`.
6. **Docker** — `Dockerfile` / `docker-compose.yml` are written but **unvalidated**;
   Docker is not installed in this environment. The **standalone artefact** the image
   depends on is now exercised, though: the Playwright suite boots
   `.next/standalone/server.js` with the same asset layout the runner stage builds
   (`scripts/start-standalone.mjs`), so that part is no longer untested.
9. **Interim content database (§5)** — the CLAUDE.md line-56 override is recorded and
   deliberately scoped, but it is a stopgap with a debt attached: content now exists in
   two places (`prisma/seed.ts` and `src/content/fixtures/*`), and the ERP content API
   (§1b) is still the real resolution. Migrating to `ErpContentAdapter` and deleting
   `prisma/` is the plan.
10. ~~**The Prisma path has never touched a real database.**~~ — **RESOLVED.**
   `DATABASE_URL` now points at a managed Postgres, three migrations are applied, and
   the seed has inserted 22 tours. The original text is preserved below.

   <details><summary>Original item (now resolved)</summary>

   Docker is still not installed (item 6), so no Postgres was started, the migration
   was never applied and the seed was never run. Schema validity and the adapter's
   mapping/gating logic are verified (`prisma validate`, `prisma generate`, and adapter
   tests against a mocked client); **the SQL has not been executed and the seed has not
   been proven to insert.** `DATABASE_URL` is unset here, so the composition root still
   resolves to `FixtureContentAdapter` and the live site is unchanged — which is why the
   suite passing says nothing about the database. First run against a real Postgres
   should be treated as untested code.

   </details>

   **What is true now, and what replaced this as the caveat:** `npm test` still runs on
   the FIXTURE path deliberately (`jest.setup.ts` deletes `DATABASE_URL`), so a green
   unit suite still says nothing about the database. What covers the database instead is
   `src/server/admin/tours/__tests__/tour-repository.integration.test.ts`, an opt-in
   suite (`RUN_DB_TESTS=1`) that runs real SQL.

   **New, and it affects every build:** the managed TCP proxy intermittently refuses
   connections with `P1001`. Measured — a test whose only statement is `tour.count()`
   failed 3 runs in 4, then succeeded unchanged. In practice `next build` fails roughly
   one run in two during `generateStaticParams`, and the first request to a
   freshly-started server can 500 before the connection warms up. Retrying is the
   workaround; the integration suite has a connection retry built in for this reason.

11. **Tour CMS — Phase B decisions (2026-09-17/18).** Recorded here because each was a
   judgement call the task left open.

   - **Minimum fields to publish:** name, slug, category, destination, a short
     description, a duration, a price — where "a price" is satisfied by EITHER
     `priceFrom` OR at least one `TourPricingTier` — and, **as of Phase C, a cover
     image**. Each is a field whose absence renders a visibly broken card. Itinerary,
     FAQs, inclusions and `fullDescription` are not required — the detail page renders
     only what exists (Decision D), so their absence is a shorter page, not a broken one.
     Enforced by `publishableTourSchema`, and re-run server-side for BOTH the form's
     Publish button and the list's publish toggle, so the toggle is not a laxer second
     path to the same state.

     **[SUPERSEDED 2026-09-18 by Phase C]** This item previously read "**Images are
     deliberately NOT required**, because uploads are Phase C and gating publish on a
     field the system cannot yet accept would make publishing impossible." That was
     correct while it stood and is recorded rather than deleted, because it is the shape
     of interim decision worth being able to find again: it stated its own expiry
     ("when uploads land, whether a cover image becomes mandatory is a decision for that
     phase"), and the expiry has now been honoured rather than quietly forgotten. The
     user's original specification said "Cover image (single, required)", so with uploads
     working, that requirement is enforced as written.

     Three things make the new requirement safe to add to a live system:
     it gates PUBLISH and not SAVE, so a draft with no cover still saves; nothing
     re-validates stored rows, so the 22 already-published fixture tours are untouched
     until someone edits and re-publishes one; and the column is NULLABLE, because a NOT
     NULL `coverImageUrl` would have made saving a draft impossible — the safe default
     and the publish bar are different questions, which is the same distinction the Phase
     B migration got right in the other direction when it backfilled
     `status = 'PUBLISHED'` over a DRAFT column default.

     **Gallery images and the brochure PDF remain optional**, which is the original spec
     read literally — only the cover was marked required. Requiring a brochure would
     block publishing outright, since no brochure PDF exists for any tour in this
     project: exactly the mistake the superseded decision above existed to avoid.
   - **Slug collisions are REJECTED, not auto-suffixed.** A slug is a public URL;
     silently saving `spiti-valley-2` gives the admin an address they did not choose and
     may not notice. The error names the conflicting tour, and says when the conflict is
     with an ARCHIVED tour — which the admin could not otherwise find, since archived
     tours are hidden from the default list.
   - **Editing a slug is allowed and changes the public URL.** Every FK is
     `ON UPDATE CASCADE`, so children follow. **No redirect is created** — this project
     has no redirect table and inventing one was out of scope — so the form warns, at the
     moment the change is made, that the old address will 404.
   - **Archiving is `archivedAt`, a timestamp, not a `TourStatus.ARCHIVED` member.** The
     two facts are independent: an archived tour keeps the `status` it had when it was
     pulled, so restoring returns it to that state rather than silently publishing a
     draft. Archived tours are withheld from every public surface and from the default
     admin list, and remain findable under the Archived/All filters. Nothing deletes a
     `Tour` row, per §7's rule for anything with lead history.
   - **Pricing tiers are the PRESENCE of `TourPricingTier` rows, with no boolean.** A
     flag beside the rows is a second source of truth for one fact and drifts: set true
     with the last tier deleted renders a tour with no price; set false with rows present
     hides pricing the admin can still see in the form.
   - **`audienceTags` is a second axis and is NOT merged into `category`.** `category`
     drives the public filter chips and `/api/tours?category=`; adding Domestic/Group
     Tour there would put four unrelated chips on the public filter bar and stop a tour
     being both Spiritual and Domestic. `International` deliberately appears in both.
   - **No image columns were added** *(in Phase B — added in Phase C, see item 12)*. A
     column nothing writes and nothing reads is the inert-flag shape
     `memory/feedback_qg_unenforced-safety-flag.md` exists to prevent, so Phase C adds
     them with the code that fills them. The form's upload controls shipped visibly
     `disabled` with the reason stated and registered nothing — the brochure records'
     `PENDING_UPLOAD` + NULL `pdfUrl` honesty pattern. That stub is now replaced by
     working controls.
   - **The draft/published gate composes INTO `isPubliclyListable()`** rather than
     sitting beside it. Every public surface already funnelled through that one
     predicate, so all of them — Home's rails, `/tour-packages`, the detail page,
     `/api/tours`, `/api/tours/[slug]`, `generateStaticParams()`, brochures — inherited
     draft and archive protection with no edit at the call site and no way to opt out. A
     parallel `isPublished()` would have had to be retro-fitted to each caller, and the
     one that got missed would be the leak — which is precisely how item 9 above
     happened.

12. **Tour CMS — Phase C, file uploads (2026-09-18).** Cloudinary, chosen by the user for
   its free tier, automatic image optimisation and direct PDF hosting.

   - **NO CLOUDINARY CREDENTIALS EXIST IN THIS REPO OR ENVIRONMENT, and no upload has
     ever been performed against a real account.** `.env` has only `DATABASE_URL`; there
     are no `CLOUDINARY_*` variables in `.env`, in the shell, or anywhere else.
     `.env.example` documents the three that are needed. Everything below is built,
     typechecked and unit-tested **against a mocked Cloudinary SDK**; the live
     integration — that a real signed upload is accepted, that the returned `secure_url`
     resolves, that `raw` PDF delivery works on the account's security settings — is
     **UNVERIFIED and cannot be verified without an account**. The code path is complete;
     the claim "uploads work" is not yet evidence-backed. This is the same honesty
     discipline as item 10's note about the database.
   - **Signed server-side upload, not an unsigned browser preset.** An unsigned preset is
     a permanent public write token embedded in page JavaScript — it cannot be scoped to
     a session, which defeats the point of an admin-only surface. The browser POSTs to
     `/api/admin/uploads`; only the server holds `CLOUDINARY_API_SECRET`.
   - **Validation sniffs magic bytes, and does not trust the declared MIME type or the
     filename.** Both are written by the client, so any rule reading them is a rule an
     attacker restates for free — an SVG renamed `holiday.jpg` and declared `image/jpeg`
     is a stored-XSS vector, and it is refused on its leading bytes. Accepted: JPEG, PNG,
     WebP (10 MB) and PDF (20 MB), checked against the field the file was uploaded to.
     `allowed_formats` on the Cloudinary call is a second, independent check on the far
     side. The client runs the identical validator as a courtesy, never as the check.
   - **Replacement safety: upload-then-repoint, and nothing is ever destroyed.**
     `overwrite: false` + `unique_filename: true` + no explicit `public_id` means every
     upload is a NEW asset, so a replacement is an addition. The stored URL moves only
     when the admin saves, which is strictly after the upload returned a URL — so the old
     asset keeps serving the live page until the swap, and an abandoned upload changes
     nothing. **The cost, stated: replaced assets are never deleted** and orphans
     accumulate against the free tier's storage. Reclaiming them is a follow-up sweep
     over `publicId`s no row references. Likewise `Brochure.version` increments on each
     replacement, but **version HISTORY with preview/restore is NOT built** — the older
     URLs still resolve, nothing lists them.
   - **The brochure PDF writes to the existing `Brochure` table, NOT to a new
     `Tour.brochurePdfUrl` column.** That column was the obvious place and is the one
     that must not be used: `Brochure.pdfUrl` already means "this tour's brochure PDF"
     and is already what `GET /api/brochures/[slug]` and `BrochureModal` read. A parallel
     column would have shown the admin a successful upload while the public endpoint kept
     answering `pdfUrl: null, status: PENDING_UPLOAD` — the two-models-one-entity drift
     recorded as variant 4 in `memory/feedback_qg_unenforced-safety-flag.md`. This is
     also the first code in the project that can truthfully move a row out of
     `PENDING_UPLOAD`.
   - **The gallery is a `TourGalleryImage` child table, not a `String[]` of URLs.** A
     gallery image carries a `publicId` and its dimensions as well as a URL, and two
     parallel arrays (`galleryImageUrls[]` + `galleryPublicIds[]`) have nothing tying
     index `n` of one to index `n` of the other — the same drift, inside a single row.
     This follows the test the schema already states: bare lines of text are arrays,
     items with fields of their own are tables.
   - **Reordering is ↑/↓ buttons, not drag-and-drop.** The form already reorders itinerary
     days, FAQs and pricing tiers exactly this way, so it is the idiom the admin has
     learned, it needs no new dependency, and it is keyboard- and screen-reader-reachable
     without a bespoke implementation. `sortOrder` is rewritten from array position on
     every save, as day numbers are.
   - **Progress is real `XMLHttpRequest` upload progress, not a decorative spinner** —
     `fetch()` still cannot report bytes-sent. The bar measures browser → our server
     only; at 100% the label changes to "Sending to Cloudinary…" rather than sitting full,
     because the server-to-Cloudinary leg is still running.
   - **The "N Photos" badge is DERIVED AT READ TIME, not on save.** *(Corrected
     2026-09-19, review finding M5 — this bullet originally described a save-time
     derivation that did not survive Phase C.)* `PrismaContentAdapter` reports
     `galleryImages.length` for a tour with uploaded photos and falls back to the stored
     `photosCount` (the design export's inherited figure) for one with none. The column is
     written only on CREATE (as 0) and never on update — `toColumnData` omits it on
     purpose. The save-time version was built first and the live integration suite
     rejected it: `photosCount` is not a form field, so editing a seeded tour's
     *description* changed its photo count (11 → 0). The inherited figures for the 22
     seeded tours still describe photography that does not exist; correcting them is a
     content decision for the business, not a side effect of an unrelated save.
   - **Uploaded images are rendered publicly, via `PhotoPlaceholder`'s new `imageUrl`
     prop.** The branch lives in the one component every card, hero and rail already
     routes through, so every surface inherited it with no call-site edit — the same
     composition rule as `isPubliclyListable()`. Without this the columns would be
     written and never read, which is the inert-column shape this project keeps
     re-learning. The gallery is rendered as a thumbnail strip on the detail page for
     the same reason: the "N Photos" badge would otherwise promise photographs with no
     way to reach them. **No lightbox** — half of one is worse than none, and the browser
     already opens an image correctly.
   - **`/api/admin/uploads` is NOT covered by `src/proxy.ts`**, whose matcher is
     `/admin` and `/admin/:path*`. That is not a gap: the proxy is an optimistic
     pre-filter for navigations, and the route gates itself with `getAdminSession()`
     before reading the request body. It uses `getAdminSession()` rather than
     `requireAdminSession()` deliberately — the latter REDIRECTS, and a 307 to an HTML
     login form arriving at a `fetch()` surfaces as a parse error rather than "your
     session expired". CSRF is covered by the session cookie's `SameSite=Lax` plus a
     `Sec-Fetch-Site` check. *(2026-09-19: that check refused only `cross-site` and
     let `same-site` through — review finding M3, fixed; see item 14.)*

13. **Tour CMS — Phase D, security hardening and doc sync (2026-09-19). CLOSING ENTRY
   for the admin/CMS build (items 11 and 12).** Phase D added no features. It closed the
   three security questions item 11's note left open — stored XSS, CSRF on the mutation
   path, and secret exposure — and then reconciled the documentation, which had still
   described the admin as living inside the CRM.

   **What was hardened**

   - **Stored XSS: two layers, deliberately apart.** `plain-text.ts` REFUSES markup at
     validation with a message the admin can act on; `sanitize-tour-text.ts` STRIPS it
     at write time inside `createTour`/`updateTour` with a real HTML parser. The second
     layer is the guarantee: it holds for any write path that never touches the Zod
     schema (an import script, a bulk edit, a fixture load), and it matters because
     `/api/tours` publishes this text as JSON to clients this repo does not own, where
     React's escaping protects nothing. `dangerouslySetInnerHTML` appears nowhere in
     `src/` and a repository-wide source scan now keeps it that way.
   - **CSRF, measured rather than assumed — and the result is a nuance, not a tick.**
     Measured 2026-09-19 against the standalone production server, with a real session
     and one header varied at a time:

     | Request | Result |
     |---|---|
     | `Origin: https://evil.example.com` | **500** — aborted before the action decoded |
     | `Origin: null` | **500** — aborted |
     | `Origin:` *(the server's own)* | 303 — action ran, as it should |
     | **no `Origin` header at all** | **303 — action RAN.** Next warns and proceeds |
     | `Origin: evil` **+ `X-Forwarded-Host: evil.example.com`** | **303 — action RAN.** Check defeated |

     So the origin check is real but it has two holes. **Neither is reachable from a
     browser** — a cross-origin form
     POST cannot set headers and always carries `Origin`, and a cross-origin `fetch()`
     with `X-Forwarded-Host` triggers a preflight this app never approves. So the
     conclusion to carry forward is: **the origin check is defence in depth, not the
     defence.** What actually stops CSRF here is `SameSite=Lax; HttpOnly` on the session
     cookie plus `requireAdminSession()` in every action, the latter now asserted
     exhaustively over the action SOURCE (a new action added without a guard fails a
     test, which a behavioural test of the actions someone remembered could not do).
     Do not let a future review record this as "Next's origin check stops CSRF".
   - **Secret exposure, proven non-vacuous.** The first version of this check read
     `process.env` inside the Playwright RUNNER, which loads no `.env` — the list came
     back empty and the loop asserted over zero values while reporting as coverage. It
     now plants sentinel secrets into the server's environment from
     `playwright.config.ts`, proves by handshake that the server holds the highest-value
     one, and scans page HTML, the RSC payload and **the JavaScript chunks a browser
     downloads** — which is where a Next.js secret actually leaks, inlined at build time
     by a Client Component or a `NEXT_PUBLIC_` rename. It was verified able to FAIL: a
     temporary probe rendered on `/admin/login` turned both the HTML and the chunk scan
     red. That exercise also exposed a bug in the test itself — Playwright's request
     fixture keeps a cookie jar and Auth.js re-issues the sliding session cookie, so the
     "anonymous" scans were authenticated and `/admin/login` was silently 307ing to
     `/admin`; each scan now uses a fresh context and asserts a 200 with redirects off.

   **Still open after the whole admin/CMS build**

   - **Cloudinary credentials are still not provisioned.** Unchanged from item 12 and
     still the most consequential gap: `.env` holds only `DATABASE_URL`, no upload has
     EVER been performed against a real account, and every upload assertion in the repo
     runs against a mocked SDK. Because the publish bar requires a cover image, **no new
     tour can be published at all until the three `CLOUDINARY_*` variables exist.**
   - **`AUTH_SECRET` must be set for production.** The app refuses to issue a session
     without it in production, which is the right failure, but it means a deploy that
     omits it is a dead admin area rather than an insecure one. The value committed in
     `playwright.config.ts` is a throwaway for a 127.0.0.1 test server and grants
     nothing; its visibility is the argument for setting a real one.
   - **No server-side session revocation.** Sessions are stateless JWTs with no lookup,
     so there is no "sign out everywhere" and no way to invalidate a stolen token.
     Worst case is the full `maxAge`: **7 days.** Changing a password does not shorten
     it. Closing this means a session table or a token version claim checked per
     request — a real design change, not a patch.
   - **The login rate limiter is in-memory.** It resets on every restart and is
     **decorative with more than one replica**, since each process keeps its own
     counters. bcrypt at cost 12 is the defence that survives both; the limiter is a
     convenience on top of it.
   - **No brochure version history UI.** `Brochure.version` increments on each
     replacement and the older Cloudinary URLs still resolve, but nothing lists them,
     so there is no preview and no restore. Product-spec §7 asks for this.
   - **Orphaned Cloudinary assets accumulate.** `overwrite: false` makes every
     replacement a new asset and nothing is ever deleted, so replaced images and
     abandoned uploads pile up against the free tier. Reclaiming them needs a sweep over
     `publicId`s no row references — not written.
   - **The CSRF nuance above**, recorded as a known, browser-unreachable gap rather than
     a resolved item, so that a future Next upgrade that closes it (the E2E suite asserts
     today's behaviour and will fail loudly) gets the note updated instead of leaving a
     description of a version nobody runs.
   - **No independent adversarial review of the CMS as a whole has been run.** Every
     phase of this build was reviewed by the agent that wrote it. The security work above
     is self-assessed — mutation-checked, and verified against a running server, which is
     considerably better than assertion-free, but it is not an independent pass.
     `edge-case-adversary` over the entire admin surface is the outstanding gate.
     *(2026-09-19: that pass has now been run — see item 14 for its findings and what
     was done about each. A re-review of THOSE fixes is the new outstanding gate.)*

   **Documentation reconciled in the same pass.** Product-spec §7 (heading and a new
   §7.1 describing what actually exists), §12 (Data Principle, partially superseded —
   content is local, only leads go to the CRM) and §13; CLAUDE.md §6 (superseded), §10
   (narrowed to LEADS only) and §12. Every edit is dated and preserves the original
   text, because the 2026-09-17 pivot is a deliberate decision with a record
   (`memory/project_gty_admin_reversal.md`), not drift to be tidied away.

14. **Independent adversarial review of the admin CMS — findings and dispositions
   (2026-09-19).** The first review of Phases A–D not performed by the agent that built
   them. Fixed in `31f854c`..`1fe748a`. Every fix below was mutation-checked (the guard
   removed or weakened, the test observed going red, the change restored) — the counts
   are in each commit message.

   **Record-keeping caveat, stated plainly:** the review's own text was not committed to
   the repo. The finding IDs below are the ones the fix commits cite. IDs M4, M8, L3 and
   L4 appear in no committed record, so they are not listed individually rather than
   guessed at; the user's four decisions (below) cover what was accepted or deferred, and
   which ID each of those carried is not asserted here.

   **Fixed**

   | ID | Finding | Fix | Commit |
   |---|---|---|---|
   | C1 | Login rate-limiter map keyed on attacker-chosen strings, never evicted; the READ path allocated | Keys normalised + length-capped; read path no longer writes; 20,000-record ceiling with tiered eviction (spent → unlocked → active lockouts last, by soonest expiry) so eviction cannot become a lockout-reset oracle | `31f854c` |
   | H1 | Admin said "Published" / "now visible on the public site" and linked "View on site" for `pricingUnverified` tours the public site withholds | `publicWithholdReason()` is THE gate; admin derives every claim from it. Badge + banner; no link to a 404 | `71acf70` |
   | H2 | Dashboard still said uploads were "the next phase" / "disabled" | Copy derived from `isCloudinaryConfigured()` | `71acf70` |
   | M1 | Entity-encoded markup (`&lt;script&gt;`) passed both XSS layers and reached `/api/tours` | Detector decodes (bounded) before testing; sanitizer iterates to a fixed point | `b8a42d0` |
   | L5 | Gallery URLs interpolated into `href` unchecked; the render test's media half was vacuous | `isSafeMediaUrl` allowlist at render | `b8a42d0` |
   | M2 | Upload size guard skipped for an unparseable `Content-Length`, and a missing one read as 0 | Digits-only header required (411/400/413) AND the body stream is capped as it is read | `bb15d82` |
   | M3 | Upload origin check refused only `cross-site`; `same-site` (a sibling subdomain, which `SameSite=Lax` also trusts) was allowed | `same-origin` or absent only; a present `Origin` must name this host. Verified live in `admin-csrf.spec.ts` | `bb15d82`, `1fe748a` |
   | L1 | `tourSlug` reached the Cloudinary folder builder with only a `length > 0` check | Validated against `SLUG_PATTERN`, which now carries a 100-char cap inside the pattern itself | `bb15d82` |
   | M6 | Prices free text (rendered verbatim, mis-parsed by `getPriceRange`); `savingsLabel` hand-typed beside the prices it claimed to be the difference of | Canonical `₹42,500` enforced; "was" must exceed "from"; savings DERIVED; tolerant reader for stored rows. All 22 live rows were already canonical and consistent — none rewritten | `fd9e5b6` |
   | M5 | `schema.prisma` and item 12 described a save-time `photosCount` derivation that had been reverted | Both corrected (read-time derivation) | `d1c0158` |
   | M7 | Concurrent edits: last write silently wins, erasing the other admin's itinerary/gallery | Version token (`updatedAt`) claimed atomically as the transaction's first statement; conflict returned as state with the admin's input kept. Proven live with two truly parallel saves | `3f2a671` |
   | — | **Found while testing M7, pre-existing:** React 19 auto-resets a `<form action>` after the action settles, so EVERY server-returned error (slug collision, publish refusal) blanked the tour form on screen while RHF still held the values | Form dispatches via `startTransition(formAction)` instead | `3f2a671` |
   | L2 | List publish/archive toggles threw P2025 or silently no-op'd for a vanished tour | `updateMany` + `{ found }`; actions redirect to a visible notice | `7197416` |
   | M9 | The unguarded-mutation scan only read files NAMED `actions.ts` and never looked at `/api/admin/**` | Scans by `'use server'` directive and every admin `route.ts`; literal floors. Old test shown green with a planted ungated action and an ungated upload route | `7a2d4f0` |
   | M10 | No security response headers at all | nosniff, Referrer-Policy, XFO DENY + `frame-ancestors 'none'` sitewide; `private, no-store` on admin paths. Verified on real responses incl. the proxy's `/admin` redirect | `a6ab051` |

   **Accepted or deferred by the user (2026-09-19) — deliberately NOT changed**

   1. **`pricingUnverified` has no admin control to clear it.** H1 was fixed with the badge
      and banner only; clearing the flag means someone confirmed a price against the
      source, which a button cannot evidence. It stays developer-managed.
   2. **The 15-minute hard login lockout is kept.** It accepts a known cost: anyone who
      knows the admin's email can keep that account locked out by failing a login every
      15 minutes (a renewable lockout DoS). The C1 fix bounded the limiter's memory and
      made eviction unable to RESET a lockout; it did not change the policy.
   3. **Edits to a published tour go live immediately.** No staged/draft-of-published
      editing. M7 stops two admins overwriting each other; it does not add review.
   4. **The group-departure (batch) editor is deferred** to a separate pass.
      `GroupDeparture` behaviour was not touched in this round.
      *(2026-09-25: that pass is done — see item 15, which also closes the
      departure-visibility finding the orchestrator tracked as "M8".)*

   **Follow-ups recorded by this round, not done**

   - **Script-src Content-Security-Policy.** Only `frame-ancestors` is set. A real script
     policy needs per-request nonces through `src/proxy.ts` and every page.
   - **HSTS.** Belongs to the deployment once the production domain and its TLS
     termination are confirmed; sticky in browsers, so not set from a build that also
     serves plain HTTP for the E2E suite.
   - **Chunked uploads are refused (411).** Browsers always send `Content-Length` for a
     `FormData` body; an intermediary that re-chunks would break uploads. Not observed,
     not testable here. If uploads ever fail with "did not declare its size", relax the
     411 — the stream cap still enforces the real limit.
   - **The M7 and slug-collision signed-in E2E cases are written but have never run** —
     this environment has no `E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD`. M7 is proven by the
     live repository suite and a real-React render instead.
   - **Cloudinary is still unprovisioned** (item 12) — every upload assertion, including
     this round's, runs against a mocked SDK.
   - **These fixes have not been independently reviewed.** Same caveat item 13 made about
     Phases A–D, one level down.

15. **Departures pass — the departure visibility gate + the batch editor (2026-09-25).**
   Closes item 14's deferred decision 4 and the review finding the orchestrator tracked as
   "M8" (that ID is not in any committed record — see item 14's caveat — so it is described
   here by content, not by ID). User's decision, confirmed before the pass: *"Build
   departure editing into the tour form now, and hide a departure when its tour isn't
   public."* Commits `7d03459` (gate), `0782c56` (editor), this entry (docs).

   **The defect.** `getGroupDepartures()` read every `GroupDeparture` with no reference to
   its tour. It was written 2026-09-14, before `Tour.status`/`archivedAt` existed, and
   nothing revisited it. Archiving or un-publishing a tour withdrew it everywhere EXCEPT
   its dated batches, which stayed listed — with real dates, seats, a price and a Reserve
   button — on `/group-tours` and `GET /api/group-tours`.

   **The gate (`src/content/public-listing.ts`).** `departureWithholdReason(parent)` and
   `toPublicDeparture(departure, parent)` are COMPOSED from `publicWithholdReason()`, not a
   parallel predicate, and both adapters end in them. The SQL `where` on the Prisma path is
   an optimisation; the predicate is the gate (a mock that ignores the `where` proves it).
   A link naming a tour that is not there is withheld (closed direction).

   **Judgement calls, each stated so it can be reversed deliberately:**

   - **A `pricingUnverified` tour's departure is NOT withheld — it is MARKED.** The task
     suggested erring toward hiding; that was overruled by an earlier, explicit user
     decision: item 9 chose "asterisk + footnote, not withholding" for exactly this case
     (Do Dham Yatra's departure). Hiding it here would have silently reversed a product
     call. Instead the tour's price doubt is carried onto every batch AT READ TIME
     (`priceUnverified` forced true), so no write path — including a batch typed into the
     new editor — can list a doubtful tour's price unmarked. Every OTHER withhold reason is
     inherited, and the exemption is written so a FUTURE reason is inherited by default.
   - **Unlinked departures (`tourSlug` NULL) stay listed**, as-is. "Chardham Special" and
     "Kashi · Ayodhya · Prayagraj" have no catalogue twin; they answer to no tour. They are
     also NOT editable in the admin (the editor lives on a tour) — they remain
     seed/developer-managed until someone links them.
   - **The live database had NO links.** All 4 seeded rows had `tourSlug` NULL — seeded
     before Phase B added the column, never re-seeded — so on production the gate would have
     covered nothing while every mocked test passed. Found only by the live suite (a
     mutation that dropped linked rows from the query left every seeded row listed). Fixed by
     data migration `20260925090000_link_seeded_departures_to_tours` (the two links the
     shared rule derives; guarded; no visible change), and pinned by a live test asserting
     the links exist.
   - **`/group-tours` is statically prerendered**, so admin publish/archive/save actions now
     `revalidatePath('/group-tours')` — without it the gate held in the API and not on the
     cached page.
   - **Month chips** are derived from the departures actually rendered (a month whose only
     batch was withheld loses its chip) and carry the year from each label (the chip row
     hard-coded `" 2026"`).
   - The previous pass's untracked draft `src/content/departure-tour-link.ts` was reviewed,
     kept and wired in: it is now the ONE link rule, used by the seed and the fixture path.

   **The editor (`/admin/tours/new`, `/admin/tours/[id]/edit`).** A "Batch departures"
   section in the tour form, not a separate page.

   - **Shown when** the tour is tagged Group Tour **or already has batches** — hiding a
     seeded tour's live batches because nobody ticked a tag would leave them public and
     uneditable.
   - **Date shape: two real dates, not a free-text label.** The stored `dateRangeLabel`
     ("12 — 18 May 2026") and `month` are FORMATTED from them (`src/lib/departure-dates.ts`),
     as the seat label is from a count (`src/lib/seats.ts`; 0 = exactly "Sold out"). No
     column was added or changed: the strict inverse parsers re-read all 4 seeded labels to
     the identical string (tested), so an unrelated save rewrites nothing. A label in any
     other shape loads EMPTY and the form asks for it rather than guessing.
   - **Saved in the same transaction, after the M7 `updatedAt` claim** — a conflict writes no
     batch. **Synced by identity, not delete-and-recreate** (the one child collection that
     differs): the safety flags, `sortOrder`, `photoKey` and `scriptAccent` are not form
     fields, and re-creating the rows would reset them on every unrelated save — e.g. clear
     Spiti's `durationUnverified`. A batch slug the tour does not own is refused and the
     whole save rolls back. Removing a batch deletes the row (nothing references departures;
     leads are log-only and carry the date label as text).
   - Reused, not reinvented: `plainText()` refusal + `sanitize-tour-text.ts` strip on every
     batch text field; `rupees.ts` canonical price; the admin's existing pill vocabulary for
     "pending confirmation" (read-only — flags stay developer-managed, as item 14 decided for
     `pricingUnverified`). The section's "listed on /group-tours?" note is derived on the
     server from the gate itself. List view shows "N batches" via `_count`.
   - **`GroupDeparture.name` is no longer unique** (migration
     `20260925100000_departure_name_not_unique`): two batches of one tour share a title.
   - **Not added:** a publish rule requiring a Group Tour to have a batch (not asked for, and
     it would block publishing a tour whose next batch is unscheduled); batch reordering
     (`sortOrder` is the global `/group-tours` order, which a per-tour form does not own); an
     archive state for batches.

   **Evidence.** Every absence test was mutation-checked (gate bypassed → 5 adapter + 7/7
   page/API tests red; `departureWithholdReason` exempting every reason → 10 red; SQL `OR`
   narrowed → 4 of 6 live tests red; batch ownership check removed → 2 red; a flag written on
   update → 2 red; batch sanitization removed → 1 red). Measured on the running standalone
   build against the live DB: a planted tour's batch listed by `GET /api/group-tours` while
   published, absent when archived and when a draft, 0 leftover rows. Jest (`--maxWorkers=2`)
   80 suites / 1170 passed / 41 skipped (the opt-in live suites — all 41 pass under
   `RUN_DB_TESTS=1`); Playwright 136 passed / 11 skipped / 1 failed — the known item-8
   `/tour-packages` breadcrumb latency flake (5.0s vs a 5s budget), 3/3 green in isolation;
   `tsc`, `eslint`, `next build --webpack` clean (19 SSG paths, Proxy present).

   **⚠ INCIDENT during this pass — the live database was wiped and re-seeded.** Generating
   the second migration, the executor ran `prisma migrate diff --from-migrations …` with the
   LIVE `DATABASE_URL` as `--shadow-database-url`. Prisma resets a shadow database before
   replaying migrations into it; the command then failed on an unrelated precondition
   (`P3015`), which hid that the reset had already happened. Every row and the
   `_prisma_migrations` table were gone (schema rebuilt, data empty). Recovered the same hour:
   migrations 1–5 marked applied with `migrate resolve` after a READ-ONLY introspection diff
   confirmed the schema matched them, migration 6 deployed, `npm run db:seed` re-run —
   22 tours (all PUBLISHED, 3 price-withheld), 19 destinations, 4 rails / 20 entries,
   22 brochures, 4 departures (2 linked), and all 41 live tests green afterwards.
   **What the seed could NOT restore:**
   - **Every `AdminUser` row. Nobody can sign in to `/admin` until the owner re-runs
     `ADMIN_SEED_EMAIL=… ADMIN_SEED_PASSWORD=… npm run db:seed:admin`.** (Existing session
     cookies are stateless JWTs and stay valid until expiry — item 13's no-revocation caveat.)
   - Anything edited by hand through the admin UI since the last seed, and the tours'
     original `createdAt`/`updatedAt`. No publish was possible (no Cloudinary), but drafts or
     edits could have existed. **If Railway has a backup/point-in-time restore for this
     database, check it** — it would recover both.
   The environment memory now forbids `--shadow-database-url`, `--from-migrations`,
   `migrate dev` and `migrate reset` against this project's only database.

   **Still open after this pass**
   - The admin accounts (above) — an owner action.
   - **Two seeded batches are in the PAST and still listed as "upcoming"**: Do Dham Yatra
     (12 — 18 May 2026) and Chardham Special (02 — 13 Jun 2026) — today is 2026-09-25. Not
     changed: auto-hiding past batches is a product decision (and would hide 2 of 4 cards).
     The editor deliberately does NOT refuse past dates, or saving any tour with a past
     batch would fail.
   - The two unlinked seeded departures have no admin UI.
   - The signed-in E2E tier still cannot run (no admin E2E credentials); the editor is
     covered by a real-React render test and the live repository suite instead.
   - **Not independently reviewed.** Item 14's fixes and this pass are both self-assessed;
     a combined `edge-case-adversary` pass is the outstanding gate.
