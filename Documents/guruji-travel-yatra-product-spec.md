# Guruji Travel Yatra — Website Product Spec

> **Status:** This file replaces `GTY_WEBSITE_README.md` and the earlier
> `guruji-travel-yatra-site-spec.md`. Both are superseded — do not read them
> alongside this one, they will disagree on details as they diverge over
> time. This is the single source of truth for product, UX, and content
> structure. `CLAUDE.md` remains the separate technical/build manual.

---

## 1. What this is

**Brand:** Guruji Travel Yatra (GTY)
**Tagline:** *Keep Guessing, Where's Next Trip?*

GTY is a travel company running curated spiritual yatras, group tours,
customized holidays, and destination experiences. A CRM already exists
(near-deployment-ready, pending security checks). This website is not a
brochure site bolted onto that CRM — it's the front door of one connected
system: **the website creates desire, the CRM captures intent, the sales
team converts it.**

> Core philosophy: **do not only sell destinations — sell the feeling of
> the journey.**

Emotional progression a first-time visitor should move through:

```
WOW → CURIOUS → INSPIRED → EXPLORING → INTERESTED → TRUSTED
  → ENQUIRED → LEAD CREATED → BOOKED → TRAVELLER → GTY CUSTOMER
```

Every design and content decision should be measured against whether it
moves a visitor one step down that chain.

---

## 2. Brand & Visual Direction

### Logo
Use the supplied GTY logo asset exactly as-is — do not redesign or
reinterpret it. Text: GURUJI / TRAVEL / YATRA. Identity is red + white +
black.

### Overall style
Light theme, white/off-white dominant, GTY red as primary accent, black/
charcoal type. Premium, minimal-but-rich, cinematic, modern, Gen-Z friendly,
emotion-driven, highly interactive, spacious, mobile responsive.

Rounded cards, generous whitespace, soft shadows, floating UI elements
(stat cards overlapping hero imagery), full-color photography (never
grayscale-filtered) — this is the established direction from the reference
screenshots and should be treated as final unless you deliberately decide
to change it.

### Avoid
Generic travel-agency templates, heavy dark theme, excessive gradients,
cheap stock-template cards, overly corporate layouts, walls of text,
old-fashioned Indian travel-site styling, excessive borders, excessive red
backgrounds, visual clutter.

### Color (starting palette — confirm exact reds against the logo file)
```
Primary Red    #E50909   (adjust to match logo exactly)
Deep Red       #B80000
Black          #111111
Charcoal       #2A2A2A
White          #FFFFFF
Off White      #FAFAF8
Light Gray     #F3F3F1
Border Gray    #E8E8E5
Success Green  #16A34A
```

### Typography
Strong modern sans-serif for UI/navigation, an elegant editorial/display
font for emotional hero headlines, and an optional script/handwritten
accent used sparingly for single emotional words (e.g. "Lost" in the hero,
as already shown in reference). Don't introduce more than these font roles.

### Motion & interaction
Smooth scrolling, scroll-triggered reveals, parallax imagery, floating UI
elements, hover image zoom, magnetic CTA buttons, animated route lines,
animated counters, sticky nav transitions, micro-interactions, smooth modal
transitions. Motion should communicate hierarchy and emotion, not exist
purely as decoration — max one animated headline per page. Must stay fast,
smooth, and accessible; always respect `prefers-reduced-motion`.

---

## 3. Navigation & Global Header

**Main nav:** Home · Destinations · Tour Packages · Group Tours · Customize
Tours · Our Services · Travel Guide · About Us · Contact Us

**Primary CTA (persistent, every page):** Enquire Now
**Secondary actions used throughout:** Download Brochure · WhatsApp · Call ·
Explore Journey · View Package · Join Group Tour

**Desktop header:** logo left; nav center/right; phone/WhatsApp icon +
Enquire Now button + menu icon on the right.

**Scroll behavior:** transparent/light overlay at top (blends into hero) →
converts to a clean white sticky header with subtle shadow/blur on scroll,
CTA always stays visible.

