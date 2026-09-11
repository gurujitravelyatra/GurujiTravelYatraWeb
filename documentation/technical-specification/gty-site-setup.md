# Technical Specification — GTY Site Setup

**Feature:** `gty-site-setup`
**Pipeline:** SPEC · Scope: full-stack (thin Next.js only — no backend service in this repo)
**Sprint mapping:** CLAUDE.md Sprint 1 (project setup, global components, design tokens) + Sprint 2 start (Home page)
**Sources read:** `Documents/guruji-travel-yatra-product-spec.md`, `Documents/guruji-travel-yatra-website-CLAUDE.md`, `Documents/Website-Design/project/GTY Wireframe Prototype.dc.html`

---

## 1. Overview

### Purpose
Stand up the GTY public marketing website as a Next.js (App Router) + TypeScript application, establish the Tailwind design-token layer that pixel-matches the Claude Design export (`GTY Wireframe Prototype.dc.html`), and build the global UI shell (Navbar, Footer, Bottom Contact Strip, Enquiry Modal, Brochure Modal, Destination card, Package card, Review card) plus two fully-built pages: **Home** and **Tour Packages**.

### Scope (this spec)
**In scope:**
1. Next.js App Router + TypeScript scaffold (`src/app`), Tailwind theme extension encoding every verified token, `next/font` setup for Archivo + Caveat, Docker + Docker Compose, shadcn/ui init.
2. Design token layer (colors, radii, shadows, font sizes, letter-spacing, motion durations, breakpoints, `--gx` layout variable).
3. Global components: Navbar (+ mobile menu, mobile action bar), Footer, Bottom Contact Strip (WhatsApp card), Enquiry Modal, Brochure Modal (both built on one shared `LeadModal` shell), Destination card, Package card, Review card.
4. Pages: **Home** (`/`, full scroll order per product-spec §5.1) and **Tour Packages** (`/tour-packages`, per product-spec §5.3) — presentational only, fed via a typed `ContentPort` from fixture data extracted from the design export's `text/x-dc` script block.

5. **ADDED AFTER THE FACT — `/group-tours`, `/customize-tours`, `/about-us`** (see "Scope change" below).

**Explicitly out of scope (do not scaffold, do not add routes for):**
- `/destinations`, `/our-services`, `/travel-guide`, `/contact-us` and the remaining `[slug]` detail routes — later sprints (CLAUDE.md §8, Sprints 3–6).
- ~~`/group-tours`, `/customize-tours`, `/about-us`~~ — **NO LONGER OUT OF SCOPE, built 2026-09-11.** See below.

### Scope change — the three primary nav routes (2026-09-11)

This spec originally deferred every route except `/` and `/tour-packages`, and
BLOCKERS.md Decision G backed the resulting dead nav links with a branded 404,
flagged explicitly as *"conservative default — needs product confirmation"*
(and listed as still-open item 4 at the bottom of that file).

That confirmation came back the other way. The user hit the 404s during manual
browser testing and reported them as a bug: `/about-us`, `/group-tours` and
`/customize-tours` are linked from the Navbar, the Footer AND the mobile menu —
i.e. three of the site's primary nav items landed every visitor on a 404.

Re-checking the sources showed the deferral was also better-founded than the
evidence supports: the design export contains **full artboards for all three
screens** (`isGroup` lines 480–559, `isCustom` lines 561–722, `isAbout` lines
724–738) plus their backing constants (`GROUPS`, `PLACES`, `timeline`), and
product-spec §5.4/§5.5/§5.8 specify all three. There was never a content gap
for Group Tours or Customize Tours.

**Resolution:** the three routes are built. `/destinations`, `/our-services`,
`/travel-guide` and `/contact-us` remain out of scope and remain linked only
from the Footer, still backed by the branded 404.

**One genuine content gap remains, on About Us only.** The export's About
screen is a low-fidelity wireframe: the brand-story body copy is two grey
`.ln` skeleton bars, and product-spec §5.8 is two lines of section outline with
no prose. The page is therefore built with the headline and section structure
that DO exist, and the story copy carries the same visible
placeholder-notice treatment the `/legal/*` pages use. §5.8's "team section
(optional)" and "certifications/badges if applicable" are **not** built — no
names, roles, photos or certifications exist in any source, and both are
marked optional.
- Any ERP/CRM integration internals (actual network calls, auth, endpoint URLs) — see §"Blocked Boundaries" below.
- Any login, admin, tour/brochure management, or CMS screen of any kind, at any route, in this or any future sprint of this repo (see Hard Architecture Boundary below).
- SEO pass, sitemap/robots, analytics backend wiring — later sprint (CLAUDE.md §8 Sprint 6), though pages must be structured (semantic HTML, `generateMetadata`) so that pass is additive, not a rewrite.

### Hard Architecture Boundary (non-negotiable)
This repository is **the public website only**. Zero login, zero admin UI, zero tour/brochure/CMS management screens — not even placeholders or disabled stubs. Tour creation, brochure upload/versioning, and lead management live entirely in the separate ERP/CRM on a different subdomain (CLAUDE.md §1, §6).

- Product-spec §7 ("Owner/Admin Concepts"), §10 ("Future Phase — Customer Portal"), and journey E ("Repeat Customer — future") describe ERP-side or future-phase concepts. **Do not build any of it here.** They are recorded in this spec only so the implementer knows *why* certain design-export artifacts are ignored (see next two bullets).
- The design export's breadcrumb map contains a dead `admin:'Admin'` key (`crumb: {..., admin:'Admin'}`, line ~1082 of the `.dc.html`) with no corresponding screen, route, or nav entry anywhere in the file. **This is vestigial. Do not build an admin screen or route from it.**
- The design export's state computes `score`/`scoreLabel` (lead-scoring number + label) and an `events` timeline (`ev()` method, `events` array) but **never renders either** in any screen. These are CRM-side concepts (product-spec §6.4, §6.6). **Do not surface lead score or activity timeline anywhere in the public frontend** (CLAUDE.md §7: "no CRM data exposed to the public frontend"). The only thing this website does with these concepts is *emit* the underlying events (see `lib/analytics.ts` in §4 Frontend Spec) — it never displays them back.

### Deviation from `_base-project.md`
`.claude/agents/_base-project.md` describes a NestJS/React monorepo (`apps/`, `packages/back`, `packages/front`, `packages/common`). That file is a generic, un-instantiated template and **does not apply to this repo**. `CLAUDE.md` (Documents) is this project's real, fixed technical manual: Next.js App Router monolith, no NestJS backend, no monorepo packages. This spec follows CLAUDE.md's stack table verbatim. Any future agent that tries to scaffold `apps/`/`packages/back`/`packages/front` against this repo is acting against a stale template and should be stopped.

---

## 2. Functional Summary

