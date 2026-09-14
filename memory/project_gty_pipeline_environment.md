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

## Lint scope
`eslint.config.mjs` must keep ignoring `Documents/**` (vendored Claude
Design export) and `.claude/**` (agent tooling + ~6 checked-in worktrees
from an unrelated project). Without those ignores `npx eslint` reports
~13.6k findings, none of them from `src/`.
