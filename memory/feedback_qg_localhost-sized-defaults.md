---
name: QG pattern — library defaults sized for localhost
description: "Recurring finding: Prisma/client defaults assume a loopback database and a single process, and fail only against a real remote one. Inject when an agent writes DB access or a seed."
type: feedback
---

Pattern: code is written against a mocked client or a localhost database, so
defaults tuned for a loopback socket and ONE client per process go unnoticed.
They fail the first time real network latency and real process parallelism exist.
Occurrences: 1 (first live database run)
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

**Why:** neither defect is reachable by a unit test with a mocked client, and
neither reproduces on localhost. Passing tests said nothing about either.
**How to apply:** when dispatching an agent to write database access or a seed,
include: "Do not accept driver defaults for pool size or transaction timeout.
State the deployment topology — remote? how many processes? — and size them for
it. A green mocked test is not evidence the connection layer works."