(User-facing behavior only — full detail lives in `Documents/guruji-travel-yatra-product-spec.md`, which remains the product source of truth. This section is a pointer + the parts this spec's scope actually implements.)

- A visitor lands on **Home**, moves through the emotional entry sequence (hero → trip finder → popular destinations → international destinations → journey/video story → trust band → testimonials → stats), and can trigger **Enquire Now** or **Download Brochure** from the header, hero, mobile action bar, or any card, at any point.
- A visitor can browse **Tour Packages**, filter by destination/month/price/category chips, and scroll four themed rails of package cards (Trending / International / North India / South India, per the design export's `RAILS` fixture).
- Every conversion surface (Enquire Now, Download Brochure, Newsletter) opens a shared lead-capture modal that **inherits page context automatically** (e.g., opening from a package card pre-tags that package — the visitor is never asked to re-select what they already clicked).
- "Call Now" is **not** a modal step — it is a direct `tel:` action (header phone button, mobile action bar, WhatsApp card) that fires an analytics event only; no lead is created for a call click (CLAUDE.md §4.2).
- No lead is actually created against a real backend in this sprint — see Blocked Boundaries. The full submit → success/PDF-unlock UI flow is built and testable end-to-end against a `NotImplemented` port.

---

## 3. Architecture Overview

```
Next.js App Router (src/app)
 ├─ Server Components by default (pages, layout, cards render server-side from ContentPort)
 ├─ 'use client' only where interaction requires it (modals, filters, carousels, menu, forms)
 ├─ ContentPort  → FixtureContentAdapter (active)      → swap to ErpContentAdapter later (1-file change)
 └─ LeadSubmissionPort → NotImplementedLeadAdapter (active) → swap to ErpLeadAdapter later (1-file change)
```

- **No database, no Prisma, no ORM.** All page content in this sprint is served from static, typed fixture modules that mirror the shape of `ContentPort` exactly — so the only change required to go live is replacing the adapter implementation, not the page/component code.
- **No API routes in `src/app/api/*` are created in this sprint.** Both ports are called directly from Server Components (`ContentPort`, at request/build time, per Next.js ISR conventions) or from client form components (`LeadSubmissionPort`, client-side). Introducing real network calls happens entirely inside the adapter files.
- Styling: Tailwind CSS utility classes generated from the extended theme (§ Data Contracts → Design Tokens). No CSS-in-JS.
- Animation: Framer Motion, used only for the handful of motion effects the design export actually encodes (card hover lift, button hover lift, modal enter/exit, mobile menu slide). No invented parallax/kinetic-type/animated-counter effects beyond what's in scope for Home/Tour Packages per this spec (product-spec §2's broader motion wishlist — magnetic buttons, animated counters, animated route lines — is **not** in the design export for these two pages and is therefore out of scope here; see Open Questions).
- Every `motion` component and every CSS `transition` must be gated behind `prefers-reduced-motion` (see NFRs).

---

## 4. Frontend Spec

### 4.1 Stack & Setup

| Concern | Decision |
|---|---|
| Framework | Next.js 14+ App Router, TypeScript strict mode, no `any` anywhere |
| Rendering | Server Components by default; `'use client'` directive only on components listed as client below |
| Styling | Tailwind CSS 3.4+, theme extended per §6 Data Contracts (no arbitrary-value sprawl for tokens that have a named theme key) |
| Fonts | `next/font/google`: Archivo (weights 400/500/600/700/800) as `--font-archivo`, Caveat (weights 600/700) as `--font-caveat`. Both self-hosted via next/font — remove the `<link>`-based Google Fonts loading used in the raw `.dc.html`. Georgia is a system serif (`font-family: Georgia, serif` utility class, no font loading needed) used only as an editorial accent per product-spec §2 typography rules — not used anywhere in Home/Tour Packages scope; declare the Tailwind `font-serif-editorial` utility now so later pages can use it without re-touching config. |
| UI primitives | shadcn/ui, initialized in CSS-variables mode, with `--background`/`--foreground`/`--primary`/etc. CSS variables remapped in `globals.css` to the `gty-*` token values (§6) — never left at shadcn defaults (zinc/slate). Base components generated: `button`, `dialog`, `input`, `label`, `select`, `tabs`. |
| Forms | React Hook Form + Zod, one shared `zodResolver`-based pattern for all lead forms |
| Motion | Framer Motion, `duration: 0.15` or `0.18` seconds, `ease: [0.25, 0.10, 0.25, 1.00]` (CSS default `ease` keyword's equivalent cubic-bezier — see §6). No springs, no other durations. |
| Containerization | Docker + Docker Compose, `docker compose up` must serve the dev server (CLAUDE.md §2, §9 DoD) |
| Media | Design export images referenced via fixture `photoUrl` string keys for now (no live Cloudinary account confirmed yet) — see Assumption A4. `next/image` used everywhere images render, `sizes` set per breakpoint. |
| Package manager | pnpm (repo convention per `.claude/rules/setup.md`) |

### 4.2 Breakpoints — replacing the design tool's JS device flags

The `.dc.html` prototype toggles nav/burger/wordmark/mobile-action-bar visibility via a JS `state.device` flag (`isDesktop` = width ≥ 760, `isMobile` = width < 760) plus separate CSS `max-width` breakpoints for layout collapse (640/760/860/1080/1180/1300).

**Decision:** Do not port the JS device-flag pattern — it causes SSR/hydration mismatches in Next.js. Instead:
- Define Tailwind `screens` exactly at the design's breakpoints: `640`, `760`, `860`, `1080`, `1180`, `1300` (px), keeping Tailwind's own `min-width` semantics for each.
- Use the plain `{screen}:` variant for "visible at and above this width" cases (e.g., wordmark subtitle, header call button — visible ≥760 → class `760:flex hidden`).
- Use Tailwind's auto-generated `max-{screen}:` variant for "collapse below this width" cases (e.g., nav links hidden <1180 → `max-1180:hidden`; burger shown <1180 → `hidden max-1180:flex`).
- Only reach for a `useMediaQuery` client hook (`src/hooks/use-media-query.ts`) when *behavior*, not just visibility, must differ (e.g., the horizontal-rail "scroll by N px" amount, which the design varies between the intl-card mobile/desktop sizes). Keep this hook's usage to the minimum needed.

### 4.3 Global Components

All components below are pixel-specified against the `.dc.html` markup (colors/radii/shadows/spacing come from §6 tokens — components reference token names, not hex literals).

#### Navbar (`src/components/layout/Navbar.tsx` — server shell + client sub-parts)
- Sticky pill header (`position: sticky; top: 0; z-index: 30`), fading gradient backdrop identical to `.hdrwrap`, inner white pill bar (`.hdrbar`) with `shadow-gty-header`, `rounded-44`.
- Left: logo mark (GTY logo image asset — copy from `Documents/Website-Design/project/uploads/logo-1786287802745-uzil.png` into `public/logo/gty-logo.png`, use exactly as-is per product-spec §2, no redesign) + wordmark "GURUJI TRAVEL YATRA" + tagline "Keep Guessing, Where's Next Trip?" (wordmark block hidden below 760px).
- Center (≥1180px only): nav links Home, Tour Packages, Group Tours, Customized Tours (active-page indicator = red text + red bottom border, per `.nav.on`). **Group Tours and Customized Tours links point to routes that don't exist yet this sprint — render them as `<Link>` to their eventual paths (`/group-tours`, `/customize-tours`) so no code churn is needed later; do not hide them.**
- Right: header call button (red circle, `tel:` link, ≥760px only, fires `call_click` analytics event, does **not** create a lead), vertical divider (≥760px only), primary CTA pill button "Enquire Now" (short label "Enquire" <760px) that opens the Enquiry Modal with `context: { pageLabel: currentPageName }`, burger button (`hidden max-1180:flex`) toggling `MobileMenu`.
- `MobileMenu` (`'use client'`): slide-down panel below the header bar listing Home / Tour Packages / Group Tours / Customized Tours / About Us, plus a two-button row "Call GTY" / "Enquire Now" — matches `.dc.html` lines 145–155 exactly.
- `MobileActionBar` (`'use client'`, rendered only `<760px` via CSS, sticky to viewport bottom): Call / WhatsApp / Enquire, three-button row — matches lines 864–870.

#### Footer (`src/components/layout/Footer.tsx` — server component)
- Illustrated mountain band (`.ftband`, inline SVG mountains — copy the two `<svg>` paths from the export verbatim; they are decorative art, not photography, so no CMS/Cloudinary dependency), with the two `Caveat` script captions ("Journeys That Stay Forever" / "Explore Plan Travel Repeat") hidden below 1300px (`.ftscript`).
- Red band (`.ftrred`, `bg-gty-primary`) with the SVG wave divider on top, containing 4 columns: Brand (logo+tagline+description+social icon row: Instagram gradient / YouTube / Facebook / X / LinkedIn, each a `tel:`-style `noop` external link placeholder — **do not invent real social URLs, leave `href="#"` with a `TODO(social-links)` comment** until the client provides handles), Quick Links, Top Destinations, Support (FAQs / Travel Tips / Cancellation Policy / Terms & Conditions / Privacy Policy / Refund Policy — these link to pages that don't exist yet; render as plain `<Link>` to their future slugs, e.g. `/legal/cancellation-policy`, without building the target pages this sprint), Get In Touch (phone, email, address — literal values from the export: `+91 90999 57658`, `info@gurujitravelyatra.com`, `Ahmedabad, Gujarat, India`).
- Copyright bar (`bg-gty-primary-deep` i.e. `#a80000` — note this is a *third* red shade distinct from primary `#d80000` and deep `#b30000`; add it to tokens as `gty-primary-darker`).

#### Bottom Contact Strip (`src/components/layout/BottomContactStrip.tsx`)
- The WhatsApp "wacard": white rounded card (`rounded-18`, `shadow-gty-modal`-adjacent — use the exact `0 18px 44px rgba(28,26,25,.20)` shadow token), absolutely positioned to overlap the top of the Footer's mountain band (`top: 74px` desktop / `60px` ≤860px / `44px` ≤1300px, per the `.wacard` media rules), containing: WhatsApp icon badge (`bg-gty-whatsapp`, `shadow-gty-whatsapp`) + "Let's Plan Your Next Journey!" + phone number, a vertical divider (hidden ≤1300px), and 4 benefit mini-cells (Quick Response / Personalized Assistance / Get Itinerary & Quotes / Travel Consultation) with divider hidden ≤860px.
- Render this component immediately before `<Footer />` in the root layout; the negative-overlap visual is achieved via `position: relative` on the Footer wrapper + `position: absolute` on this card (matches `.ftrwrap`/`.wacard` structure in the export). This satisfies product-spec §3's "Bottom contact strip above the footer: WhatsApp CTA... social icons" requirement — the social icons live in the Footer's brand column immediately above/behind it, matching the export's actual layout (the export does not duplicate social icons a second time next to the WhatsApp card).

#### Lead Modal shell (`src/components/modals/`)
The design export uses **one** modal template (`.mask` / `.modal`) for both the Enquiry and Brochure flows, parameterized by `modal` (`'enquiry' | 'brochure'`), `step` (`'form' | 'sending' | 'done'`), and `isBrochure` (controls the success-state extra buttons). Build it the same way:

- `ModalShell.tsx` (`'use client'`): wraps shadcn `Dialog`, renders the `.mask`/`.modal` chrome (backdrop blur, `rounded-22`, `shadow-gty-modal`, max-width 440px, max-height 90vh scrollable), header with title + close (×), Escape/backdrop-click to close, focus trap (shadcn handles this).
- `LeadModal.tsx` (`'use client'`): the actual form + step machine. Props: `variant: 'enquiry' | 'brochure'`, `context: { label: string; value: string }` (e.g. `{ label: 'Package', value: 'Spiti Valley Circuit' }` — pre-filled/read-only, never re-asked, per product-spec §4). Internal `useState<'form'|'sending'|'done'>('form')`.
  - **Form step:** context chip (`.wf` box showing `{label}` + `{value}` + "pre-filled from this page"), fields: Name\* (text), Mobile\* (tel), Email (email, optional), Travel Date (date, optional), Travellers (number, optional), City (text, optional), Message (textarea, optional) — see Assumption A1 on why Brochure uses the same field set as Enquiry. All required-field and format validation via a shared Zod schema (`leadFormSchema`), inline error text below each field (never a bare red border with no message — accessibility requirement, see NFRs).
  - **Sending step:** progress bar UI matching `.dc.html` lines 890–892 (`"Creating your lead in the CRM"` copy — this copy is fine to keep even though the network call is unimplemented; the UI must still *look* like it's doing real work while `submitLead()` resolves).
  - **Done step:** success icon + "Your journey starts here." headline + dynamic confirmation line (never a generic "thank you" — CLAUDE.md §5.3 — reflect what was actually submitted, e.g. "We'll call you about Spiti Valley Circuit within business hours."). If `variant === 'brochure'`: render "View Brochure" / "Download Brochure" / "Send to Email" / "Send to WhatsApp" buttons — **all four are UI-only stubs this sprint** (no real PDF exists to unlock without the ContentPort's Brochure data and a real file host — see Open Question Q3). Always render "Keep Exploring" to close.
  - **Error state (not shown as a distinct step in the export, but required by CLAUDE.md §5.4):** if `submitLead()` resolves with `{status:'error'}`, stay on the form step, keep all entered values in the form (React Hook Form state persists naturally — do not reset on error), and show a dismissible inline error banner with a "Try Again" action that re-calls `submitLead()` with the same values.
- `EnquiryModal` and `BrochureModal` are thin wrappers: `EnquiryModal` = `<LeadModal variant="enquiry" .../>`, opened by the "Enquire Now"/"Enquire" CTA. `BrochureModal` = `<LeadModal variant="brochure" .../>`, opened by any "Download Brochure"/"Get Brochure" CTA.
- **"Call Now" is not part of this modal.** Per CLAUDE.md §4.2 and the export's actual action separation (`call` action = `tel:` link + `call_click` event on the header/mobile-bar/WhatsApp-card phone buttons, entirely distinct from `openEnquire`), "Call Now" is simply the existing `tel:` buttons already specified under Navbar/Footer/BottomContactStrip. **Do not build a path-selector step inside the Enquiry Modal.** (See Assumption A2.)
- `modal-context.tsx` (`'use client'`, React Context): exposes `openEnquiry(context)`, `openBrochure(context)`, `close()` so any Server Component tree can render a small client "trigger" button that calls these without prop-drilling modal state through every page.

#### Cards (`src/components/cards/`)
- **`PackageCard.tsx`** — used for Home's "Popular Destinations" grid *and* all four Tour Packages rails (they are the same visual card in the export: `.tcard`/`.pcard`). Composition, top to bottom: image (`rounded-14`, 250px tall) with category pill (top-left, icon+label), heart/favorite icon (top-right, white circle), photo-count badge (bottom-right, dark translucent pill); below the image: duration row (icon+label), name (`h`, 19px), subtitle line, divider, green "Save ₹{amount}" pill, price row (current price in `gty-primary`, strikethrough "was" price, red circular arrow-forward icon). Props map directly to the `Package` type (§6). Hover: `translateY(-3px)` + shadow escalation (`shadow-gty-card` → `shadow-gty-card-hover`), `0.18s`.
- **`DestinationCard.tsx`** — the minimal variant used only in Home's "International Destinations" rail (`.intlcard`): full-bleed photo, dark gradient overlay, centered name label near the top, no price/no heart/no category pill. 252×380px desktop, 196×296px ≤760px. Hover: `translateY(-4px)`. This is the card component to reuse later on `/destinations` (out of scope this sprint) — build it as its own component now rather than inlining it, per the "build once, reuse everywhere" instruction (CLAUDE.md §4).
- **`ReviewCard.tsx`** — vertical composition per product-spec §4 (trip photo top half, star rating + short quote + traveller name bottom half). The Home page's testimonials section arranges it inside a horizontally-arrowed single-slide carousel (matching the export's prev/next-arrow interaction, lines 315–329) rather than a swipeable multi-card row — this satisfies both the card's own spec (§4) and the export's carousel *behavior* (see §4.4 Home spec, testimonials block, for the reconciliation note).

### 4.4 Page Specs

#### Route: `/` — Home (`src/app/page.tsx`, Server Component; imports client sub-components where noted)

Built in the exact 15-step order from product-spec §5.1. Each step is tagged with its source:
- **[EXPORT]** — the `.dc.html` has a concrete, pixel-exact block for this section; build it exactly as coded there (colors/spacing/shadows from §6 tokens).
- **[TOKENS]** — the `.dc.html`'s `isHome` block does not include this section at all (verified: the entire Home screen in the export runs from Hero through the Stats band only, nothing after). Build it using the same established component/token vocabulary (cards, chips, buttons, spacing scale) so it's visually consistent, but there is no pixel reference to match against — **flag for design QA before merge** (see Open Question Q1).

| # | Section | Source | Notes |
|---|---|---|---|
| 1 | Navbar | [EXPORT] | See §4.3 |
| 2 | Hero | [EXPORT] | Full-bleed background photo (`heroPhoto`, rotates through 6 fixture keys: hero/Himalayas/Varanasi/Kashmir_Valley/Leh/Rishikesh), scrim gradient, eyebrow "Journeys that stay forever", headline "Not All Those Who Wander / Are Lost" with "Are Lost" in `font-caveat text-76 text-gty-primary` (76px per §6), body copy, two CTAs ("Start Your Journey →" primary → opens Enquiry Modal with context `{label:'Page', value:'Home'}`; "Watch Our Story ▶" secondary → scrolls to / opens the video block), 3 floating stat cards (`.wf` boxes: 10,000+ Happy Travellers / 150+ Destinations / 8+ Years Of Trust & Service — **note these differ from product-spec §5.1's "25,000+ / 150+ Destinations / 10+ Years" copy; use the export's numbers as the fixture default, see Assumption A3**). No "Scroll to Explore" indicator exists in the export — omit it (flag in Open Questions if design wants it added). |
| 3 | Trip Finder bar | [EXPORT] | Overlaps hero bottom edge (`margin-top: -Npx` style, `shadow-gty-header`-equivalent lift). Tabs: Spiritual Yatra / Group Tour / Family Holiday / Adventure / Custom Trip (from fixture `TABS`, `'use client'` for tab-switch state + hint copy line beneath). Fields row: destination search field, "Journey Month" field, "Travellers" field (all three are presentational `.fld` boxes in the export with no working dropdown — build them as real shadcn `Select`/date controls wired to local state only; **do not wire to a live destination search or availability API this sprint** — see Open Question Q2), "Explore Now →" CTA. |
| 4 | Trust strip | [TOKENS] | Product-spec's dedicated early trust strip (Curated Yatras · Trusted Since 8+ Years · 24/7 Travel Support · Pure Veg Meals · Safe & Comfortable) is **not a separate section in the export** — its content is fully covered by the "Why Travel With GTY?" band, which the export places later (after the video/journey block, before testimonials). **Decision: follow the export's actual position** (this is a layout/ordering call, and the export is the design source of truth for layout); do not build a second, duplicate trust strip near the top. Renumber this logically as occurring at step 8 below. |
| 5 | Featured Video section | [EXPORT, merged] | The export merges "Featured Video" and "Every Journey Tells a Story" into one block (lines 240–257): left column = "Explore Journeys" eyebrow, "Every Journey Tells a Story" headline, supporting line, "Explore All Journeys →" CTA (→ `/tour-packages`), a small `.wf` mini-card ("Spiti Valley Journey ▶ Watch Full Video"); right column = the actual video player (`.vidplayer`, 420px tall, background photo + centered play button + gradient + "Recent Trip Film" label + rotating `videoTitle`/`videoWhen` from fixture `VIDEOS`, cycling on `Watch Our Story` clicks). **Build one component, `JourneyVideoBlock`, covering both product-spec steps 5 and 8 in one go** — there is no separate day-by-day/route-map/Map-View-List-View-toggle treatment on Home in the export (that richer treatment exists only on the Package Detail page, out of scope this sprint). See Open Question Q1. |
| 6 | Popular Destinations | [EXPORT] | `PackageCard` grid, 5 columns desktop (`.popgrid`, collapses to 3 cols ≤1080px, 2 cols ≤640px), horizontal dot pagination indicator below (5 dots, first active — presentational only, no working pagination logic required this sprint since all 5 fixture items fit on screen; wire it for future scroll-snap if trivial, otherwise static). Data: fixture `DESTS`, mapped through `ContentPort.getPopularDestinations()` — **note:** despite the section name "Popular Destinations", the card composition shown (price/duration/savings/heart) is the `PackageCard`, not the minimal `DestinationCard` — build it exactly as the export shows; the minimal `DestinationCard` is reserved for the International rail (step 7) and the future `/destinations` page. |
| 6b | International Destinations | [EXPORT] | Not in product-spec §5.1's numbered list by this name, but present in the export directly after Popular Destinations (lines 221–238) and implied by product-spec's own destination list (Kashmir, Nepal listed as "international-flavored" in §5.1 step 6). `DestinationCard` horizontal scroll row (`.intlrow`), 6 items (Maldives/Singapore/Thailand/Malaysia/Bali/Dubai fixture), right-edge scroll arrow (≥1180px only, per `isDesktop`-gated arrow — replace with CSS breakpoint per §4.2). Keep this section; it is real export content, just not literally itemized in the product-spec numbered list. |
| 7 | Domestic Packages section | [TOKENS] | Not a distinct section on Home in the export — the export's rail concept (Trending / International / North India / South India) lives entirely on the **Tour Packages page**, not Home. Home has no second, domestic-only package grid distinct from "Popular Destinations". **Do not invent a duplicate section here.** If the client wants a literal "Domestic Packages" rail on Home distinct from Popular Destinations, that's a product decision beyond this spec — flag as Open Question Q1, do not build speculatively. |
| 8 | "Every Journey Tells a Story" | [EXPORT, merged] | Covered by `JourneyVideoBlock`, see step 5 above. |
| — | "Why Travel With GTY?" band | [EXPORT] | 5 cells (Curated Yatras / Trusted Since 8+ Years / Trusted Since... / 24/7 Travel Support / Pure Veg Meals / Safe & Comfortable — 5 total, matches product-spec's trust-strip list content), red gradient background band (`radial-gradient` per export, `rounded-24`), each cell: gold conic-gradient ring badge with inline SVG icon (copy icons verbatim — they are decorative line art, not photography), bold white title, light description. This is where product-spec's step-4 "Trust strip" content actually renders, per the Decision in row 4 above. |
| 9 | Recent Trips gallery | [TOKENS] | Not present in the export's Home block at all. Build using the existing photo-carousel pattern (same horizontal-scroll-row mechanics as the International Destinations rail) with a lightbox-on-click behavior (shadcn `Dialog` reused for the lightbox). **Flag for design QA** — no pixel reference exists (Open Question Q1). |
| 10 | Testimonials | [EXPORT, reconciled] | Export shows one active `ReviewCard`-equivalent flanked by two plain photo tiles, with prev/next arrow buttons (lines 315–329) — a single-slide, arrow-driven carousel, not a swipeable multi-card row. **Build `ReviewCard` per its §4.3 definition** (photo top half, rating+quote+name bottom half) and wrap it in a simple `'use client'` carousel component that shows one `ReviewCard` at a time with prev/next arrows, matching the export's interaction exactly. Swipe-on-mobile (product-spec §4) can be added via the same component using touch/drag gesture support in a follow-up if not trivial with the arrow-only pattern — do not block this sprint on it; note as Open Question if omitted. |
| 11 | Stats bar | [EXPORT] | Red rounded band (`rounded-16`, `shadow-gty-stats`), 5 metric cells (icon badge + big number + label). Fixture default: 10,000+ Happy Travellers / 150+ Destinations / 500+ Group Tours / 8+ Years of Experience / 98% Traveller Satisfaction (export's `metrics` array — see Assumption A3 re: product-spec's differing numbers). |
| 12 | Instagram strip | [TOKENS] | Not present in the export. Build a simple 6–8 tile photo grid + "Follow Our Journey →" link, styled with existing tokens (`rounded-14` tiles, `gap-3`). No real Instagram API integration this sprint — tiles render from a small fixture array of photo keys. Flag for design QA (Open Question Q1). |
| 13 | Newsletter | [TOKENS] | Not present in the export. Build "Let's Travel Together" headline + single email input + "Subscribe Now →" button, submitting through `LeadSubmissionPort` with `source: 'Newsletter Signup'` and only `{ email }` populated in the payload (all other `LeadPayload` fields optional/omitted). `'use client'`, RHF + Zod (email-only schema). Flag for design QA (Open Question Q1). |
| 14 | Bottom contact strip | [EXPORT] | See §4.3. |
| 15 | Footer | [EXPORT] | See §4.3. |

#### Route: `/tour-packages` — Tour Packages (`src/app/tour-packages/page.tsx`, Server Component; filter bar is client)

This page is close to 1:1 with the export (lines 341–429) — no `[TOKENS]` sections.

1. **Hero band** — gradient background, faded Himalaya photo mask on the right, two rotated Caveat script accents ("Explore / Plan / Travel / Repeat" left, "Good Trips Brighter Lives" right — decorative text, keep as literal `<span>` text in the component, not an image), breadcrumb "Home / Tour Packages", headline "Tour Packages" (with "Packages" in `text-gty-primary`), supporting copy.
2. **Filter card** (`'use client'`, `PackagesFilterBar`) — floats up over the hero bottom edge (negative margin, `shadow-gty-header`), 3 filter fields (Destination / Travel month / Price range — each a shadcn `Select`/range control, presentational only this sprint, no live query — see Open Question Q2), Clear + "Search Tours →" buttons, then a second row: "Travel Category" label + chip row (All / Spiritual / Adventure / Family / Cultural / Honeymoon / Wildlife — shadcn-free custom `pchip` styled buttons per token classes, `on` state = filled red), plus the rotated Caveat script aside ("Not Just Trips But Lifelong Memories", hidden on the `.pkart` breakpoint rule ≤1080px).
3. **Four package rails** (`PackageRail` component, reused 4×) — Trending Tour Packages / International Tour Packages / North India Tour Packages / South India Tour Packages, alternating background (`white` / `gty-cream-6`), each: header row (title + "View All Packages →"), horizontal-scroll row of 5 `PackageCard`s + right-edge scroll arrow (≥1080px only — the export hides the whole rail's arrow AND filter-field right-borders below 1080px via `.pkart{display:none}` — apply the equivalent Tailwind breakpoint classes). Data: fixture `RAILS` (4 rails × 5 packages, verbatim from the export's script block) via `ContentPort.getPackageRails()`.

Filter state (destination/month/price/category) is **local UI state only** this sprint — it does not actually filter the rendered rails yet, matching the export's own behavior (`onClick="{{ noop }}"` on the filter fields and Search button; only the category chips have real `pick`/`cls` wiring in the export). **Decision:** wire the category chip row to real client-side filtering of the fixture data (cheap, matches the one piece of the export that's actually interactive), but leave destination/month/price/Search as non-functional placeholders this sprint, exactly matching the export — do not invent a filtering/query contract for them (that depends on the unconfirmed `ContentPort` real API's filter capabilities).

### 4.5 Client vs. Server Component List

| Component | Type | Why |
|---|---|---|
| `app/layout.tsx`, `app/page.tsx`, `app/tour-packages/page.tsx` | Server | Data fetch via `ContentPort`, no interaction |
| `Footer`, `BottomContactStrip`, `PackageCard`, `DestinationCard`, `ReviewCard` (presentational), `JourneyVideoBlock` (static parts) | Server | Pure presentation from props |
| `Navbar` (shell) | Server | Renders static chrome; delegates interactive bits to children |
| `MobileMenu`, `MobileActionBar`, burger toggle | Client | Local open/close state |
| `TripFinderBar` (tabs), `PackagesFilterBar` (chips/selects), rail scroll-arrow buttons, testimonial carousel arrows | Client | Local interactive state |
| `ModalShell`, `LeadModal`, `EnquiryModal`, `BrochureModal`, `modal-context.tsx` | Client | Form state, step machine, context provider |
| `Newsletter` | Client | Form state |
| `JourneyVideoBlock`'s play button / video-switch | Client | Local play/index state |
| `use-media-query.ts` | Client hook | `window.matchMedia` |

---

## 5. Backend Spec

**Not applicable — this repo has no backend service.** Per CLAUDE.md §1/§2/§6, this is a Next.js-only client of the separate GTY ERP's API. There is no NestJS/Express service, no database, and no server-side business logic beyond Next.js Server Components reading from `ContentPort` and (in a later sprint) an ISR revalidation strategy. The two integration boundaries this sprint touches (content read, lead write) are specified as typed ports in §6, implemented by fixture/NotImplemented adapters — see Blocked Boundaries.

---

## 6. Data Contracts

### 6.1 `ContentPort` (typed, fixture-backed this sprint)

```ts
export type DestinationCategory =
  | 'Spiritual' | 'Mountains' | 'Cultural' | 'Family' | 'Adventure' | 'International';

export interface Destination {
  slug: string;
  name: string;
  region: string;
  category: DestinationCategory;
  tagline: string;
  photoUrl: string;
  photosCount?: number;
}

export interface Package {
  slug: string;
  name: string;
  destinationSlug: string;
  category: DestinationCategory;
  durationLabel: string;      // e.g. "9 Days 8 Nights"
  subtitle: string;           // e.g. "Shimla - Kaza - Chandratal"
  photoUrl: string;
  photosCount: number;
  priceFrom: string;          // pre-formatted, e.g. "₹42,500" (currency formatting owned by fixture/adapter, not components)
  priceWas?: string;
  savingsLabel?: string;      // e.g. "5,200"
  seatsLabel?: string;        // e.g. "08 seats left" | "Sold out" | "Seats open"
  isHot?: boolean;
}

export interface PackageRail {
  title: string;
  items: Package[];
}

export interface GroupTour extends Omit<Package, 'seatsLabel'> {
  dateRangeLabel: string;     // e.g. "06 — 15 Oct 2026"
  month: string;
  boardingPoints: string;
  hasTourManager: boolean;
  seatsLabel: string;
}

export interface StatMetric {
  icon: string;               // glyph/icon key, e.g. '☺' or an icon component name — resolved in the component, not the port
  value: string;               // e.g. "10,000+"
  label: string;
}

export interface FeaturedVideo {
  title: string;
  whenLabel: string;
  thumbnailKey: string;
}

export interface Review {
  photoUrl: string;
  quote: string;
  travellerName: string;
  tripLabel: string;
  ratingOutOf5: number;
}

export interface ContentPort {
  getPopularDestinations(): Promise<Package[]>;         // "Popular Destinations" section renders PackageCards, see §4.4
  getInternationalDestinations(): Promise<Destination[]>;
  getPackageRails(): Promise<PackageRail[]>;
  getFeaturedVideos(): Promise<FeaturedVideo[]>;
  getStats(): Promise<StatMetric[]>;
  getTestimonials(): Promise<Review[]>;
}
```

`FixtureContentAdapter` (`src/content/adapters/fixture-content-adapter.ts`) implements this by returning the fixture arrays (transcribed verbatim from the `.dc.html`'s `DESTS`/`PACKS`/`RAILS`/`GROUPS`/`VIDEOS`/`metrics` constants) wrapped in `Promise.resolve(...)`, so the call sites already look async/ISR-ready.

### 6.2 `LeadSubmissionPort` (typed, NotImplemented this sprint — Blocked Boundary)

```ts
export type LeadSourceTag =
  | `Enquire Now – ${string}`
  | `Brochure Download – ${string}`
  | `Group Tour Reservation – ${string}`
  | 'Custom Trip Request'
  | 'Contact Page'
  | `Service Enquiry – ${string}`
  | 'Newsletter Signup';

export interface LeadPayload {
  name?: string;               // required for enquiry/brochure forms (enforced by Zod at the form layer, optional here for the Newsletter's minimal payload)
  mobile?: string;
  email?: string;
  interestedIn?: string;       // resolved from page context — component layer, never re-asked of the visitor
  travelDate?: string;         // ISO date string
  travellers?: number;
  city?: string;
  message?: string;
  source: LeadSourceTag;
  sourcePageUrl: string;
  timestamp: string;           // ISO 8601, set at submit time
  utm?: {
    source?: string; medium?: string; campaign?: string; content?: string; term?: string;
  };
}

export type LeadSubmissionResult =
  | { status: 'success'; confirmationMessage: string }
  | { status: 'error'; retryable: boolean; message: string };

export interface LeadSubmissionPort {
  submitLead(payload: LeadPayload): Promise<LeadSubmissionResult>;
}
```

`NotImplementedLeadAdapter` (`src/content/adapters/not-implemented-lead-adapter.ts`) implements this port by **never making a network call**. It simulates a short delay (so the "Sending…" UI step is exercisable in tests/dev) and always resolves:

```ts
{
  status: 'error',
  retryable: true,
  message: 'Lead submission is not yet connected to the ERP API. This is a documented integration boundary — see CLAUDE.md §10/§12.'
}
```

with a `// TODO(ERP-LEAD-API):` comment pointing at CLAUDE.md §10 and product-spec §6. **This is intentional and must not be "fixed" by inventing a URL, payload shape, header, or API-key scheme.** Swapping in a real `ErpLeadAdapter` later is the only change required once the endpoint/auth is confirmed (CLAUDE.md §12 open question).

### 6.3 Fixture data provenance

All fixture arrays live in `src/content/fixtures/*.fixture.ts`, each file header-commented with `// Source: GTY Wireframe Prototype.dc.html, const <NAME>, line ~<N>` for traceability. No fixture values are invented — every destination/package/group-tour/stat/video entry is transcribed from the export's `DESTS`/`PACKS`/`RAILS`/`GROUPS`/`VIDEOS`/`metrics`/testimonial-block constants.

### 6.4 Design Tokens (Tailwind theme extension)

All values below are additive `theme.extend` entries in `tailwind.config.ts` — they do not replace Tailwind's default scales, they extend them under the `gty-*` namespace (colors) or as new named keys (radius/shadow/fontSize/letterSpacing/screens/duration).

**Colors** (`theme.extend.colors.gty`):

| Token | Hex | Usage |
|---|---|---|
| `primary` | `#d80000` | Primary red — buttons, links, price, accents |
| `primary-deep` | `#b30000` | Primary hover/active |
| `primary-darker` | `#a80000` | Footer copyright bar |
| `ink` | `#1c1a19` | Body text / headings default |
| `ink-soft` | `#312e2c` | Secondary headings, nav text |
| `body` | `#4a4442` | Paragraph text |
| `muted` | `#6b6461` | Chip text, secondary labels |
| `subtle` | `#8a8481` | Eyebrow labels, icon-muted, meta text |
| `placeholder` | `#a09a97` | Field placeholder text |
| `gray-1` / `gray-2` | `#b5aeaa` / `#9b9797` | Strikethrough price, disabled-ish text |
| `white` | `#ffffff` | — |
| `cream-1`…`cream-16` | `#fbfafa,#fdfcfc,#faf8f7,#f7f4f2,#f4f2f0,#f1efed,#f0e9e6,#eee9e6,#ece8e5,#eae6e3,#e7e2df,#e4dfdb,#e0dad6,#efebe8,#f2eeec,#d8d2ce` (in that order) | Section backgrounds, borders, dashed-border boxes — see mapping table in code comments; `cream-5` (`#f4f2f0`) is the default `<body>` background |
| `red-50`…`red-500` | `#fff5f4,#fff1ef,#fdeceb,#fde8e6,#f6c9c4,#f0b6b1` | Tint backgrounds for icon badges, chip "on" states, success-adjacent red accents |
| `gold-100`/`gold-200`/`gold-600`/`gold-700` | `#fdeeb8,#f8d787,#c2842a,#a3661c` | "Why GTY" icon badge conic-gradient ring |
| `whatsapp` | `#25d366` | WhatsApp brand |
| `slate-1`/`slate-2` | `#9aa1a6,#c3c8cd` | Footer mountain-art SVG fills only |
| `green-border`/`green-bg`/`green-text` | `#b7e3c6,#f1fbf5,#178a3d` | "Save ₹X" pill |

**Border radius** (`theme.extend.borderRadius`): `2,8,9,10,11,12,13,14,16,18,20,22,24,30,44` → `'{n}': '{n}px'`, plus `pill: '99px'`.

**Box shadow** (`theme.extend.boxShadow.gty-*`, exact strings, most-used first):
`badge: '0 2px 8px rgba(0,0,0,.18)'`, `social: '0 0 0 3px rgba(255,255,255,.16),0 5px 14px rgba(0,0,0,.22)'`, `soft-sm: '0 8px 28px rgba(28,26,25,.08)'`, `soft-xs: '0 3px 10px rgba(28,26,25,.07)'`, `soft-md: '0 10px 26px rgba(28,26,25,.12)'`, `soft-md2: '0 4px 14px rgba(28,26,25,.08)'`, `header: '0 18px 46px rgba(28,26,25,.13),0 3px 10px rgba(28,26,25,.06)'`, `card: '0 6px 22px rgba(28,26,25,.11)'`, `card-hover: '0 16px 40px rgba(28,26,25,.19)'`, `intlcard: '0 10px 28px rgba(28,26,25,.16)'`, `intlcard-hover: '0 18px 40px rgba(28,26,25,.24)'`, `stats: '0 10px 28px rgba(216,0,0,.24)'`, `modal: '0 24px 60px rgba(28,26,25,.4)'`, `btn-primary: '0 6px 16px rgba(216,0,0,.26)'`, `btn-primary-hover: '0 8px 20px rgba(216,0,0,.32)'`, `arrow-active: '0 4px 12px rgba(216,0,0,.3)'`, `whatsapp: '0 8px 20px rgba(37,211,102,.4)'`.

**Font size** (`theme.extend.fontSize`, keyed to avoid decimal class names): `fs-9:9px, fs-10:10px, fs-11:11px, fs-11-5:11.5px, fs-12:12px, fs-12-5:12.5px, fs-13:13px, fs-13-5:13.5px, fs-14:14px, fs-14-5:14.5px, fs-15:15px, fs-15-5:15.5px, fs-16:16px, fs-17:17px, fs-18:18px, fs-19:19px, fs-20:20px, fs-21:21px, fs-22:22px, fs-23:23px, fs-24:24px, fs-25:25px, fs-26:26px, fs-27:27px, fs-29:29px, fs-33:33px, fs-36:36px, fs-52:52px, fs-62:62px, fs-76:76px`.

**Letter spacing** (`theme.extend.letterSpacing`): `ls-1: -.02em, ls-2: -.01em, ls-3: .005em, ls-4: .01em, ls-5: .02em, ls-6: .08em, ls-7: .1em, ls-8: .13em, ls-9: .14em, ls-10: .15em, ls-11: .16em, ls-12: .2em`.

**Motion** (`theme.extend.transitionDuration` + `transitionTimingFunction`): `duration.180: '180ms'` (150ms already exists as Tailwind's default `duration-150`); `transitionTimingFunction.css: 'ease'` (the raw CSS `ease` keyword — Tailwind's unqualified `ease-*` classes default to `cubic-bezier(0.4,0,0.2,1)`, which is **not** what the export uses; the export has no `@keyframes` and no `cubic-bezier(...)` anywhere, only bare `transition: X .15s`/`.18s`, i.e. CSS-default `ease`). Framer Motion equivalents: `transition={{ duration: 0.15, ease: [0.25, 0.10, 0.25, 1.00] }}` (or `0.18`) — never a spring, never a different duration. Hover transforms: buttons `translateY(-1px)`; tour/package cards `translateY(-3px)`; generic `.card`/`.intlcard` `translateY(-4px)`.

**Layout** (`globals.css`, not a Tailwind theme key — a CSS custom property): 
```css
.site { --gx: 56px; }
@media (max-width: 760px) { .site { --gx: 18px; } }
```
Consumed via arbitrary-value utilities, e.g. `px-[var(--gx)]`. The `.sec` padding pattern (`44px 56px`) maps exactly onto Tailwind's default spacing scale — use `py-11 px-14` (11×4=44, 14×4=56), no custom key needed.

**Screens** (`theme.screens`, overriding defaults to match the export exactly): `640, 760, 860, 1080, 1180, 1300` (px). Header nav collapses to burger `max-1180`.

---

## 7. Non-Functional Requirements

- **No `any`** anywhere in the codebase; `tsconfig.json` strict mode on.
- **Server Components by default**; `'use client'` only on the components enumerated in §4.5.
- **Accessibility:** keyboard navigation on all interactive elements (cards, chips, modal, menu), visible focus states (design already defines `button:focus-visible{outline:2px solid #d80000;outline-offset:2px}` — port this globally), semantic HTML (`<nav>`, `<footer>`, `<main>`, heading hierarchy `h1`→`h2` not skipped), alt text on every image (destination/package photos need descriptive alt text derived from `Destination.name`/`Package.name`, decorative SVGs get `aria-hidden="true"`), form fields have associated `<label>`s and inline error messages linked via `aria-describedby`, color contrast checked against `gty-*` tokens (red-on-white CTAs already pass AA per the export's own accessible-looking palette, but verify at implementation time).
- **`prefers-reduced-motion`:** every Framer Motion animation must check `useReducedMotion()` (or an equivalent global provider) and either skip the animation or reduce it to an opacity-only fade; every CSS `transition`/`transform` hover effect must be wrapped in `@media (prefers-reduced-motion: no-preference)` in `globals.css` so reduced-motion users get instant state changes, not disabled hover feedback.
- **Performance:** `next/image` for all photos with explicit `sizes`, lazy-load below-the-fold sections (rails, testimonials, footer illustration), no client-side data fetching waterfalls on Home/Tour Packages (both are Server Components reading `ContentPort` at render time).
- **Responsive:** mobile-first Tailwind usage even though the source design is desktop-first CSS — write base (mobile) styles first, layer `{screen}:`/`max-{screen}:` variants per §4.2, test at all 6 breakpoints plus a couple of in-between real device widths.
- **Security posture (this sprint's slice of CLAUDE.md §7's list):** all form input passes through Zod schemas before ever reaching `LeadSubmissionPort` (client-side validation is a UX layer only — real sanitization/rate-limiting is the ERP's job once that adapter exists, per CLAUDE.md §5.1/§11); no secrets, API keys, or ERP URLs are hardcoded anywhere in this sprint's code (none exist yet — see Blocked Boundaries).
- **Docker:** `docker compose up` must build and serve the Next.js dev (or production) server with no manual steps, per CLAUDE.md §9 Definition of Done.

---

## 8. Acceptance Criteria

1. `docker compose up` builds and serves the site with no errors; `pnpm dev`/`pnpm build` also succeed with zero TypeScript errors and zero `any` usages.
2. `tailwind.config.ts` contains every token listed in §6.4 under the `gty-*` namespace (colors) or the specified named keys (radius/shadow/fontSize/letterSpacing/screens/duration/timing) — no hardcoded hex/px/shadow literals remain inline in component `className`s for values that have a token (arbitrary values are acceptable only for one-off layout numbers that aren't part of the token set, e.g. specific `top` offsets on the WhatsApp card).
3. Archivo and Caveat load via `next/font/google` with zero layout-shift-causing external `<link>` font tags; Georgia utility class exists and is unused this sprint (reserved for later pages).
4. Navbar: nav links visible ≥1180px, burger visible <1180px, wordmark/tagline hidden <760px, header call button + divider hidden <760px, mobile menu opens/closes via burger and lists exactly the 5 items specified, mobile action bar (Call/WhatsApp/Enquire) renders only <760px and is sticky to viewport bottom.
5. Footer renders all 4 columns with the literal contact details (`+91 90999 57658`, `info@gurujitravelyatra.com`, `Ahmedabad, Gujarat, India`) and the BottomContactStrip WhatsApp card overlaps the footer's top edge at the specified offsets across the 1300/860 breakpoints.
6. Opening the Enquiry Modal from a Package Card pre-fills/pre-tags the context chip with that package's name without asking the user to re-select it; opening it from the header/hero shows `{label:'Page', value:'Home'}` (or the current page's name) instead.
7. Submitting any lead form always resolves to the documented `NotImplementedLeadAdapter` error state, the form's entered values are preserved on that error (nothing is cleared), and a "Try Again" action re-submits with the same values.
8. `/` renders all 15 product-spec §5.1 sections in order (with the `[TOKENS]`-tagged sections present, even though they're not pixel-matched against the export), and `/tour-packages` renders the hero, filter bar (category chips functionally filter the 4 rails' visible items; destination/month/price/search remain non-functional placeholders), and all 4 rails with 5 items each.
9. **(REVISED 2026-09-11 — see §1 "Scope change".)** The only routes that exist are `/`, `/tour-packages`, `/tour-packages/[slug]`, `/legal/*`, `/group-tours`, `/customize-tours` and `/about-us`. No admin/login/CMS UI exists anywhere in the codebase, at any route; no `score`/`scoreLabel`/lead-activity-timeline UI exists anywhere. **The admin/CMS half of this criterion is the Hard Architecture Boundary and is NOT relaxed by the scope change** — E2E test 10 still guards it. The original wording ("no route other than `/` and `/tour-packages`") was a sprint-sequencing statement, not an architectural one, and adding the three primary nav routes does not weaken the boundary.
   - Every route reachable from the Navbar's own link list now resolves. `/destinations`, `/our-services`, `/travel-guide` and `/contact-us` are still unbuilt, still linked from the Footer only, and still land on the branded 404 (BLOCKERS.md Decision G, unchanged for those four).
10. Every hover/press animation matches the specified duration (150ms/180ms) and easing (`ease`, not a spring or a different cubic-bezier), and is disabled/reduced under `prefers-reduced-motion: reduce`.
11. Lighthouse (or equivalent) accessibility score ≥90 on both pages in dev-mode audit; keyboard-only navigation can reach and operate the Navbar, both cards' primary actions, and the full Lead Modal flow.

---

## 9. Unit Tests

(Framework/config to be finalized by the FRONTEND-TESTS agent per `_base-test.md`; this is the required coverage list.)

1. `tailwind.config.ts` — snapshot/assert that all `gty-*` color keys, radius keys, and shadow keys from §6.4 are present (guards against silent token drift).
2. `PackageCard` — renders name/price/duration/savings/seats correctly from a `Package` fixture; renders "Sold out"/"seats left" seat-label variants; hover class toggling (or Framer Motion prop) applies the correct transform.
3. `DestinationCard` — renders name over the gradient overlay; no price/heart/category elements are rendered (guards against accidentally merging it with `PackageCard`).
4. `ReviewCard` — renders quote, traveller name, trip label, and correct star count for a given `ratingOutOf5`.
5. `Navbar` — nav links list matches the specified 4 items; burger toggles `MobileMenu` open/closed; CTA button click calls `openEnquiry` with the current page context.
6. `MobileMenu` — renders exactly 5 items + the Call/Enquire button row; each item click navigates and closes the menu.
7. `LeadModal` (`variant="enquiry"`) — required-field validation blocks submit (Name, Mobile); optional fields don't block submit; on submit, transitions `form → sending → (done | form-with-error)`; error path preserves entered field values.
8. `LeadModal` (`variant="brochure"`) — same as above, plus: `done` step renders the 4 brochure-specific buttons; `enquiry` variant's `done` step does not render them.
9. `NotImplementedLeadAdapter` — `submitLead()` always resolves `{status:'error', retryable:true, ...}` and never throws, never calls `fetch`/`axios`/any network primitive (assert via a network-call spy that it's never invoked).
10. `FixtureContentAdapter` — each method resolves the expected shape/count (`getPackageRails()` returns 4 rails × 5 items; `getPopularDestinations()` returns the 5 fixture destinations mapped correctly to `Package` shape; etc.).
11. `PackagesFilterBar` — clicking a category chip filters the visible package rails to that category client-side; clicking "All" resets; destination/month/price controls do not throw when interacted with but do not alter rendered output (documented no-op).
12. `useMediaQuery` hook — returns correct boolean across a mocked `matchMedia` for each of the 6 breakpoints.
13. Reduced-motion: a component using Framer Motion renders without the animated transform/opacity keyframe when `prefers-reduced-motion: reduce` is mocked true (spot-check on `PackageCard` hover and `ModalShell` enter/exit).

---

## 10. E2E Tests

1. **Home full-page smoke:** navigate to `/`, assert all 15 sections render in DOM order (by section `data-testid` or heading text), no console errors, no hydration warnings.
2. **Tour Packages full-page smoke:** navigate to `/tour-packages`, assert hero + filter bar + 4 rails × 5 cards each render.
3. **Header CTA → Enquiry flow:** click header "Enquire Now" → modal opens with `{label:'Page', value:'Home'}` context → fill required fields → submit → assert "Sending…" appears → assert final state shows the documented not-implemented error banner with entered values still present → click "Try Again" → same error reappears (idempotent, no crash).
4. **Package card → context-aware Brochure flow:** on `/tour-packages`, click "Download Brochure"-equivalent CTA on a specific `PackageCard` → modal opens with that package's name pre-filled as context, not re-asked → submit → error-state UI verified (per Blocked Boundary, no real unlock expected).
5. **Responsive nav collapse:** at viewport ≥1180px, nav links visible and burger hidden; resize to <1180px, nav links hidden and burger visible and functional (opens `MobileMenu`, lists 5 items, closes on item click); resize to <760px, wordmark subtitle and header call button hidden, `MobileActionBar` visible and sticky at the bottom.
6. **Category chip filtering on Tour Packages:** click "Adventure" chip → assert only Adventure-category items remain visible across the rails that contain them (or the relevant rail's item count changes) → click "All" → assert full item set returns.
7. **Testimonial carousel:** click "next" arrow → assert a different `ReviewCard` becomes active/visible; click "prev" → returns to the original.
8. **Reduced motion respected end-to-end:** with OS/browser `prefers-reduced-motion: reduce` emulated, hover a `PackageCard` and open the Enquiry Modal → assert no animated transform/transition is applied (instant state change) while functionality (hover state, modal open) still works.
9. **Keyboard-only pass:** Tab from the top of `/` through the Navbar, into the Trip Finder tabs, through at least one `PackageCard`'s focusable action, open the Enquiry Modal via keyboard (Enter on the CTA), Tab through its fields, Escape to close, focus returns to the triggering element.
10. **No forbidden surfaces exist:** assert `/admin`, `/login`, `/dashboard` (or any similar guessed admin path) return Next.js's default 404 (i.e., confirm no route was accidentally scaffolded) — a regression guard for the Hard Architecture Boundary.

---

## Open Questions

1. **Sections with no design-export reference** (Home steps: Trust-strip-as-separate-block [merged instead — resolved, not a question], Domestic Packages distinct section, Recent Trips gallery, Instagram strip, Newsletter): built this sprint using established tokens/components per product-spec's text description, but with no pixel mockup to verify against. Should these get a lightweight Figma/Claude-Design pass before merge, or is "consistent with existing tokens" sufficient for this sprint's Definition of Done? Recommend routing through `edge-case-adversary`/design QA before the pre-merge gate rather than blocking this spec.
2. **Trip Finder bar / Packages filter bar real query behavior:** both the export and this spec leave destination/month/price/search as non-functional placeholders (only category chips work client-side). Product-spec §5.1 step 3 says the Trip Finder "should eventually query real destination/package data, not be decorative" — confirm whether that wiring is expected to land in *this* sprint (would require `ContentPort` to support filter parameters, not just flat fetch-all methods) or a later sprint once real destination/package volume exists. This spec assumes **later sprint** (matches the export's own current non-functional state).
3. **Brochure unlock mechanics:** the Brochure Modal's success-state buttons (View/Download/Send-to-Email/Send-to-WhatsApp) have no real PDF to point at without a confirmed `Brochure` content type + file host (Cloudinary per CLAUDE.md §2, but no account/credentials confirmed). This spec builds them as inert UI only. Confirm whether a `Brochure` shape should be added to `ContentPort` now (with dummy fixture PDFs) even though the unlock can't be real yet, or deferred entirely to the sprint that adds real brochure content.
4. ~~**Brochure Modal field set conflict**~~ — **RESOLVED BY EXECUTOR against the design export; not an open question.** The `.dc.html` renders ONE modal component for both variants, with a single shared field set and only the copy switching. Verified field labels in the export markup (from `<div class="mask">` onward): `Name *`, `Mobile Number *`, `Email`, `Travel Date`, `Travellers`, `City`, `Optional message`. The only per-variant differences are:
   - `modalTitle`: `Get Your Complete Travel Brochure` (brochure) / `Talk to GTY` (enquiry)
   - `modalDesc`: `Get the complete itinerary, inclusions, pricing and travel information.` / `Tell us where you're headed and we'll shape the journey around you.`
   - `modalCta`: `Get My Brochure` / `Start Your Journey`
   - `ctxLabel`: `Brochure for` / `Enquiring about`
   - `doneLine`: `Your brochure is ready.` / `We've got it — GTY will call you within business hours.`
   Assumption A1 is therefore **confirmed correct** — product-spec §4 matches the export, CLAUDE.md §4.3's 3-field summary is the outlier and is superseded. Since design accuracy is the stated priority, the export wins.
   **Also note:** the export's in-flight step renders the literal label `Creating your lead in the CRM` — that string marks the exact point where the blocked ERP lead-creation call belongs. Render that loading state, but it must resolve via the `NotImplemented` `LeadSubmissionPort`, NOT a real network call.
5. Social media handles/URLs for the Footer icon row are not present in any of the three source docs — placeholders (`href="#"`) with a `TODO(social-links)` comment are used; provide real URLs before the pre-merge quality gate if they're available.
6. Product-spec §2's broader motion wishlist (magnetic CTA buttons, animated counters, animated dotted flight path on the hero, animated route lines) is not encoded anywhere in the export's actual CSS/JS (verified: no `@keyframes`, no counter logic, no path-drawing SVG animation in the `.dc.html`). This spec treats those as future enhancements, not this sprint's scope. Confirm that's acceptable rather than an expectation gap.

## Assumptions

- **A1:** Brochure Modal uses the same 7-field form as the Enquiry Modal (see Open Question Q4) — chosen because it lets both variants share one `LeadModal` component with zero conditional field logic, and product-spec's dedicated bullet for the Brochure modal is more specific than CLAUDE.md's summary line.
- **A2:** "Call Now" (product-spec/CLAUDE.md's first Enquiry path) is implemented as the existing standalone `tel:` buttons (header, mobile action bar, WhatsApp card) rather than as a step/choice inside the Enquiry Modal — grounded directly in the export's own separation of a distinct `call` action from `openEnquire`.
- **A3:** Where the export's fixture numbers (10,000+ Happy Travellers, 8+ Years, 500+ Group Tours, 98% Satisfaction) differ from product-spec's prose numbers (25,000+ Happy Travellers, 10+ Years, etc.), this spec uses the export's numbers as the fixture default, since product-spec §5.1/§14 itself says these numbers "should become admin-editable... not hardcoded" — i.e., neither number is meant to be final, and the export is what's actually wired to render in the current mockup.
- **A4:** No Cloudinary/Cloudflare Images account or credentials are confirmed yet, so `photoUrl` fixture values are opaque string keys (matching the export's own `url(key)` pattern) rather than real hosted URLs; `next/image`'s `loader` config is left at Next's default local-optimization loader for now, to be swapped to a Cloudinary loader once credentials exist (single-file config change, not a component change).
- **A5:** ~~pnpm is the package manager~~ **CORRECTED BY EXECUTOR:** the package manager is **npm** (v10.9.3, Node v22.20.0). `pnpm` is **not installed** on this machine — verified. `.claude/rules/setup.md` is an un-instantiated generic template (same as `_base-project.md`) and does not apply; CLAUDE.md mandates no package manager. Use `npm` / `package-lock.json` throughout, including in the Dockerfile (`npm ci`).

### Executor environment notes (verified, authoritative)
- `node v22.20.0`, `npm 10.9.3` — available.
- `pnpm` — **NOT installed**. Do not use.
- `docker` / `docker compose` — **NOT installed**. Write the `Dockerfile` and `docker-compose.yml` per CLAUDE.md §2/§9, but they **cannot be validated by running them** this sprint. Do not claim the `docker compose up` Definition-of-Done item as met.
- `gh` CLI — **NOT installed**, and the repo has **no git remote**. The pipeline's CREATE-PR step cannot run; work is committed locally on branch `feat/gty-site-setup` only.

## Blocker Status
**NO** — nothing in this spec blocks proceeding to `edge-case-adversary` (spec-time) and implementation. The two genuinely unconfirmed cross-repo contracts (ERP lead-creation endpoint, ERP public content-read endpoint) are handled as documented `NotImplemented`/fixture-backed ports per the orchestrator's explicit instruction, not as blockers to building the UI.
