# Guruji Travel Yatra — Website Specification & Wireframe Brief

> **Purpose of this document:** Full page-by-page structure, components, and user flows for the Guruji Travel Yatra website. Intended to be fed directly into Claude Code (or a design tool) to generate low-fidelity wireframes first, then high-fidelity screens. Every section below is a wireframe target — build in the order listed.

---

## 0. Brand & Design Direction

- **Brand name:** Guruji Travel Yatra
- **Tagline:** "Keep Guessing, Where's Next Trip?"
- **Positioning:** Emotional, story-driven travel brand (pilgrimage + adventure + leisure), targeting a younger, digitally-native Indian and global audience without losing trust signals older travelers rely on.
- **Visual tone:** Warm reds/maroons, white space, soft rounded cards, bold serif/script accents on emotional headlines (e.g. "Are Lost" in the hero), sans-serif for UI and body text.
- **Interaction tone:** Scroll-triggered reveals, subtle parallax on hero imagery, hover-lift on cards, kinetic type sparingly (max one animated headline per page), smooth (not jarring) motion. Respect `prefers-reduced-motion`.
- **Persistent elements on every page:**
  - Top navbar (logo left, nav links center/right, "Enquire Now" button always visible, top-right)
  - Sticky/floating side rail on desktop: quick links (Live Trips, Offers, Support, WhatsApp) — as seen in reference hero
  - Bottom-of-page contact strip: WhatsApp number + "Don't wait any longer, Contact us!" + social icons (Instagram, YouTube, Facebook, X, LinkedIn) — appears above the main footer on every page
  - Full footer: logo, nav link columns, top destinations, support links, contact info, social icons, copyright

---

## 1. Global Components (build these first — reused everywhere)

### 1.1 Navbar
- Logo (left)
- Links: Home, Destinations, Tour Packages, Group Tours, Customize Tours, Our Services, Travel Guide, About Us, Travel Guide, Contact Us
- "Enquire Now" button (red, filled, top-right, persistent) → opens **Enquiry Modal** (see 1.4)
- Hamburger/menu icon for mobile
- Active page indicator (underline, as shown in reference)

### 1.2 Enquire Now Modal (global — triggered from navbar on every page)
Two options inside the modal:
- **Call Now** — tap-to-call button, shows the business number directly
- **Request a Callback** — short form: Name, Phone/WhatsApp, Preferred time to call, optional message → creates a CRM lead tagged `source: "Enquire Now – [Page Name]"`

### 1.3 Brochure/Download Gate Modal (used across Destinations, Tour Packages, Group Tours, Customize Tours)
- Triggered by any "Download Brochure" or "View Package Details (PDF)" button
- Fields: Name, Phone/WhatsApp, Email
- Package/tour auto-tagged silently based on which brochure was clicked (no dropdown needed)
- On submit: lead created instantly in CRM (`source: "Brochure Download"`, package tag, timestamp) → dedupe by phone number, append interest tag if lead already exists
- Success state: PDF unlocks inline + "Send to my WhatsApp" button + 2-3 related package suggestions

### 1.4 Bottom Contact Strip (matches uploaded reference image)
- Left: WhatsApp icon, "Don't wait any longer, Contact us!" + large tappable phone number
- Divider
- Right: "Be part of our Social Media Journey!" + Instagram, YouTube, Facebook, X, LinkedIn icons
- Rounded white card, sits just above the footer, full-width dark background behind it

### 1.5 Footer
- Big logo left
- Right: link columns — Home, Tour Packages, Group Trips, Creator (if applicable), Careers, About Us, Contact Us, Terms & Conditions, Privacy Policy, Payment Details
- Bottom bar: copyright, "Designed with ❤️ for travellers"

### 1.6 Card components (reused across pages)
- **Destination card:** image, name, region/state, heart/save icon, hover arrow
- **Package card:** cover image, title, duration, price range, "View Details" + "Download Brochure" CTAs
- **Review card (vertical):** top half = traveller's trip photo, bottom half = star rating + short review text + traveller name — as described, vertical rectangle, used in a horizontal scroll/carousel on Home

---

## 2. Page: Home

Build top to bottom exactly in this scroll order:

1. **Navbar** (global component)
2. **Hero section**
   - Left: eyebrow text ("JOURNEYS THAT STAY FOREVER"), big headline "Not All Those Who Wander Are Lost" (last two words styled/script accent), supporting line, two CTAs: "Start Your Journey" (filled) + "Watch Our Story" (play icon, text link)
   - Right: large destination image (e.g. Kedarnath temple), animated flight-path dotted line with plane icon looping around it
   - Floating stat cards (25,000+ Happy Travellers / 150+ Destinations / 10+ Years) overlapping the image, right side
   - Floating "Your Journey Starts Here" tag near top of image
   - "Scroll to Explore" mouse-scroll indicator, bottom center