**Persistent elements on every page** (beyond the header):
- Sticky/floating side quick-link rail on desktop (Live Trips, Offers,
  Support, WhatsApp) — collapses to a bottom sheet/FAB on mobile
- Bottom contact strip above the footer: WhatsApp CTA + "Don't wait any
  longer, Contact us!" + social icons (Instagram, YouTube, Facebook, X,
  LinkedIn)
- Full footer: logo + tagline + short brand line, Quick Links, Top
  Destinations, Support links (FAQs, Travel Tips, Cancellation/Terms/
  Privacy/Refund Policy), Contact block, social links

---

## 4. Global Components (build once, reuse everywhere)

- **Navbar** — as above
- **Enquire Now modal** — two paths: *Call Now* (direct tap-to-call) and
  *Request a Callback* (Name, Mobile, Email, Destination/Package, Travel
  date, Travellers required; City, Budget, Message optional). The form
  **inherits context automatically** — if opened from a Spiti package page,
  "Spiti Valley" is pre-filled/tagged, never re-asked.
- **Brochure Download modal** — Name*, Mobile*, Email, Travel Date, Number
  of Travellers, City, optional message. Title: "Get Your Complete Travel
  Brochure." CTA: **Get My Brochure →**. On submit: validates → creates/
  updates CRM lead → records brochure request + source page + package →
  unlocks brochure (inline + optional email/WhatsApp send) → tracks the
  download event.
- **Destination card** — image, name, region/category, favorite icon, view
  action; hover: image zoom, gradient overlay, arrow movement
- **Package/Tour card** — cover image, name, duration, starting price,
  starting location, date (if applicable), category, availability, CTA
- **Group tour card** — adds date range, seats-remaining indicator
  (e.g. "08 Seats Left"), group size
- **Review/testimonial card (vertical)** — trip photo top half, star rating
  + short quote + traveller name bottom half; horizontal carousel, swipe on
  mobile

---

## 5. Page-by-Page Structure

### 5.1 Home
Emotional entry point. Build top to bottom in this exact order:

1. Navbar
2. **Hero** — eyebrow "JOURNEYS THAT STAY FOREVER," headline "Not All Those
   Who Wander Are Lost" (script accent on "Are Lost"), supporting line,
   "Start Your Journey →" (primary) + "Watch Our Story ▶" (secondary);
   large cinematic destination image with animated dotted flight path;
   floating stat cards (25,000+ Happy Travellers / 150+ Destinations / 10+
   Years); "Scroll to Explore" indicator
3. **Trip Finder bar** (overlaps hero boundary) — tabs: Spiritual Yatra /
   Group Tour / Family Holiday / Adventure / Custom Trip; fields: Where do
   you want to go, Journey Month, Travellers; CTA "Explore Now →" — should
   eventually query real destination/package data, not be decorative
4. **Trust strip** — Curated Yatras · Trusted Since 10+ Years · 24/7 Travel
   Support · Pure Veg Meals · Safe & Comfortable
5. **Featured Video section** — small landscape video player, click/scroll-
   to-play, rotating featured destination, optional thumbnail strip to
   switch between 3–4 videos
6. **Popular Destinations** — horizontal carousel of destination cards
   (Kedarnath, Badrinath, Spiti Valley, Varanasi, Rameshwaram, Kashmir,
   Nepal, Leh Ladakh), "View All Destinations" link
7. **Domestic Packages section** — grid/carousel of domestic-only package
   cards, distinct from the international ones on the Tour Packages page
8. **"Every Journey Tells a Story"** — illustrated route map, animated red
   route line, moving vehicle marker, day-by-day stop cards (Day 1 Delhi →
   Day 5 Key Monastery style), Map View/List View toggle, small video
   thumbnail, CTA "Explore All Journeys →"
9. **Recent Trips gallery** — landscape photo carousel of real traveller
   trips, click to expand into lightbox, optional destination/date caption
10. **Testimonials — "What Our Travellers Say"** — vertical review card
    carousel, real customer photos preferred over stock
11. **Stats bar** — 25,000+ Happy Travellers / 150+ Destinations / 500+
    Group Tours / 10+ Years Experience / 98% Traveller Satisfaction
    (should be editable from admin eventually, not hardcoded)
