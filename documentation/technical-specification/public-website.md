# Public Website API

The CRM backend's own `/api/public/*` surface — what the public website (a
separate Next.js app, same Railway project, no longer with its own database)
reads tours/places/site content from, and where its enquiry forms post.

This file is the contract the website repo is built against. If a field here
and the running API ever disagree, the API is the bug — file it against the
CRM, do not silently work around a mismatch in the website.

All paths below are relative to the API's base URL and already include the
global `/api` prefix the whole backend runs under, e.g.
`https://crm.example.com/api/public/tours`.

## Contents

- [Design rules](#design-rules)
- [Caching](#caching)
- [Rate limiting](#rate-limiting)
- [CORS](#cors)
- [Error shape](#error-shape)
- [`GET /public/tours`](#get-publictours)
- [`GET /public/tours/:slug`](#get-publictoursslug)
- [`GET /public/departures`](#get-publicdepartures)
- [`GET /public/places`](#get-publicplaces)
- [`GET /public/site`](#get-publicsite)
- [`GET /public/categories`](#get-publiccategories)
- [`GET /public/sitemap`](#get-publicsitemap)
- [`POST /public/enquiries`](#post-publicenquiries)
- [Website revalidation hook](#website-revalidation-hook)
- [Environment variables](#environment-variables)

## Design rules

- No login, ever. Every read is `@Public()`; the one write
  (`/public/enquiries`) is `@Public()` plus its own guard, never the session
  cookie or the staff permission matrix.
- Every response is built by an explicit whitelist mapper — never a database
  row serialised directly. The following NEVER appear in any `/public/*`
  response, under any field name: vendor/hotel rates, costs, margins,
  internal notes, user ids or emails, passenger or customer data, booking
  data, payment data. (`public-tours.service.spec.ts` and
  `public-site.service.spec.ts` prove this by feeding a "poisoned" row
  carrying every one of those fields through the real mappers.)
- Only `isLiveOnWebsite: true` AND not-deleted tours are ever returned. Only
  active places and active site images.

## Caching

Every GET response carries:

```
Cache-Control: public, s-maxage=60, stale-while-revalidate=300
ETag: "<sha256 of the response body>"
```

Send the ETag back as `If-None-Match` on a repeat request; a match gets
`304 Not Modified` with an empty body.

Independently, the heavy list queries (tours, departures, places, site,
categories, sitemap) are held in a 60-second in-memory cache on the API
process itself (`PUBLIC_CACHE_TTL_MS` in `public-cache.service.ts`) — this is
what stops real website traffic from reaching the database on every request,
on top of whatever the `Cache-Control` header buys at a CDN or in Next.js's
own fetch cache. It is per API process; a second Railway replica would hold
its own separate 60-second cache.

## Rate limiting

Every route below is throttled **per IP**:

| Route(s) | Limit |
|---|---|
| `GET /public/tours`, `/tours/:slug`, `/departures`, `/categories`, `/places`, `/site` | 600 / minute |
| `GET /public/sitemap` | 120 / minute |
| `POST /public/enquiries` | 10 / minute |

`POST /public/enquiries` is **also** limited per normalised phone number — 5
submissions per 10 minutes, independent of how many IPs they arrive from.

## CORS

Governed by `WEBSITE_ORIGINS` (below), **separately** from the CRM
frontend's own `CORS_ORIGIN`. This is a safety net: the main caller is the
website's own Next.js **server**, which sends no `Origin` header at all and
is unaffected either way. It only matters if the website's client-side code
ever calls `/public/*` directly from a browser.

## Error shape

Every error is:

```json
{ "statusCode": 400, "error": "Bad Request", "message": { "code": "VALIDATION_FAILED", "message": "..." } }
```

(Nest's standard shape, wrapping this API's own `{ code, message }`.) No
stack trace, ever, regardless of environment.

| HTTP | `code` | When |
|---|---|---|
| 404 | `NOT_FOUND` | Unknown or not-live tour slug |
| 400 | `VALIDATION_FAILED` | Malformed query/body, or Turnstile rejected the token |
| 401 | `API_KEY_INVALID` | `/enquiries` — missing/wrong `x-website-api-key` |
| 429 | `RATE_LIMITED` | Too many requests from this phone number |
| 429 | (Nest's own `ThrottlerException`) | Too many requests from this IP |
| 503 | `NOT_CONFIGURED` | `WEBSITE_API_KEY` or `TURNSTILE_SECRET_KEY` not set in this environment |

---

## `GET /public/tours`

Card data for the tour listing/filter page.

**Query parameters** (all optional):

| Param | Type | Notes |
|---|---|---|
| `category` | string | One of `Spiritual`, `Adventure`, `International`, `Family`, `Group` — the website's own taxonomy, separate from the CRM's internal one |
| `place` | string | A place's `slug` — tours covering that place |
| `month` | string | `YYYY-MM` — tours with at least one departure that month |
| `q` | string | Free text, matched against name/short description/region |
| `page` | integer | Default `1` |
| `pageSize` | integer | Default `12`, capped at `50` |

**Response `200`:**

```json
{
  "tours": [
    {
      "slug": "kashmir-paradise",
      "name": "Kashmir Paradise",
      "category": "Adventure",
      "shortDescription": "A week in the valley.",
      "coverImageUrl": "https://media.example.r2.dev/tour-images/abc.jpg",
      "price": { "amount": 25000, "currency": "INR" },
      "durationDays": 6,
      "durationNights": 5,
      "departureCity": null,
      "primaryPlace": { "name": "Srinagar", "slug": "srinagar" },
      "nextDeparture": { "date": "2026-07-01", "seatsLeft": 8 },
      "hasBrochure": true
    }
  ],
  "total": 42,
  "page": 1,
  "pageSize": 12
}
```

**`price`** is `Tour.fromPrice` — the "from ₹X" figure set in Tour Master,
**GST-inclusive** (the same figure the Website tab's own "incl. 5% GST" note
refers to; see the report for how this was confirmed).

**`departureCity`** is **always `null`**. There is no such attribute on a
tour in the data model — "departure city" exists only on a `Booking` /
`Invoice` / `Voucher`, entered once a customer is matched to a departure, so
there is nothing to read before a tour is ever booked. The field is kept in
the shape (rather than dropped) so the website's TypeScript type is stable
if a real value is ever added later — **do not build a UI around this ever
being non-null today.**

**`nextDeparture`** is `null` when the tour has no upcoming (today-in-IST-
or-later) departure row at all. When present, `seatsLeft` is
`seatsTotal - seatsBooked` of that departure; it is never `null` once a
departure exists, because `TourDate.seatsTotal`/`seatsBooked` are always
tracked for every row (this product does not have an "untracked capacity"
departure).

**`hasBrochure`** reflects only the **website's own** R2-hosted brochure
(`Tour.brochureUrl`). A tour that only has the legacy, CRM-internal
`TourBrochure` (served through an authenticated download, never a public
URL) reports `hasBrochure: false` here — there would be nothing public to
link to otherwise.

## `GET /public/tours/:slug`

The full tour detail page.

**Response `200`** — everything `GET /public/tours` has, plus:

```json
{
  "slug": "kashmir-paradise",
  "name": "Kashmir Paradise",
  "category": "Adventure",
  "shortDescription": "A week in the valley.",
  "coverImageUrl": "https://media.example.r2.dev/tour-images/abc.jpg",
  "price": { "amount": 25000, "currency": "INR" },
  "durationDays": 6,
  "durationNights": 5,
  "departureCity": null,
  "primaryPlace": { "name": "Srinagar", "slug": "srinagar" },
  "nextDeparture": { "date": "2026-07-01", "seatsLeft": 8 },
  "hasBrochure": true,
  "description": "A week in the valley.",
  "highlights": ["Dal Lake houseboat stay", "Gulmarg gondola"],
  "itinerary": [
    { "day": 1, "title": "Arrival", "detail": "Arrive Srinagar, transfer to houseboat." }
  ],
  "inclusions": ["Breakfast and dinner daily", "All transfers"],
  "exclusions": ["Airfare", "Personal expenses"],
  "cancellationPolicy": "30+ days: 10% · 15-29 days: 25% · <15 days: 50%",
  "gallery": [{ "url": "https://media.example.r2.dev/tour-images/g1.jpg", "alt": "Dal Lake at sunset" }],
  "brochureUrl": "https://media.example.r2.dev/tour-brochures/kashmir.pdf",
  "places": [{ "name": "Srinagar", "slug": "srinagar" }, { "name": "Gulmarg", "slug": "gulmarg" }],
  "pricingOptions": [
    { "label": "Standard", "note": "per person, twin sharing", "price": { "amount": 25000, "currency": "INR" } },
    { "label": "Single occupancy", "note": "supplement", "price": { "amount": 32000, "currency": "INR" } }
  ],
  "departures": [
    { "date": "2026-07-01", "returnDate": null, "price": null, "seatsLeft": 8, "soldOut": false }
  ],
  "seoTitle": "Kashmir Paradise Tour Package | 6 Days",
  "seoDescription": "Book a 6-day Kashmir tour covering Srinagar and Gulmarg."
}
```

**`pricingOptions`** — `TourPricingTier` rows (e.g. "Standard", "Single
occupancy supplement"). **Judged public** on the basis that these are
customer-facing package choices, not a vendor cost or margin figure; flag
this call if it is wrong and they should be withheld.

**`departures[].returnDate`/`.price`** are currently always `null` —
`TourDate` carries neither a return date nor its own per-departure price in
the data model today (every departure uses the tour's own `price`/
`pricingOptions` above). Kept in the shape for the same forward-compatibility
reason as `departureCity`.

**Redirect response, `200`** (NOT `301` — the website issues its own
redirect from this):

```json
{ "redirectTo": "kashmir-paradise-2026" }
```

Returned when `:slug` does not match any live tour but DOES match a retired
slug (`TourSlugHistory.oldSlug`) of a tour that still exists and is not
deleted — regardless of whether that tour is *currently* live. If the tour
was deleted, this falls through to the `404` below instead of redirecting to
a dead page.

**`404`** — the slug is neither a live tour's current slug nor a retired one.

## `GET /public/departures`

Upcoming departures of live tours, soonest first. **Never** includes a
departure before today in IST — this is enforced at the query, not filtered
client-side.

**Query parameters** (all optional): `month` (`YYYY-MM`), `q` (free text,
matched against the tour's name).

**Response `200`:**

```json
{
  "departures": [
    {
      "slug": "kashmir-paradise",
      "name": "Kashmir Paradise",
      "category": "Adventure",
      "shortDescription": "A week in the valley.",
      "coverImageUrl": "https://media.example.r2.dev/tour-images/abc.jpg",
      "price": { "amount": 25000, "currency": "INR" },
      "durationDays": 6,
      "durationNights": 5,
      "departureCity": null,
      "primaryPlace": { "name": "Srinagar", "slug": "srinagar" },
      "nextDeparture": { "date": "2026-07-01", "seatsLeft": 8 },
      "hasBrochure": true,
      "departureDate": "2026-07-01"
    }
  ],
  "months": ["2026-07", "2026-08", "2026-09"]
}
```

`months` lists every `YYYY-MM` that has at least one upcoming departure of a
live tour — for the month filter chips — independent of the `month`/`q`
query params on this same request.

## `GET /public/places`

Active destinations, in their saved display order.

**Response `200`:**

```json
[
  {
    "name": "Kedarnath",
    "slug": "kedarnath",
    "region": "Himalaya",
    "description": "A sacred temple town in the Garhwal Himalayas.",
    "imageUrl": "https://media.example.r2.dev/place-images/kedarnath.jpg",
    "showInCustomBuilder": true,
    "liveTourCount": 3
  }
]
```

`liveTourCount` counts only tours that are both live and not deleted —
`isLiveOnWebsite: true, deletedAt: null`.

## `GET /public/site`

Active site images grouped by slot, and the website settings.

**Response `200`:**

```json
{
  "images": {
    "HERO_BACKGROUND": [{ "url": "https://media.example.r2.dev/site-images/hero.jpg", "alt": "Himalayan sunrise" }],
    "ABOUT": [],
    "GALLERY": [
      { "url": "https://media.example.r2.dev/site-images/g1.jpg", "alt": "Group at Dal Lake" }
    ],
    "FOOTER": []
  },
  "settings": {
    "heroHeadline": "Journeys that stay with you",
    "heroSubtext": "Pilgrimage, adventure and leisure tours across India",
    "happyTravellersLabel": "10,000+",
    "destinationsLabel": "50+",
    "yearsExperienceLabel": "15",
    "showFiguresNote": false,
    "phone": "+919822041188",
    "whatsappNumber": "+919822041188",
    "email": "hello@gurujitravelyatra.example",
    "instagramUrl": "https://instagram.com/gurujitravelyatra",
    "address": "Pune, Maharashtra",
    "profileVideoUrl": "https://www.youtube.com/embed/example"
  }
}
```

Every one of the four slot keys (`HERO_BACKGROUND`, `ABOUT`, `GALLERY`,
`FOOTER`) is always present, even with an empty array, so the website's
layout never has to guard a missing key. Every settings field is `null`
until the Owner has saved it at least once — there is no backfill or
default copy.

## `GET /public/categories`

Distinct website categories of live tours, with counts.

**Response `200`:**

```json
[
  { "category": "Adventure", "count": 7 },
  { "category": "Spiritual", "count": 12 }
]
```

A category with zero live tours is simply absent from the array.

## `GET /public/sitemap`

Slugs and last-updated dates for the website's own sitemap generation.

**Response `200`:**

```json
[
  { "type": "tour", "slug": "kashmir-paradise", "updatedAt": "2026-06-01T10:00:00.000Z" },
  { "type": "place", "slug": "kedarnath", "updatedAt": "2026-05-20T08:00:00.000Z" }
]
```

## `POST /public/enquiries`

Turns the website's enquiry / brochure-request / reserve-seat / custom-trip
forms into a CRM `Lead` — or a note on an existing one.

**Headers:**

```
x-website-api-key: <WEBSITE_API_KEY>
Content-Type: application/json
```

**Body:**

```json
{
  "kind": "ENQUIRY",
  "name": "Jane Doe",
  "phone": "9822041188",
  "email": "jane@example.com",
  "message": "Interested in a September departure for 4 people.",
  "tourSlug": "kashmir-paradise",
  "departureDate": "2026-09-15",
  "travellers": 4,
  "preferredMonth": "2026-09",
  "placeSlugs": ["srinagar", "gulmarg"],
  "travelStyle": "Luxury",
  "consent": true,
  "turnstileToken": "<Cloudflare Turnstile response token>",
  "honeypot": ""
}
```

| Field | Required | Notes |
|---|---|---|
| `kind` | yes | One of `ENQUIRY`, `BROCHURE_REQUEST`, `RESERVE_SEAT`, `CUSTOM_TRIP` |
| `name` | yes | 2–120 chars, no control characters, no `http(s)://`/`www.` |
| `phone` | yes | Any shape `normalizeIndianMobile()` accepts — e.g. `9822041188`, `+91 98220 41188`, `09822041188` |
| `email` | no | — |
| `message` | no | Max 2000 chars. HTML tags are **stripped** before storage, not merely rejected |
| `tourSlug` | no | Must look like a slug |
| `departureDate` | no | `YYYY-MM-DD`, must be a real calendar date between today and 2 years out |
| `travellers` | no | 1–50 |
| `preferredMonth` | no | `YYYY-MM` |
| `placeSlugs` | no | Up to 10 slugs |
| `travelStyle` | no | Max 100 chars |
| `consent` | yes | Must be literally `true` |
| `turnstileToken` | yes | From the website's own Turnstile widget |
| `honeypot` | no | Must be empty/absent. A filled value is treated as a bot: the response is identical, nothing is created |

**Response `200`** (always, whether a lead was created, a note was added to
an existing one, or the honeypot caught a bot):

```json
{ "ok": true }
```

**Protection, in order:**

1. `x-website-api-key` must equal `WEBSITE_API_KEY` — wrong or missing is
   `401`; `WEBSITE_API_KEY` unset in this environment is `503` and nothing
   runs past this point.
2. A filled `honeypot` short-circuits to `{ "ok": true }` with nothing
   checked or created — before Turnstile is ever called.
3. `turnstileToken` is verified against Cloudflare. `TURNSTILE_SECRET_KEY`
   unset is `503`; Cloudflare rejecting the token (or a timeout talking to
   Cloudflare) is `400 VALIDATION_FAILED` — the two are indistinguishable to
   the caller.
4. Per-phone rate limit (5 / 10 minutes) — `429 RATE_LIMITED`.
5. `PublicLeadsService.submitEnquiry` — the actual lead logic (below), which
   is the SAME service `POST /public/leads` (the older, simpler enquiry
   intake — still in place, untouched by this build) already uses.

**Lead creation:**

- `Lead.source` is the literal string `"Website"` — `Lead.source` is an open
  `String` column, not an enum, so this needed no migration.
- Lands `owner: "Unassigned"` (the company-wide pool), `stage: "NEW"`,
  `value: 0` — nobody on staff has seen it yet.
- `Lead.interest` is the tour slug, place slugs, or the enquiry kind,
  whichever is most specific. `Lead.notes` is a readable block combining
  every field the form carried (kind, tour, departure date, travellers,
  month, places, travel style, message).
- **Duplicates:** if an **OPEN** lead (`stage` is `NEW`, `CONTACTED` or
  `QUOTED` — not `CONVERTED` or `LOST`) already exists for the same
  normalised phone number, no second lead is created. Instead, the enquiry
  is added as a `NOTE` activity on the existing lead ("Enquired again from
  the website: …"), and the website-facing response is identical either way.
  **Known limitation:** this check is a read then an insert, not a database
  constraint — two near-simultaneous *first-time* enquiries from the same
  phone number could each create a lead. Accepted as low-stakes (a
  salesperson merges the two) rather than building a second claim-table for
  it; see the report for this call.
- An activity-feed event (`WEBSITE_ENQUIRY_RECEIVED`) is recorded either way,
  with actor `"Website"` (no user) — visible to anyone who can see leads
  (`LEAD_CRM` permission), same visibility rule as every other lead event.

## Website revalidation hook

Best-effort, fire-and-forget. After a save that changes anything the public
site reads — a tour's Website tab, price, dates, slug, publish state, a
Place, a Site image, Site settings — the CRM backend `POST`s to
`WEBSITE_REVALIDATE_URL`:

```
POST <WEBSITE_REVALIDATE_URL>
x-revalidate-secret: <WEBSITE_REVALIDATE_SECRET>
Content-Type: application/json

{ "paths": ["tours", "tour:kashmir-paradise"] }
```

`paths` is a small set of tags/paths, e.g. `tours`, `tour:<slug>`,
`departures`, `places`, `site`. This call **never blocks or fails the
underlying save** — a 3-second timeout, and any failure is logged once
(paths only, never the website's response body) and otherwise swallowed. If
either `WEBSITE_REVALIDATE_URL` or `WEBSITE_REVALIDATE_SECRET` is unset, the
hook does nothing at all — no error, no log line, no attempt.

## Environment variables

| Variable | Required | Effect when unset |
|---|---|---|
| `WEBSITE_ORIGINS` | no | `/public/*` adds no CORS headers for a browser caller (server-to-server traffic is unaffected either way) |
| `WEBSITE_API_KEY` | no | `POST /public/enquiries` returns `503` for every request |
| `TURNSTILE_SECRET_KEY` | no | `POST /public/enquiries` returns `503` for every request |
| `WEBSITE_REVALIDATE_URL` | no | The revalidation hook does nothing, silently |
| `WEBSITE_REVALIDATE_SECRET` | no | Same — both URL and secret must be set together |

None of these have a default or a fallback value. All five are safe to leave
unset in a development environment; the read endpoints work fully either
way, and the two write-path env vars simply keep `/public/enquiries` turned
off until both are set.
