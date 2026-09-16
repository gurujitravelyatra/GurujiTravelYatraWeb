# CLAUDE.md — Guruji Travel Yatra Public Website (Operating Manual for Claude Code)

> This file is written for an AI coding agent, not a human reader. Re-read this
> file at the start of every session in this repo. Where this file and
> `README.md` overlap, treat this file as the more precise, actionable version —
> `README.md` is the human-facing summary; this is the execution manual.
>
> This project is separate from, but connected to, the Guruji Travel Yatra ERP
> (the internal CRM). This site is the **public marketing/booking-enquiry
> website**; the ERP is the **internal staff tool** where leads generated here
> get worked. Do not merge the two codebases or deploy them at the same URL.

---

## 1. What this project is (business context)

Guruji Travel Yatra is a travel agency. The ERP (separate repo) is where staff
manage leads, bookings, invoices, and the full customer lifecycle internally.
**This project is the public-facing website** — the storefront a traveler
finds via search/social/ads, browses, and converts into a lead from.

**The lifecycle this site supports, in order:**

1. A visitor lands on the site (organic, ad, or social) and browses
   destinations, tour packages, or group tours
2. The visitor takes a conversion action — downloads a brochure, requests a
   callback, reserves a group tour seat, or submits a custom trip request
3. Every conversion action creates a **Lead** directly in the ERP via its API
   — this site holds no lead data of its own beyond what's needed to submit
   the request and show a success state
4. From that point on, the lead lives entirely in the ERP; staff follow up
   there. This site has no visibility into lead status, pipeline stage, or
   staff notes — it is a one-way write (site → ERP), not a two-way sync
5. Content (destinations, tour packages, group tours, brochures) is managed
   by the Owner/Admin through the **existing ERP's Tour Master module** —
   this site should **read** that data via API, not maintain its own
   separate content database for tours/packages

**This is a public, unauthenticated site.** No visitor ever logs in. There is
no traveler account system in this phase. The only authenticated surface
related to this project is content management, and that happens through the
ERP (see section 10) — this repo does not implement its own admin/login UI.

---

## 2. Tech stack — fixed, do not substitute

| Layer | Technology | Notes |
|---|---|---|
| Frontend Framework | Next.js (App Router) + TypeScript | SSR/SSG required for SEO — do not use a client-only SPA setup |
| Styling | Tailwind CSS | Must visually match the Claude Design mockup export exactly |
| Animation | Framer Motion | Scroll-triggered reveals, hover states, kinetic type — must respect `prefers-reduced-motion` |
| UI Primitives | shadcn/ui | Base for modals (Enquiry, Brochure Download), form inputs, carousels — skin with Tailwind to match brand |
| Forms | React Hook Form + Zod | Client-side validation before any lead-creation API call |
| Media/Assets | Cloudinary or Cloudflare Images | All destination photos, gallery images, and brochure PDFs served from here, not from the app's own file storage |
| Lead/Content API | Guruji Travel Yatra ERP API | This site is a **client** of the ERP's API — see section 10. Do not build a parallel database for leads or tour content |
| Containerization | Docker + Docker Compose | Must run via `docker compose up`, consistent with the ERP repo's convention |
| Target Hosting | Vercel (preferred, for SSR/edge/image optimization) | If Vercel is rejected for any reason, flag it — do not silently default to Railway/VPS just because the ERP uses that |

If you (Claude Code) believe a substitution is warranted for any of the above,
stop and flag it — do not substitute silently.

---

## 3. Pages — full public site map

No authentication on any of the below. This is the complete route list; do
not add routes not listed here without flagging it first.

| Route | Purpose |
|---|---|
| `/` | Home — hero, trip finder, video section, domestic packages, popular destinations, journey map, recent trips gallery, testimonials, stats, Instagram feed, newsletter |
| `/destinations` | Destination grid + filters → `/destinations/[slug]` detail page |
| `/tour-packages` | Domestic/International tour package grid → `/tour-packages/[slug]` detail page |
| `/group-tours` | Fixed-departure group tours with batch dates → `/group-tours/[slug]` detail page |
| `/customize-tours` | Interactive multi-destination trip builder |
| `/our-services` | Hotels, Resorts, Train/Flight ticketing — enquiry-only, no brochure gate |
| `/travel-guide` | Informational destination guides → `/travel-guide/[slug]` |
| `/about-us` | Brand story, stats, team |
| `/contact-us` | All contact channels + general enquiry form |