12. **Instagram strip** — "@guruji_travel_yatra," photo grid, "Follow Our
    Journey →"
13. **Newsletter** — "Let's Travel Together," email field, "Subscribe Now →"
    (creates/updates a marketing contact in CRM)
14. Bottom contact strip
15. Footer

### 5.2 Destinations
Discovery layer before a user commits to a specific package. Search +
filters (category, region, season). Cards: Popular / Spiritual / Mountain /
Beach / Family / Adventure destinations, each linking to a detail page.

**Destination detail page:** cinematic hero image/video, evocative headline
(e.g. "Where the road ends, the adventure begins"), key info (best time,
duration, experience level, ideal travellers), About / Places to Visit /
Things to Experience / Best Season / Gallery / Videos / Available Group
Tours / Available Packages / Custom Trip CTA / FAQs. Primary CTA "Explore
Available Trips →," secondary "Plan a Custom Trip →."

### 5.3 Tour Packages
The product catalogue — owner-managed, domestic + international, filterable
by destination, duration, price, category, travel month, difficulty,
availability.

**Package detail page:** hero image, starting price, dates, start/end point,
available seats, rating; day-wise itinerary, route map, hotels, meals,
transportation, inclusions/exclusions, things to carry, important notes,
cancellation policy, FAQs, gallery, reviews (use accordions for long
content). Primary CTA "Enquire Now," secondary "Download Brochure,"
additional "WhatsApp GTY." Related packages strip at the bottom.

### 5.4 Group Tours
One of the highest-conversion pages — fixed-departure tours with real
urgency signals. Cards show destination, date range, duration, starting
city, price, seats remaining, group size, tour type — e.g.:

```
SPITI VALLEY
06 OCT — 15 OCT 2026 · 9N/10D
08 Seats Left
[ View Journey ]  [ Download Brochure ]
```

**Detail page:** same content depth as a package detail page, plus group
info. Primary CTA "Join This Journey →" (routes to Enquiry flow, tagged
`Group Tour Reservation`), secondary "Download Brochure."

### 5.5 Customize Tours
Dedicated trip-builder experience. Headline: "Create Your Own Journey."
Ask: destination(s), travel date/month, number of travellers (adults +
children split), hotel category, vehicle preference, approximate budget,
meal preference, special requirements. Final CTA "Create My Trip →" — no
brochure gate needed here, the selections themselves are the value
exchange. This creates a **Custom Trip lead** — treat as higher-intent than
a brochure download since the visitor invested real effort.

### 5.6 Our Services
Non-package offerings: Hotels, Resorts, Train/Flight ticketing. Simple card
grid, each with a direct "Enquire Now" tagged to that specific service — no
brochure gate here.

### 5.7 Travel Guide
Informational, SEO-focused, builds trust pre-booking. Guide list (thumbnail
+ Best Time to Visit / How to Reach / Local Tips preview) → detail page
(full write-up, gallery, packing tips, weather, nearby attractions). Bottom
CTA: "Ready to go? View Packages for [Destination]."

### 5.8 About Us
Brand story/founder note, repeated trust stats, team section (optional),
certifications/badges if applicable.

### 5.9 Contact Us
Every contact channel in one place: tap-to-call phone, tap-to-chat WhatsApp
(pre-filled message), tap-to-mail email, all social platform icons, office
address + embedded map, general enquiry form (`source: "Contact Page"`).

### 5.10 Supporting screens (not primary nav, but required)
Search results page, 404, and loading/empty/error states for: no tours
available, no search results, brochure unavailable, form error, network
error, tour sold out, tour expired, invalid brochure link. Example pattern:

> **This journey is currently full.**
> Explore Other Group Tours →

---

## 6. Lead & CRM Logic

### 6.1 What creates a lead
Every meaningful conversion action creates or updates a CRM lead: Enquire
Now, Brochure download, Custom Trip submission, Group Tour enquiry,
WhatsApp click, Call click (where technically trackable), Newsletter
subscription.

