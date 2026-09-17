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
  `prisma validate` and `prisma generate` still work (WASM), but anything needing
  the schema/query engine (`migrate dev`, `db seed`, any real query) cannot run.
  `migrate diff --from-empty --script` DOES work and is how the initial migration
  SQL was produced.
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

## E2E is load-sensitive against the remote database
`/tour-packages` is a dynamic route backed by the Railway Postgres when
`DATABASE_URL` is set. In a full 2-worker Playwright run, its two navigation
assertions in `home.spec.ts` ("navigates to Tour Packages from the navbar",
"the Trip Finder CTA deep-links…") intermittently blow the 5s expect timeout —
they pass on a targeted re-run and on a stashed clean tree. Confirm a
`/tour-packages` failure in isolation before treating it as a regression;
this has now been observed across three separate runs.

## Lint scope
`eslint.config.mjs` must keep ignoring `Documents/**` (vendored Claude
Design export) and `.claude/**` (agent tooling + ~6 checked-in worktrees
from an unrelated project). Without those ignores `npx eslint` reports
~13.6k findings, none of them from `src/`.
