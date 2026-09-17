---
name: GTY website — pipeline environment constraints
description: This repo has no git remote and no gh CLI, so CREATE-PR cannot run. The configured QG skills are claude-flow-specific and do not apply here.
type: project
---

Repo: GTY public website (`GTY Website(1)`), branch `feat/gty-site-setup`.

## CREATE-PR cannot run in this project
- `git remote -v` is empty — there is no origin.
- `gh` is not on PATH.

Any pipeline ending in CREATE-PR will reach that step and be unable to
complete it. Do not fabricate a PR URL. Commit locally, then report that
the remote is unconfigured and ask the user where to push.

## The configured Quality Gate skills do not fit this repo
`agent-manual.md` defines QG as
`github-code-review -> verification-quality -> v3-security-overhaul`.

- `github-code-review` needs a GitHub PR — impossible (see above).
- `v3-security-overhaul` targets claude-flow v3 CVEs, not this Next.js site.
- `verification-quality` is claude-flow's truth-scoring system.

All three came from the claude-flow agent pack, not from this project.
The meaningful gate for this repo is: `npx tsc --noEmit`, `npx eslint`,
`npm run build` — all three were clean at commit `78208c5`.

**Why:** Two full pipeline runs have now reached the QG/PR phase; both
would stall on this without it being written down anywhere.
**How to apply:** When running a pipeline here, substitute the tsc/eslint/
build gate for QG, and treat CREATE-PR as "commit + ask where to push"
until a remote exists.

## npm and Prisma binaries are restricted here
- `binaries.prisma.sh` is unreachable (**ECONNRESET**), so `@prisma/engines`'
  postinstall always fails. Install Prisma with `--ignore-scripts`:
  `prisma validate` and `prisma generate` still work (WASM).
  `migrate diff --from-empty --script` DOES work and is how the initial migration
  SQL was produced.
- **[UPDATED 2026-09-18] The query engine IS present now** — `migrate dev`,
  `migrate status`, `db seed` and real queries all run against the live Railway
  Postgres. The clause that used to say they "cannot run" is stale; do not plan
  around it.
- **`prisma generate` ends in `EPERM … rename query_engine-windows.dll.node`**,
  and that is usually HARMLESS. The TypeScript client (`index.d.ts`, `index.js`)
  is written FIRST and is up to date; the engine binary is byte-identical between
  generates of the same Prisma version, so the failed rename replaces a file with
  itself. Check `index.d.ts`'s mtime and grep it for the new model before chasing
  the error. It leaves ~19MB `.tmp*` copies behind — delete them. A running
  standalone server holds the DLL open, which is one way to cause it.
- `npm install prisma@latest` fails with `Cannot read properties of null (reading
  'edgesOut')` — an arborist bug on this tree. Pinned `prisma@^5.22.0` installs.
- **Never run two `npm install`s concurrently here** — they clobber each other's
  `node_modules`. One did, and `--legacy-peer-deps` then dropped
  `@testing-library/dom` (a peer of `@testing-library/react` v16), which surfaced
  as ~10 bogus "`@testing-library/react` has no exported member 'screen'" tsc
  errors. Plain `npm install` restores it.

## `npm run build` (Turbopack) cannot run on this machine — use `--webpack`

`next build` defaults to Turbopack (Next 16), which panics here before it
compiles anything:

```
FATAL: failed to create junction point at ".next\node_modules\@prisma\client-<hash>"
  -> creation of a new symbolic link or junction point failed: Access is denied. (os error 5)
```

Windows requires `SeCreateSymbolicLinkPrivilege` (Developer Mode or an elevated
shell) to create junctions, and this account has neither. It is unrelated to any
source change — **verified by reproducing it on a clean stashed tree** — and it
fails identically after `rm -rf .next`.

`npx next build --webpack` builds the same app successfully, including the
standalone output. Use it for the build gate.

**Knock-on for E2E:** `playwright.config.ts`'s `webServer.command` is
`npm run build && npm start`, so it inherits the Turbopack failure. Workaround
that works: `npx next build --webpack`, then start the server yourself
(`PORT=3100 HOSTNAME=127.0.0.1 node scripts/start-standalone.mjs`) and run
`npx playwright test` — `reuseExistingServer` is true outside CI, so Playwright
attaches to it instead of rebuilding. Kill that server before the next build:
it holds `.next/standalone` open and `rm -rf .next` fails with
"Device or resource busy".

**Why:** the build gate and the whole E2E suite are unreachable via the
documented commands on this machine; two runs could easily conclude "the build
is broken" and start bisecting source.
**How to apply:** substitute `npx next build --webpack` for `npm run build`, and
pre-start the standalone server before `npx playwright test`.

## The Railway TCP proxy drops connections — budget for retries
**Measured 2026-09-18:** a jest test whose only statement is `prisma.tour.count()`
failed **3 runs out of 4** with `PrismaClientInitializationError: Can't reach
database server`, then succeeded unchanged. The server is fine (`max_connections`
500); it is the managed TCP proxy refusing connection ATTEMPTS — the same `P1001`
the pool cap in `src/server/db/prisma.ts` was written for.

Consequences to expect, none of which are a code defect:
- **`next build` fails roughly one run in two**, during `generateStaticParams`
  for `/tour-packages/[slug]`. Retry it in a loop; it succeeds within 2-3 tries.
- **The first request to a freshly-started server can 500** before the connection
  warms up, then every subsequent request is fine. Warm it with one `curl` before
  running anything that measures.
- Any DB-touching suite needs a connection retry in `beforeAll` — see
  `tour-repository.integration.test.ts`'s `connectWithRetry`.

## E2E is load-sensitive against the remote database
`/tour-packages` is a dynamic route backed by the Railway Postgres when
`DATABASE_URL` is set. In a full 2-worker Playwright run, navigation assertions
that land on it — `home.spec.ts`'s "navigates to Tour Packages from the navbar"
and "the Trip Finder CTA deep-links…", `tour-packages.spec.ts`'s "the detail
breadcrumb navigates back" — intermittently blow the 5s expect default. **Exactly
one fails per run and WHICH one moves between runs.**

**Settled 2026-09-18, with the decisive measurement:** the same suite run against
the FIXTURE path is **114 passed / 0 failed**, and those tests take 1.1-2.0s
there versus 3.9-7.2s against the database. It is remote-query latency against a
5s timeout, nothing else — the server log shows no query errors during the failing
runs. Force the fixture path with an EMPTY value (`DATABASE_URL= npx next build
--webpack`, same for the server): `-u DATABASE_URL` does NOT work, because Next
re-loads `.env`, whereas an empty string is already "set" so dotenv leaves it, and
the composition root treats it as falsy.

Confirm any `/tour-packages` failure in isolation, or on the fixture path, before
treating it as a regression. Observed across five separate runs now.

## Lint scope
`eslint.config.mjs` must keep ignoring `Documents/**` (vendored Claude
Design export) and `.claude/**` (agent tooling + ~6 checked-in worktrees
from an unrelated project). Without those ignores `npx eslint` reports
~13.6k findings, none of them from `src/`.