### 6.2 Source tagging
| Trigger | Source tag | Status |
|---|---|---|
| Enquire Now → Request Callback | `Enquire Now – [Page]` | Implemented |
| Any Brochure Download | `Brochure Download – [Package Name]` | Implemented |
| Group Tour "Join This Journey" | `Group Tour Reservation – [Batch Date]` | Implemented |
| Customize Tours submission | `Custom Trip Request` | Implemented |
| Contact Us form | `Contact Page` | Pending — `/contact-us` does not exist yet |
| Our Services enquiry | `Service Enquiry – [Service Name]` | Pending — `/our-services` does not exist yet |
| Newsletter subscribe | `Newsletter Signup` | Pending — no newsletter form is wired to the API |

The three pending tags are still the plan, not dropped. `POST /api/leads`
accepts only the four implemented ones, so that a flow with no caller cannot
quietly acquire a half-specified contract. Tag format and field names as
built: `Documents/guruji-travel-yatra-website-CLAUDE.md` §5/§5.1.

**Dedupe rule:** match on mobile number (the payload field is `mobile`). One
CRM contact record, multiple interest tags and source history — never
fragmented duplicate leads. This is CRM-side logic; the website always
submits, never merges client-side — `POST /api/leads` accepts every
submission, including an identical repeat, and deduplicates nothing.

### 6.3 Example lead payload shape

*Illustrative — this is how a lead reads CRM-side, not the wire format. The
actual request body `POST /api/leads` validates is in
`Documents/guruji-travel-yatra-website-CLAUDE.md` §5.1; note `mobile` (not
`phone`) and `interestedIn` as a display string. "Travel Month" below is a
Custom Trip Request field only.*

```
Name: Rahul Sharma
Mobile: XXXXXXXXXX
Email: rahul@email.com
Interested In: Spiti Valley 9N/10D
Lead Type: Brochure Download
Lead Source: Website
Source Page: Spiti Valley Package
Travel Month: October
Travellers: 4
Created: 09 Aug 2026
```

### 6.4 Lead activity timeline (CRM-side, sourced from site events)
```
19:21 — Visited Home
19:23 — Viewed Kashmir
19:26 — Viewed Spiti Valley
19:28 — Downloaded Spiti Brochure
19:31 — Viewed Group Tours
19:34 — Submitted Enquiry
```
Gives sales real context on intent before they call.

### 6.5 Source & campaign tracking
Capture channel (Direct, Google, Instagram, Facebook, WhatsApp, Referral,
Website, Campaign) plus UTM parameters (`utm_source`, `utm_medium`,
`utm_campaign`, `utm_content`, `utm_term`) on every lead — needed for
marketing ROI reporting later.

### 6.6 Lead scoring (design for it now, tune weights later)
```
Website visit          +1      Brochure requested   +10
Destination viewed     +2      WhatsApp clicked      +15
Package viewed         +3      Call clicked           +15
Gallery viewed         +1      Enquiry submitted      +20
                                Repeat visit            +5
```
Labels: New → Warm → Hot → Very Hot → Converted / Lost. Weights should be
configurable, not hardcoded — this lives on the CRM side, the website just
needs to emit the underlying events.

---

## 7. Owner/Admin Concepts (inside the existing CRM, not a separate site)

The owner must be able to publish tours and manage brochures **without
developer involvement**:

- Create/edit/publish/unpublish/schedule tours
- Upload cover image, gallery, videos, brochure PDF; replace brochure
- Set price, dates, available seats, destination, category
- Manage itinerary, inclusions, exclusions, FAQs, testimonials,
  destination content

**Tour creation workflow:** Login → Create New Tour → Tour Details → Add
Itinerary → Upload Images → Upload Brochure → Set Price/Dates/Seats →
Preview → Publish → Live on Website.

**Brochure Library:** per-tour view of brochure version, upload date, file
size, status, download count, last updated. Actions: Preview, Replace,
Download, Archive. **Never hard-delete a brochure tied to existing leads/
bookings** — archive instead.