Full section-by-section breakdown of each page (exact scroll order, component
placement, copy references, lead logic, admin concepts, microcopy, and user
journeys) lives in `documentation/design/guruji-travel-yatra-product-spec.md`
— treat that file as the product/layout source of truth, and this file as
the technical/architectural source of truth. Where they conflict, stop and
ask.

---

## 4. Global components — build these first

1. **Navbar** — logo, page links, persistent "Enquire Now" button (opens
   Enquiry Modal), active-page indicator, mobile hamburger menu
2. **Enquiry Modal** — two paths: "Call Now" (tap-to-call, no lead created,
   should still fire a `call_click` analytics event) and "Request a Callback"
   (Name, Mobile, optional Email/Travel date/Travellers/City/Message →
   creates ERP lead, `source: "Enquire Now – [Page Name]"`). The payload
   field is `mobile`, not `phone`; there is no "Preferred time" input — see
   §5.1 for the shape as built.
3. **Brochure Download Modal** — same field set as the Enquiry Modal (Name,
   `mobile`, Email, …; one component, `LeadModal`, only the copy differs) →
   creates ERP lead (`source: "Brochure Download – [Package Name]"`, package
   auto-tagged from context, no dropdown shown to user) → on success, unlocks PDF inline + optional "Send
   to my WhatsApp" + related package suggestions
4. **Bottom Contact Strip** — WhatsApp CTA + social icons, appears above the
   footer on every page
5. **Footer** — logo, link columns, top destinations, support links, social
   icons, copyright
6. **Card components** — Destination card, Package card, Review card
   (vertical: trip photo top half, rating+quote bottom half) — build once,
   reuse everywhere per section 3's page list

---

## 5. Lead creation — exact behavior required

Every form on this site that creates a lead must behave identically at the
integration layer, regardless of which page/modal triggered it:

1. Client-side validation (React Hook Form + Zod) before any network call
2. POST to the ERP's lead-creation endpoint (see section 10) with:
   - all fields the visitor filled in, verbatim
   - a `source` tag identifying which flow created it (see table below)
   - a `package`/`tour` reference where applicable, resolved from page
     context — **never ask the visitor to re-select what they already
     clicked on**
   - a timestamp and the current page URL (for attribution)
3. On success: show the relevant success state (PDF unlock, confirmation
   message, or "seat reserved" state) — never a generic "thank you," the
   confirmation should reflect what the visitor actually asked for
4. On failure: show a retry option and do not lose the visitor's entered
   data — never make them re-type everything
5. **This site does not deduplicate leads.** Dedup-by-phone-number and
   interest-tag merging is ERP-side logic (it already owns the Customer/Lead
   tables) — sending a second submission from the same visitor is correct
   behavior on this end; the ERP decides how to merge it

| Trigger | `source` value | Status | Notes |
|---|---|---|---|
| Enquiry Modal → Request Callback | `Enquire Now – [Page]` | Implemented | `formType: 'enquiry'`. `pageName` is optional — the Navbar's persistent "Enquire Now" has no page context, and the server falls back to `Enquire Now – General enquiry` rather than rejecting the site's most prominent CTA |
| Any "Download Brochure" click | `Brochure Download – [Package Name]` | Implemented | `formType: 'brochure'`, `packageName` |
| Group Tour "Reserve Your Seat" | `Group Tour Reservation – [Batch Date]` | Implemented | `formType: 'group-tour-reservation'`. `batchDate` is REQUIRED (it is `GroupDeparture.dateRangeLabel`, e.g. `"12 — 18 May 2026"`) — a time-sensitive seat request that cannot be tied to a departure is not worth filing. Time-sensitive, flag as high priority in payload if the API supports it |
| Customize Tours submission | `Custom Trip Request` | Implemented | `formType: 'custom-trip'`. Richer than other lead types: `stops[]` (slug/name/region/nights), `travelStyle`, `travelMonth`, `adults`, `childrenCount`, `notes`. **There is no numeric "budget" field** — `travelStyle` (Budget/Comfort/Premium/Luxury) is the only price-tier signal the trip builder collects |
| Contact Us general form | `Contact Page` | **Pending — no page exists yet** | Still the plan; `/contact-us` is unbuilt, so nothing can send this tag and `POST /api/leads` does not accept it |
| Our Services enquiry | `Service Enquiry – [Service Name]` | **Pending — no page exists yet** | Still the plan; `/our-services` is unbuilt, same as above |