3. **Trip Finder bar** (overlapping hero/next section boundary)
   - Tabs: Spiritual Yatra / Group Tour / Family Holiday / Adventure / Custom Trip
   - Fields: Where do you want to go (search), Journey Month (date picker), Travellers (counter), "Explore Now" CTA
4. **Trust strip** — 5 icons in a row: Curated Yatras, Trusted Since 10+ Years, 24/7 Travel Support, Pure Veg Meals, Safe & Comfortable
5. **NEW — Featured Video Section** *(as requested)*
   - Small horizontal/landscape video player embed, autoplay-muted-on-scroll-into-view or click-to-play
   - Shows a rotating featured destination video ("This week: Spiti Valley" style label)
   - Optional thumbnail strip below to switch between 3-4 featured videos
6. **Popular Destinations** — horizontal scroll/carousel of destination cards (Kedarnath, Badrinath, Spiti Valley, Varanasi, Rameshwaram etc.), "View All Destinations" link top-right
7. **NEW — Domestic Packages Section** *(as requested)*
   - Grid or carousel of domestic-only package cards, distinct from the international ones referenced later on the Tour Packages page
   - Each card: destination image, package name, duration, starting price, "View Package" CTA
8. **Journey Map / Story Section** — "Every Journey Tells a Story", illustrated route map with day-by-day stops (Day 1 Delhi → Day 5 Key Monastery style), Map View / List View toggle, small video thumbnail ("Spiti Valley Journey — Watch Full Video")
9. **NEW — Recent Trips Gallery Section** *(as requested, mirrors the video section pattern)*
   - Landscape image gallery/carousel of recent traveller trip photos
   - Click to expand into lightbox
   - Optional caption: destination + date of trip
10. **Testimonials — "What Our Travellers Say"**
    - Vertical review cards in a horizontal carousel: top half = trip photo, bottom half = star rating + quote + traveller name — arrows left/right to navigate
11. **Stats bar** — 25,000+ Happy Travellers / 150+ Destinations / 500+ Group Tours / 10+ Years of Experience / 98% Traveller Satisfaction
12. **Instagram feed strip** — "@guruji_travel_yatra" handle + "Follow Us On Instagram" link, grid of recent post thumbnails
13. **Newsletter strip** — "Let's Travel Together", email input + "Subscribe Now"
14. **Bottom Contact Strip** (global component 1.4 — matches uploaded reference)
15. **Footer** (global component 1.5)

---

## 3. Page: Destinations

- Hero banner (smaller than home) — "Explore Destinations" + search/filter bar
- Filter sidebar or top filter bar: Region (Domestic/International), Theme (Spiritual, Adventure, Family, Group), Budget range
- Grid of destination cards (reused component)
- Each destination card → **Destination Detail Page**:
  - Hero image gallery
  - Short description, best time to visit, highlights
  - Linked packages available for this destination
  - "Download Brochure" CTA → opens Brochure Modal (1.3)
  - "Enquire Now" CTA
- Bottom Contact Strip + Footer

---

## 4. Page: Tour Packages

- **Purpose:** Owner uploads all tour packages (with photos + brochure PDF) here — both domestic and international.
- Tab or filter toggle: **Domestic / International**
- Package grid (reused package card component): cover photo, title, duration, price range, quick highlights
- Each card → **Package Detail Page**:
  - Full image gallery
  - Day-by-day itinerary
  - Inclusions / Exclusions
  - Pricing table (if multiple tiers — Standard/Deluxe/Premium)
  - "Download Brochure" CTA (Brochure Modal)
  - "Enquire Now" CTA
  - Related packages suggestion strip at bottom
- Bottom Contact Strip + Footer

---

## 5. Page: Group Tours

- Similar structure to Tour Packages, but filtered specifically to fixed-departure group tours
- Each card additionally shows: **upcoming batch dates**, seats remaining/limited-seats indicator, group size
- Package Detail Page includes: batch calendar, price per person (with group discount tiers if applicable), "Reserve Your Seat" CTA (routes into the Enquiry flow, tagged `source: "Group Tour Reservation"`)
- "Download Brochure" CTA (Brochure Modal)
- Bottom Contact Strip + Footer

---

## 6. Page: Customize Tours

- **Purpose:** User builds their own trip by selecting destinations rather than picking a pre-made package.
- Interactive destination picker: map or grid, user selects multiple locations (multi-select cards, "+ Add to my trip" style)
- Selected destinations appear in a running "Your Trip" summary panel (sticky sidebar or bottom drawer)
- Fields: number of travellers, approximate dates, budget range, preferences (hotel category, transport mode, meal preference)
- Submit → creates a CRM lead tagged `source: "Custom Trip Request"` with full selection details attached — this is a **richer lead than the brochure form**, so route it straight to "Qualified" stage or flag it as high-intent in the CRM since the user has invested real effort filling it out
- No PDF/brochure gate needed here — the selections themselves are the value exchange
- Bottom Contact Strip + Footer

