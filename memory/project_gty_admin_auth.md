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

**Why:** this is a new subsystem with several non-obvious constraints, most of
which produced a green build and a broken app before being found.
**How to apply:** read this before touching `/admin`, `src/server/auth/*`,
`src/proxy.ts`, or adding any admin route.
