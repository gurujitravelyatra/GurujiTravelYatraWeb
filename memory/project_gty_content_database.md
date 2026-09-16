---
name: GTY site — interim content database (CLAUDE.md line 56 overridden)
description: Why this repo has a Postgres content DB despite CLAUDE.md forbidding one, what the override does and does not cover, and what has never been tested.
type: project
---

Branch `feat/gty-site-setup`, commits `f0f1bbb`..`26b6c4b` (2026-09-14 → 09-16).

## The override
CLAUDE.md §2 **line 56** says "Do not build a parallel database for leads or tour
content"; §10 makes the site a pure ERP read-client; BLOCKERS.md §1b noted §6
"explicitly forbids working around it with a duplicate content model".

**The user overrode this knowingly.** Full record: `BLOCKERS.md` §5 (committed).
The ERP content API (§1b) is still unconfirmed, so content moved to a database
this repo owns, editable without a code deploy.

**Scope — narrow, do not widen without asking:**
- CONTENT ONLY: tours, destinations, group departures, brochure metadata.
- **NO LEADS.** That prohibition is NOT overridden. No lead table exists in
  `prisma/schema.prisma` and none may be added under this decision.
  **RESOLVED 2026-09-17 (`c8b5ef7`): the user chose LOG-ONLY. `POST /api/leads`
  now exists and still adds NO table** — see `BLOCKERS.md` §6. Every submission
  is written to the server log in full (`src/server/leads/lead-log.ts`,
  grep `LEAD-SUBMISSION`); the CRM stub (`src/server/crm-client.ts`) makes no
  network call and cannot report a delivery that did not happen. The tripwire
  stands: a lead model in `prisma/schema.prisma` still did not come from any
  decision. **Cost accepted: the logs now hold personal data, and log
  retention is now lead retention — nobody has set that number.**

  Original stop (2026-09-16), kept because the reasoning still governs:
  asked for a lead table + `POST /api/leads` + a CRM stub that stores the lead
  locally and returns success to the visitor. Refused on two independent
  grounds:
  (1) it is precisely what line 56 forbids and what BLOCKERS.md §5 says this
  override does not cover — that file even pre-wrote the tripwire *"If a lead
  model ever appears there, it did not come from this decision"*;
  (2) telling a visitor "we've got it, GTY will call you" for a row sitting in a
  table no one reads is a promise the system cannot keep — worse than Decision
  B's honest "not connected yet, please call". Leads are one-shot data: unlike
  content, a lost or unmonitored lead cannot be re-derived.
  Also found: the requested field names do not match what the app sends
  (`mobile` not `phone`, `interestedIn` — a display string — not `tourSlug`),
  the request omitted `travellers`/`city`/`sourcePageUrl`/`utm`, and 4 of the 6
  source tags have NO caller (2 of their pages are unbuilt). Building it would
  have required inventing the contract CLAUDE.md §10 forbids guessing.
  **If the user approves a lead store, get it in writing in BLOCKERS.md first.**
  (Those field-name findings were confirmed and are now fixed in the docs —
  see `feedback_qg_doc-contract-drift.md`.)
- **NO admin/login/CMS.** Data layer + seed script only.
- Deployed: same Railway instance as the CRM, own schema + credentials. Not the
  CRM's tables.

**Isolation is by CONVENTION, not by permission (2026-09-16 safety check).** The
configured URL scopes `search_path` with `?schema=gty_site_content`, but it
connects to database `railway` as **`postgres`, a superuser** — nothing would
stop a stray unqualified write from reaching `public`. Today that is low-risk
because the instance is EMPTY apart from our schema (no CRM tables exist yet,
`public` has zero user tables), but the moment the CRM lands, this credential
can read and drop its data. Ask for a scoped role before that happens.

**Exit:** write `ErpContentAdapter implements ContentPort`, swap it in
`src/content/content-adapter.ts`, delete `prisma/`. No page/component changes —
`ContentPort`'s signature was deliberately left unaltered (brochures got a
separate `BrochurePort` rather than a new method on it).

## What stayed on fixtures
Testimonials, stats, videos, About milestones, trip places, tabs. Their
`isPlaceholder` honesty markers live in those files.
`PrismaContentAdapter` composes `FixtureContentAdapter` and delegates these.

## DATABASE_URL is the gate
Set → `PrismaContentAdapter`; unset → `FixtureContentAdapter`. "No database" is a
SUPPORTED mode — it is how `npm test` and Playwright's fixture assertions run.
Production logs a loud warning when falling back.

**`jest.setup.ts`'s `delete process.env.DATABASE_URL` is NOT airtight
(2026-09-16).** Importing `@prisma/client` re-loads `.env` as a side effect and
puts the variable back, after setup has run. Harmless in jsdom (Prisma resolves
to its browser build there), but it silently does not hold in
`@jest-environment node` tests that import the composition root — i.e. every API
route test. The first ones ran against the LIVE database for ~18s before this was
caught. **Node-env content tests must pin the adapter with an explicit
`jest.mock('@/content/content-adapter', ...)`.** A node-env content test that
takes seconds is talking to Railway.

## Public content API (2026-09-16, `8dbfec6`)
`src/app/api/{tours,tours/[slug],group-tours,destinations,brochures/[slug]}` —
read-only JSON over the ports, no direct Prisma. All `force-dynamic` so they are
not evaluated across `next build`'s 11 workers. The composition root now builds
`contentAdapter` and `brochureAdapter` from ONE adapter instance (a second
`getPrismaClient()` call site would open a second pool outside dev, where the
`globalThis` cache is deliberately skipped). `brochureAdapter` is `null` with no
DB → the route answers 503, never 404.

## VERIFIED LIVE 2026-09-16 (commits `ee66329`, `26b6c4b`)
The "never tested against a real database" state is **over**. `migrate deploy`
and `db seed` ran against the deployed Railway Postgres, and `npm run build`
generated the catalogue from real rows. Prisma's engines download fine now
(`binaries.prisma.sh` reachable; `--ignore-scripts` no longer needed, both
`query_engine` and `schema-engine` present) — no raw-`pg` fallback was required.

Live counts: destinations **19** (5 international), tours **22** (3
`pricingUnverified`), rails 4, railTours 20, group departures 4, brochures 22
(all `PENDING_UPLOAD`, `pdfUrl` NULL). Note **19, not 16** destinations — 16
appears in no repo artifact; the count is derived by `buildDestinations()`.
Build emits **19** tour pages; the 3 flagged slugs 404, verified against real rows.

**Two bugs only a remote database could expose** (both fixed):
- `P2028` — `$transaction` defaults (2s/5s) assume localhost; the seed's 12+
  sequential statements overrun them over a proxy. Now an explicit budget.
- `P1001` — Prisma pools `num_cpus*2+1` PER CLIENT and `next build` runs 11
  worker processes, so it asked for ~275 connections at once. Now capped.

**UNRESOLVED — intermittent `P1001`.** Even after the cap, the proxy connection
drops sporadically: one build aborted with `PrismaClientInitializationError` and
a later E2E run logged `P1001` for `getPackageRails` at request time. Both
recovered on retry and every assertion passed, so it is a RELIABILITY risk, not
a correctness one. Root cause not established — do not assume the cap fixed it.

**Why:** this is the largest architecture decision on the branch and it
contradicts a written rule; a future reader must find the reasoning, not just the
schema.
**How to apply:** before touching `prisma/`, read BLOCKERS.md §5. Never add a lead
table or an admin route here. Keep the seed importing fixtures, never restating
them.