### 5.1 Request shape — `POST /api/leads`

The route (`src/app/api/leads/route.ts`) validates server-side with a Zod
discriminated union on `formType`, keyed to the four implemented rows above.
Field names are those the modals actually build in
`LeadModal.runSubmit` — see `LeadPayload` in `src/content/ports.ts`:

| Field | Notes |
|---|---|
| `name` | Required |
| `mobile` | Required. **It is `mobile`, not `phone`** — every form, every layer |
| `email` | Optional |
| `interestedIn` | Optional. A DISPLAY string resolved from page context, e.g. `"Spiti Valley Circuit · 9 Nights / 10 Days"` — never a slug, and never re-asked of the visitor |
| `travelDate` | Optional, `YYYY-MM-DD` from `<input type="date">` |
| `travellers` | Optional integer |
| `city` | Optional |
| `message` | Optional free text |
| `sourcePageUrl` | Required. `window.location.href` at submit time |
| `utm` | Optional `{ source, medium, campaign, content, term }`, read from the query string at submit time |

Plus the per-`formType` context fields in the table above.

**`source` is not accepted from the client.** The client may send one (the
current modal does); it is discarded. The server rebuilds the tag from the
structured context fields, because on a public unauthenticated endpoint the
CRM routing key must not be caller-controlled.

**`timestamp` is not accepted either** — the server stamps `receivedAt` from
its own clock.

**Nothing is persisted.** There is no lead table; see
`documentation/technical-specification/BLOCKERS.md` §6. The server log is the
only record a lead leaves — grep `LEAD-SUBMISSION`.

---

## 6. Content — reading from the ERP, not duplicating it

Destinations, Tour Packages, Group Tours, and Brochures are **managed by the
Owner/Admin inside the existing ERP** (its Tour Master module, per the ERP's
own CLAUDE.md section 4.5). This site must:

