import NextAuth, { type NextAuthRequest } from 'next-auth';
import {
  NextResponse,
  type NextFetchEvent,
  type NextMiddleware,
  type NextRequest,
} from 'next/server';

import { authBaseConfig } from '@/server/auth/auth-base-config';
import { decideAdminRoute } from '@/server/auth/admin-route-policy';

/**
 * Route protection for `/admin/*`.
 *
 * ## Why this file is at `src/proxy.ts`
 *
 * The convention requires it "in the project root, or inside `src` if
 * applicable, so that it is located at the same level as `pages` or `app`". This
 * app's router is `src/app`, so `src/` IS the level that matters and a
 * repo-root `proxy.ts` is silently ignored — no warning, no error, the file
 * simply never runs and every `/admin` route serves unguarded.
 *
 * That is exactly what happened on the first build here, and a passing build
 * proves nothing on its own — the gate was simply absent. Two things to check
 * after touching this file:
 *
 * 1. `next build`'s route summary ends with a `ƒ Proxy (Middleware)` line. No
 *    line, no proxy.
 * 2. `.next/server/functions-config-manifest.json` contains a `/_middleware`
 *    entry whose `matchers` are the ones exported below.
 *
 * Note that `.next/server/middleware-manifest.json` is NOT the file to look at —
 * in Next 16 it is emitted empty (`"middleware": {}`) even when the proxy is
 * correctly built, which makes it a convincing false negative.
 *
 * ## Why this file is `proxy.ts` and not `middleware.ts`
 *
 * Next.js 16 DEPRECATED the `middleware.js` convention and renamed it to
 * `proxy.js` — see `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/middleware.md`,
 * which now contains nothing but a pointer to `proxy.md`, and `proxy.md`'s own
 * version table: "v16.0.0 — Middleware is deprecated and renamed to Proxy. Proxy
 * defaults to the Node.js runtime." Writing `middleware.ts` here would be
 * building on a deprecated convention on day one.
 *
 * The behaviour is identical, including `config.matcher`. The other half of that
 * changelog line matters too: Proxy runs on the **Node.js runtime** by default in
 * 16, so there is no Edge-runtime constraint on what auth code may be imported
 * here. (The `runtime` segment option is not available in Proxy files and
 * throws if set.)
 *
 * ## Why it still imports the LEAN config
 *
 * Node runtime means we *could* import the full `auth` from
 * `@/server/auth/auth`. We deliberately do not. This function runs on every
 * matched request including prefetches, and the full config pulls in `bcryptjs`,
 * `@prisma/client` and the `AdminUser` query — none of which can ever execute
 * here, because the proxy never handles a sign-in POST. The base config verifies
 * the session JWT and nothing else, which is exactly this file's job.
 *
 * ## This is the OPTIMISTIC check, not the only one
 *
 * Next's own auth guide is explicit that proxy checks "should not be your only
 * line of defense". The real gate is `requireAdminSession()`
 * (`src/server/auth/session.ts`), which every `/admin` page and server action
 * calls. This layer exists to turn "renders an empty dashboard then redirects"
 * into a clean redirect before any admin code runs, and to cover the case the
 * guide calls out specifically — a static route that would otherwise be served
 * from cache without running page code at all.
 *
 * It is a genuine cryptographic check, not a cookie-presence sniff: `auth()`
 * decrypts and verifies the JWT against `AUTH_SECRET`, so a forged or expired
 * cookie fails here. It just does not, and must not, hit the database.
 */
const { auth } = NextAuth(authBaseConfig);

/**
 * NextAuth's `auth()` wrapper, which resolves the session from the request's
 * cookies and hands it back as `request.auth` before our logic runs.
 *
 * The parameter annotations are load-bearing, not decoration. `auth()` is
 * overloaded: one overload takes a ROUTE HANDLER `(req, ctx)` and returns
 * `AppRouteHandlerFn`, the other takes a MIDDLEWARE `(req, event)` and returns
 * `NextMiddleware`. A bare `(request) => …` matches the route-handler overload
 * first, and the mismatch only surfaces later as the baffling "Property 'params'
 * is missing in type 'NextFetchEvent'".
 *
 * Spelling out both parameter types selects the middleware overload directly.
 * Annotating only the RESULT as `NextMiddleware` is not enough — overload
 * resolution happens on the argument, so it still picks the wrong one and then
 * fails to assign.
 */
const withSession: NextMiddleware = auth(
  // `_event` is unused by the body but must be DECLARED: its presence and type
  // are what select the middleware overload of `auth()` (see above). Removing it
  // to satisfy the linter reintroduces the "Property 'params' is missing in type
  // 'NextFetchEvent'" build error.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (request: NextAuthRequest, _event: NextFetchEvent) => {
    const { pathname, search } = request.nextUrl;

    /**
     * `request.auth` is the session NextAuth resolved from the request's
     * cookies, or `null`. Requiring `user` rather than truthiness of the session
     * object guards against a decoded-but-empty token being read as a login.
     */
    const isAuthenticated = Boolean(request.auth?.user);

    const decision = decideAdminRoute(pathname, search, isAuthenticated);

    if (decision.type === 'redirect') {
      return NextResponse.redirect(new URL(decision.to, request.nextUrl.origin));
    }

    return NextResponse.next();
  }
);

/**
 * Exported as a NAMED `proxy` function rather than `export default auth(...)`.
 *
 * Next's proxy template resolves the handler as `mod.proxy || mod.default`, and
 * a default export produced by calling a library function did not survive that
 * lookup here — the server booted and then 500'd every request with "The Proxy
 * file \"/src/proxy\" must export a function named `proxy` or a default
 * function." A plain named function declaration is read first and is
 * unambiguous under any module interop, so it is the form used.
 *
 * Worth noting the failure mode, since it is the dangerous one: this did not
 * fail the BUILD. It compiled, the route summary showed `ƒ Proxy (Middleware)`,
 * and it only broke when a request actually arrived. Which is also why the E2E
 * suite, not the build, is what proves this file works.
 */
export function proxy(request: NextRequest, event: NextFetchEvent) {
  return withSession(request, event);
}

export const config = {
  /**
   * Scoped to `/admin` rather than the "run on everything except static assets"
   * matcher Next's auth guide suggests.
   *
   * That advice is aimed at apps where most routes are protected. Here the
   * opposite is true: this is a public marketing site with one small admin area
   * bolted on, and every public page — Home, the catalogue, the tour detail
   * routes — is statically rendered and must stay that way. Running a
   * session-decrypting proxy across all of them would add work to every visitor's
   * request to protect nothing.
   *
   * The two `/admin` patterns are needed because Next's matcher does not treat
   * `/admin/:path*` as covering the bare `/admin`.
   *
   * `/api/auth/*` is deliberately NOT matched: those routes ARE the sign-in
   * mechanism, and gating them behind a session is the classic lockout bug.
   */
  matcher: ['/admin', '/admin/:path*'],
};