---

## 7. Page: Our Services

- **Purpose:** Non-package offerings — Hotels, Resorts, Train/Flight Ticketing
- Simple 3-column (or stacked on mobile) service cards: icon, title, short description
- Each service → either expands inline or links to a short detail section: what's included, how to request (routes to Enquiry Modal, tagged with the specific service)
- No brochure gate here (these are add-on services, not tour products) — direct "Enquire Now" per service card
- Bottom Contact Strip + Footer

---

## 8. Page: Travel Guide

- **Purpose:** Basic details/guides for all tours — informational, SEO-friendly, builds trust before booking
- Guide list/grid: destination name, thumbnail, "Best time to visit," "How to reach," "Local tips" preview
- Each guide → detail page: full write-up, image gallery, packing tips, weather info, nearby attractions
- CTA at bottom of each guide: "Ready to go? View Packages for [Destination]" → links to relevant Tour Packages/Destinations filtered view
- Bottom Contact Strip + Footer

---

## 9. Page: About Us

- Brand story section (why Guruji Travel Yatra exists, founder note)
- Stats repeat (25,000+ travellers, 10+ years, etc.)
- Team section (optional)
- Trust/certification badges if applicable
- Bottom Contact Strip + Footer

---

## 10. Page: Contact Us

- **Purpose:** Every contact platform in one place, as requested.
- Direct contact block: Phone (tap-to-call), WhatsApp (tap-to-chat, pre-filled message), Email (tap-to-mail)
- Social platform icons: Instagram, YouTube, Facebook, X, LinkedIn — each linking out
- Office address + embedded map
- General contact form (Name, Email, Phone, Message) → CRM lead, `source: "Contact Page"`
- Bottom Contact Strip (this page still shows it for consistency, even though it's redundant with the page content) + Footer

---

## 11. Cross-Page: Lead & CRM Logic Summary

| Trigger | Source Tag | Notes |
|---|---|---|
| Navbar "Enquire Now" → Call Now | — | No lead created; direct call tracking only (call tracking number recommended) |
| Navbar "Enquire Now" → Request Callback | `Enquire Now – [Page]` | Basic lead |
| Any "Download Brochure" click | `Brochure Download – [Package Name]` | Dedupe by phone; append interest tag if lead exists |
| Group Tour "Reserve Your Seat" | `Group Tour Reservation – [Batch Date]` | High priority, time-sensitive |
| Customize Tours submission | `Custom Trip Request` | High-intent, richer data, flag for priority follow-up |
| Contact Us form | `Contact Page` | General enquiry |
| Our Services enquiry | `Service Enquiry – [Service Name]` | e.g. Hotels, Flights |

**Deduping rule:** match on phone number across all sources. One CRM contact record, multiple interest tags and lead-source history, not fragmented duplicate leads.

---

## 12. Admin/Owner-Side: Brochure & Package Manager

Inside the CRM (not the public site):

- Upload new package: cover image, gallery images, PDF brochure, itinerary text, pricing, inclusions/exclusions, tag as Domestic/International/Group/Custom-eligible
- Draft/Active toggle — prep before publishing
- Version control on brochures (replace PDF without breaking existing shared links)
- Per-package analytics: views, brochure downloads, leads generated — surfaced back to the owner so they know which packages are actually converting

---

## 13. Instructions for UI Generation (Claude Design)

This document is the design brief. Claude Design should use it to produce the actual visual UI — not just a low-fidelity skeleton. Once these screens are finalized here, they'll be handed to Claude Code separately for build-out, so treat this as the source of truth for structure *and* visual direction.

1. Design **page by page**, in the order listed in this document (Home → Destinations → Tour Packages → Group Tours → Customize Tours → Our Services → Travel Guide → About Us → Contact Us).
2. Build **global components first** (Section 1) as a reusable design system — navbar, Enquiry Modal, Brochure Modal, bottom contact strip, footer, destination/package/review cards — before assembling full pages, so every page stays visually consistent.
3. Start with a low-fidelity structural pass (grayscale, labeled sections, no real imagery) to lock the layout, then move to full high-fidelity visual design using the brand direction in Section 0 (colors, type, motion tone).
4. For Home, follow the exact scroll order in Section 2 — do not reorder or drop the video section, domestic packages section, or recent-trips gallery section; these are new additions layered on top of the reference screenshots.
5. Mark every button/CTA with its destination (modal, page link, or external action) directly on the design, so the click-through flow is traceable before this goes to Claude Code for build-out.
6. Design mobile breakpoints alongside desktop: multi-column sections (trust strip, stats bar, service cards) collapse into stacked single-column layouts, and the side quick-link rail (Live Trips/Offers/Support) becomes a bottom sheet or floating action button.
7. Where this brief says "reused component," actually reuse the same design element/symbol across pages rather than redrawing it — this keeps the eventual Claude Code handoff clean, since one component in design should map to one component in code.
