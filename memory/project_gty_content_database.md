---
name: GTY site — interim content database (CLAUDE.md line 56 overridden)
description: Why this repo has a Postgres content DB despite CLAUDE.md forbidding one, what the override does and does not cover, and what has never been tested.
type: project
---

Branch `feat/gty-site-setup`, commits `f0f1bbb`..`df5257b` (2026-09-14).

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

## NEVER TESTED AGAINST A REAL DATABASE
Docker is still not installed. The migration has **never been applied**, the seed
has **never inserted a row**, and no SQL has executed. Verified only:
`prisma validate`, `prisma generate`, `migrate diff` (SQL generated, not run),
and adapter unit tests against a **mocked** client. Treat first real run as
untested code. Also: `binaries.prisma.sh` is unreachable here (ECONNRESET), so
`prisma` installs only with `--ignore-scripts`; `validate`/`generate` work anyway
(WASM), `migrate dev`/`db seed` would need the engines.

**Why:** this is the largest architecture decision on the branch and it
contradicts a written rule; a future reader must find the reasoning, not just the
schema.
**How to apply:** before touching `prisma/`, read BLOCKERS.md §5. Never add a lead
table or an admin route here. Keep the seed importing fixtures, never restating
them.
