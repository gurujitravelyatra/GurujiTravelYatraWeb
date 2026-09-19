---
name: GTY admin auth — Phase A decisions
description: The admin CMS auth stack (NextAuth v5 beta, bcryptjs, JWT sessions, src/proxy.ts) and the Next 16 conventions that cost the most time to get right. Read before touching /admin, auth, or proxy.
type: project
---

Shipped 2026-09-17 on `feat/gty-site-setup`, Phase A of the admin CMS that
[[project_gty_admin_reversal]] made in-scope. Auth and security shell only —
tour CRUD and uploads are later phases.

## The stack, and why

- **NextAuth.js v5 / Auth.js, pinned `5.0.0-beta.32`** (no caret). v5 is the
  only major with a native App Router API; v4 is a `getServerSession` shim.
  Its peers declare `next: ^16`. **It is still a beta** — pinned exactly, and
  only its stable core is used (Credentials, JWT, `auth()`).
- **bcryptjs, cost 12.** Pure JS on purpose: `bcrypt`/`@node-rs/bcrypt` are
  native modules, and this environment cannot compile or download binaries
  (see [[project_gty_pipeline_environment]]). Hash format is `$2b$`, so
  swapping to a native binding later needs no password reset.
- **JWT sessions, 7-day sliding idle expiry**, `updateAge` 1 day. No sessions
  table. **The accepted cost: no server-side revocation** — deleting a user or
  changing a password does not kill a live cookie until it expires. 7 days is
  the deliberate ceiling on that exposure. Mitigation if it ever matters is a
  `sessionVersion` column checked in the `jwt` callback, not a rewrite.
- **Rate limiting is in-memory and single-process.** Two buckets with very
  different budgets: **email 5**, **IP 30**. They answer different questions —
  an IP is an office NAT, not a person. Becomes decorative the day a second
  replica exists; that is the trigger to move it to Postgres/Redis.
- **Accounts are created ONLY by `npm run db:seed:admin`** (env-driven, upsert,
  re-run rotates the password). No signup, no password reset, by design.

## Next.js 16 conventions that cost real time here

1. **`middleware.ts` is deprecated → `proxy.ts`**, and it must live at
   **`src/proxy.ts`** because this app's router is `src/app`. A repo-root
   `proxy.ts` is silently ignored — no warning, build still succeeds, every
   admin route serves unguarded.
2. **Verify the proxy compiled** via the `ƒ Proxy (Middleware)` line in the
   build summary and `/_middleware` in
   `.next/server/functions-config-manifest.json`.
   `.next/server/middleware-manifest.json` is emitted EMPTY in 16 and is a
   convincing false negative.
3. **Export it as a named `proxy` function.** Next resolves
   `mod.proxy || mod.default`; `export default auth(...)` did not survive that
   lookup and 500'd at runtime while building fine.
4. **`next build` runs with `NODE_ENV=production`** and evaluates every page
   module. Anything that throws on missing config breaks the BUILD. Guard at
   request time instead (`assertAuthSecretConfigured`).
5. **`auth(wrapper)` returns a Promise under a FUNCTION config**, and a plain
   handler under an OBJECT config. Use the object form for the proxy.
6. **Jest:** `next/jest` overwrites `transformIgnorePatterns`; it must be
   re-applied by awaiting the generated config. `next-auth`/`@auth/core` are
   ESM-only. `server-only` must be mapped to its own `empty.js`.
7. **A `'use server'` file may ONLY export async functions.** Exporting a
   constant beside the actions (`export const EMPTY_FORM_STATE = {...}`)
   compiles, passes `tsc`, and then fails the BUILD during "Collecting page
   data" with `A "use server" file can only export async functions, found
   object.` `type`/`interface` exports are fine — they are erased. Put shared
   state shapes in a sibling module and import the type back (Phase B:
   `src/app/admin/tours/form-state.ts`). Same family as the others here: the
   build is the first thing that enforces it, so green typecheck and green
   tests say nothing.

## Landmines for later phases

- `AUTH_SECRET` is REQUIRED in production and the app refuses to serve `/admin`
  without it. `playwright.config.ts` supplies a throwaway one for E2E.
- Every `/admin` page, server action and route handler must call
  `requireAdminSession()` itself. The layout deliberately does NOT gate —
  layouts do not re-run on client navigation and do not stop children
  rendering. `src/proxy.ts` is an optimistic pre-filter, not the gate.
- `src/server/db/prisma.ts` is now the ONLY place that constructs a
  `PrismaClient` (outside the standalone seed scripts). A second client is a
  second connection pool, which is the documented `P1001` build failure.

## Phase D (2026-09-19) — what actually stops CSRF here

**Do not record this as "Next's origin check stops CSRF".** Measured live
against the standalone production server, with a real session and one header
varied at a time:

| Request | Result |
|---|---|
| `Origin: https://evil.example.com` | 500 — aborted before the action decoded |
| `Origin: null` | 500 — aborted |
| `Origin:` *(own)* | 303 — ran, correctly |
| **no `Origin` header** | **303 — RAN.** Next warns and proceeds |
| `Origin: evil` + **`X-Forwarded-Host: evil.example.com`** | **303 — RAN.** Defeated |

Two real holes, **neither browser-reachable**: a cross-origin form POST cannot
set headers and always sends `Origin`, and a cross-origin `fetch()` carrying
`X-Forwarded-Host` triggers a preflight this app never approves. The defence
that does not depend on any of that is **`SameSite=Lax; HttpOnly` on the session
cookie + `requireAdminSession()` in every action**; the origin check is defence
in depth. `e2e/admin-csrf.spec.ts` asserts today's behaviour including the gaps,
so a Next upgrade that closes one fails loudly instead of leaving a stale note.

Other Phase D outcomes: admin-authored tour copy is plain text (refused at the
form, stripped at the write — `sanitize-tour-text.ts`); `dangerouslySetInnerHTML`
appears nowhere in `src/` and a source scan keeps it that way; the secret-leak
E2E check now plants sentinels into the server's env, proves by handshake that
the server holds them, and scans HTML + RSC payload + the **JS chunks** (where a
Next secret actually leaks, inlined at build time). Full record: BLOCKERS.md
item 13.

**Two traps found while writing those tests, both of which look green:**
1. A leak check that read `process.env` in the Playwright RUNNER asserted over
   zero values — the runner loads no `.env`. See
   [[feedback_qg_vacuous-guard-test]].
2. **Playwright's `request` fixture keeps a cookie jar, and Auth.js re-issues
   the sliding session cookie on every authenticated request.** So one
   authenticated call makes every later call in that test authenticated too —
   `/admin/login` then 307s to `/admin` and you scan the dashboard while the
   test name says login page. Use a fresh context per anonymous request and
   assert `maxRedirects: 0` + status 200.

**Why:** this is a new subsystem with several non-obvious constraints, most of
which produced a green build and a broken app before being found.
**How to apply:** read this before touching `/admin`, `src/server/auth/*`,
`src/proxy.ts`, or adding any admin route.
