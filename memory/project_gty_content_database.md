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
SUPPORTED mode — it is how `npm test`, `npm run build` and Playwright run.
`jest.setup.ts` deletes the variable so the suite is hermetic (`next/jest` loads
`.env`). Production logs a loud warning when falling back.

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