- Fetch published tour/package/destination content from the ERP's public
  content API (read-only from this site's perspective)
- Never provide its own create/edit/delete UI for tours, packages, or
  brochures — that stays inside the ERP where the Owner already manages it
- Respect a Draft/Active flag from the ERP — only render `Active` content
  publicly
- Cache/revalidate appropriately (Next.js ISR) since tour content changes
  infrequently compared to lead traffic — don't hit the ERP API on every
  single page load for content that rarely changes

If the ERP does not yet expose a public read API for this content, **stop and
flag it** — this is a blocking dependency, not something to work around with
a duplicate content model on the website side.

---

## 7. Non-functional requirements

- SEO is a primary requirement, not an afterthought: proper meta tags, Open
  Graph tags, semantic HTML, sitemap.xml, robots.txt, server-rendered content
  for all destination/package/guide pages (not client-side-only rendering)
- Page load performance matters as much as visual richness — target
  sub-2-second First Contentful Paint despite heavy imagery/video/animation;
  lazy-load below-the-fold media, use responsive image sizes via
  Cloudinary/Cloudflare Images transforms
- Fully responsive — mobile-first, must work well on phone, tablet, and
  laptop; side quick-link rail collapses to a bottom sheet/FAB on mobile
- All animation must respect `prefers-reduced-motion`
- HTTPS enforced everywhere
- No visitor PII is stored in this repo's own database beyond what's
  transiently needed to submit a lead-creation request — this site should
  not become a second copy of lead/customer data

---

## 8. Sprint plan (build order — full vertical slices, not layers)

| Sprint | Scope |
|---|---|
| 1 | Project setup, global components (navbar, footer, bottom contact strip, card primitives), design system tokens matching Claude Design export |
| 2 | Home page, full scroll-order build per `site-spec.md` |
| 3 | Destinations + Tour Packages + Group Tours (list + detail pages), ERP content API integration |
| 4 | Enquiry Modal + Brochure Download Modal, full lead-creation integration per section 5 |
| 5 | Customize Tours (interactive builder) + Our Services + Travel Guide |
| 6 | About Us + Contact Us, SEO pass (meta tags, sitemap, OG tags), performance pass |
| 7 | Testing, cross-browser/device QA, production deployment |

Each sprint = working UI + working integration (where applicable), tested
locally via `docker compose up` before considered done. Do not build a
sprint UI-only and defer the ERP integration to a later sprint — brochure
and enquiry flows must be real, working lead submissions by the sprint that
introduces them, not stubbed.

---

## 9. Definition of done (apply to every feature, every sprint)

A feature is not done until:
- [ ] It builds and runs with no errors via `docker compose up`
- [ ] It matches the Claude Design mockup's visual layout for that screen
      (colors, spacing, typography, component structure, motion)
- [ ] Any form on the page successfully creates a real lead in the ERP (not
      a mocked/stubbed API call) with the correct `source` tag
- [ ] Responsive on mobile, tablet, and desktop breakpoints
- [ ] Animations respect `prefers-reduced-motion`
- [ ] Meta tags/SEO basics present for any public content page
- [ ] At least one test exists for it in `/tests`
- [ ] This file's sprint tracker (below) is updated to reflect progress

---

## 10. Integration contract with the ERP — confirm before building section 5/6

This site depends on the ERP exposing:
1. A **lead-creation endpoint** (public-safe, e.g. rate-limited/CAPTCHA- or
   token-protected since it's called from an unauthenticated public site) —
   confirm exact endpoint, required/optional fields, and auth mechanism
   (likely an API key scoped to "website lead submission" rather than a user
   JWT, since there is no logged-in user here)
2. A **public content read endpoint** for Tours/TourDates/Destinations/
   Brochures, filtered to `Active` status only — confirm this exists or is
   planned, since section 6 depends entirely on it

**Do not guess these contracts and build against assumptions.** If the ERP
team/repo hasn't defined these yet, stop and flag it as a blocking
cross-repo dependency before starting Sprint 3 or Sprint 4.

---

## 11. Sprint progress tracker

*(Update this section after every session — Claude Code should edit this file
directly as work completes.)*

*Last updated: not yet started.*

- [ ] Sprint 1 — Project setup, global components, design tokens
- [ ] Sprint 2 — Home page
- [ ] Sprint 3 — Destinations, Tour Packages, Group Tours + ERP content read integration
- [ ] Sprint 4 — Enquiry + Brochure modals, ERP lead-creation integration
- [ ] Sprint 5 — Customize Tours, Our Services, Travel Guide
- [ ] Sprint 6 — About Us, Contact Us, SEO + performance pass
- [ ] Sprint 7 — Testing & deployment

---

## 12. Open questions / things not to assume

If any of the following come up, stop and ask rather than guessing:
- Exact ERP API contract for lead creation and content read (section 10) —
  this is the single biggest blocking dependency for this repo
- Whether the ERP's public content API is ready, or whether this site needs
  to launch with placeholder/manually-seeded content first and switch over
  later
- Auth mechanism for this site calling the ERP API (API key vs. signed
  request vs. something else) — do not invent a scheme without confirming
  with however the ERP secures its public-facing endpoints
- Whether "Customize Tours" submissions need any real-time availability
  check against TourDates, or if it's purely a request-for-quote with no
  live inventory check
- Domain/subdomain structure — is this deployed at the root domain with the
  ERP on a subdomain (e.g. `admin.guruji-travel-yatra.com`), or some other
  split? Confirm before finalizing any cross-origin/CORS configuration