**Per-tour analytics:** Views, Brochure Requests, Brochure Downloads,
Enquiries, Bookings, Conversion Rate — e.g.:
```
SPITI VALLEY
Views 1,842 · Brochure Requests 327 · Downloads 291 · Enquiries 84 · Bookings 19
```

---

## 8. Microcopy Style

Warm, confident, emotional, human, modern, trustworthy — never generic
corporate phrasing, and don't overdo inspirational quotes.

| Instead of | Prefer |
|---|---|
| Submit Enquiry | Start Your Journey → |
| Download PDF | Get My Brochure → |
| Contact Us | Talk to GTY → |
| View Details | Explore Journey → |

---

## 9. Key User Journeys

**A — Discovery:** Instagram/Google → Home → Destination → Package →
Enquire → CRM Lead

**B — Brochure:** Home → Group Tour → Tour Detail → Download Brochure →
Lead Form → CRM Lead → Brochure Access

**C — Custom Trip:** Home → Customize Tours → Trip Builder → Submit → CRM
Lead → Sales Follow-up

**D — Direct Enquiry:** Any Page → Enquire Now → Context-aware form → CRM →
Sales Team

**E — Repeat Customer (future):** Website → Login → My Journeys → Upcoming
Trip → Documents/Updates

---

## 10. Future Phase — Customer Portal ("My Journeys")

Not built in this phase, but the data model shouldn't block it later.
Customer account would show: upcoming/past trips, booking details, payment
status, itinerary, hotel/pickup/driver details, group info, trip documents,
photos, reviews. Post-trip prompt: "How was your journey?" collecting
rating/review/photos, potentially reused (with approval) on the public
site.

---

## 11. Non-Functional Requirements

**Performance:** responsive images, WebP/AVIF, lazy loading, video
optimization, code splitting, no huge uncompressed hero videos, smooth
animation without sacrificing load speed, mobile-first performance,
reduced-motion support.

**Responsive:** mobile-first across mobile/tablet/laptop/large-desktop.
Mobile specifics: sticky compact header, hamburger nav, bottom/side quick
actions, swipeable destination/testimonial cards, simplified hero,
touch-friendly buttons, optimized forms.

**Accessibility:** keyboard navigation, proper contrast, alt text, semantic
HTML, visible focus states, reduced-motion option, accessible forms with
clear validation, screen-reader-friendly labels.

**Security** (the CRM is separately going through its own security
checks — this site must not undermine that): secure API authentication, no
exposed admin credentials, server-side validation, rate limiting, bot/spam
protection on all lead forms, secure/protected brochure URLs, input
sanitization, CSRF protection, proper authorization, no CRM data exposed to
the public frontend, audit logging for admin actions.

---

## 12. Data Principle

The website should be driven by the CRM/API, not hardcoded tour content:

```
GTY CRM / Backend → API → GTY Website
```

Website requests Destinations, Tours, Group departures, Prices, Dates,
Availability, Brochures, Reviews, and Content from the backend — see
`CLAUDE.md` section 6 & 10 for the exact integration contract requirements.

---

## 13. Deliverables Checklist

**Public website:** Home · Destinations · Destination Detail · Tour
Packages · Tour Package Detail · Group Tours · Group Tour Detail · Customize
Tours · Our Services · Travel Guide · About Us · Contact Us · Enquire Now ·
Brochure Lead Popup · Search Results · 404 · Loading/Empty/Error states

**Future customer area:** Login, My Journeys, Booking Details, Trip
Documents, Profile

**Admin concepts (inside CRM):** Dashboard, Tour Management, Create/Edit
Tour, Brochure Library, Lead Management, Lead Activity, Analytics

---

## 14. Open Items

- Confirm exact primary red against the actual logo file (palette in
  Section 2 is a starting point, not final)
- Confirm whether `readme.md`'s "Modernist" design system (flat, zero
  radius, grayscale photography, Archivo font) was intended for this
  project — it currently contradicts everything in this spec and the
  reference screenshots, and has not been applied here pending that
  confirmation
- Numbers in stat/trust sections (25,000+ travellers etc.) should become
  admin-editable rather than hardcoded once the CRM content API exists
