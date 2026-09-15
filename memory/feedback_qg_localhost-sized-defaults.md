---
name: QG pattern — library defaults sized for localhost
description: "Recurring finding: Prisma/client defaults assume a loopback database and a single process, and fail only against a real remote one. Inject when an agent writes DB access or a seed."
type: feedback
---

Pattern: code is written against a mocked client or a localhost database, so
defaults tuned for a loopback socket and ONE client per process go unnoticed.
They fail the first time real network latency and real process parallelism exist.
Occurrences: 2 (first live database run; first live-DB E2E run)
Last seen: 2026-09-16
Affected agents: backend, pipeline-executor (live verification)
Pipeline: GTY content-database verification

Examples:
- `prisma/seed.ts`: `$transaction()` defaults (`maxWait` 2s, `timeout` 5s) are a
  localhost budget. 12+ sequential statements over a proxy overran them and the
  next call failed `P2028 "Transaction not found"` — which reads like a dropped
  connection but is purely a timeout.
- `src/content/content-adapter.ts`: Prisma pools `num_cpus*2+1` PER CLIENT,
  assuming one client per process. `next build` static-generates across 11 worker
  processes, each building its own client → ~275 connection attempts at once →
  `P1001`. The server was nowhere near its limit (500 max, 9 in use); the BURST
  through the managed proxy was the problem.

- **Test TIMEOUTS are a localhost budget too (2026-09-16).** `e2e/home.spec.ts`
  "Trip Finder CTA deep-links" fails on `toHaveURL`, whose default timeout is 5s.
  Nothing is broken: the `href` assertion one line above passes. `/tour-packages`
  reads `searchParams`, so it is server-rendered per request, and against the
  remote Railway Postgres it takes **6.9s cold / ~1.3-1.5s warm** (static Home:
  0.03s). The assertion was authored when that route was fixture-backed and
  instant. **Pre-existing — reproduced on a clean `3f87ed0` with the API work
  stashed, so it is not caused by the routes added in `8dbfec6`.** Same family as
  the two below: a default sized for a loopback that only fails over a proxy.

**Why:** neither defect is reachable by a unit test with a mocked client, and
neither reproduces on localhost. Passing tests said nothing about either.

**Third form — a hermeticity guard defeated by a library side effect
(2026-09-16).** `jest.setup.ts` deletes `DATABASE_URL` to force the fixture path,
but importing `@prisma/client` RE-LOADS `.env` and restores it, after setup has
run. Invisible in jsdom (Prisma resolves to its browser build); real in
`@jest-environment node` tests. The first API-route tests therefore ran against
the live remote database for ~18s, with assertions depending on rows in a shared
DB. Generalisation: an env-var delete is not isolation — verify the guard holds
*at the point of use*, and treat a unit test that suddenly takes seconds as
evidence it found a network.
**How to apply:** when dispatching an agent to write database access or a seed,
include: "Do not accept driver defaults for pool size or transaction timeout.
State the deployment topology — remote? how many processes? — and size them for
it. A green mocked test is not evidence the connection layer works."
