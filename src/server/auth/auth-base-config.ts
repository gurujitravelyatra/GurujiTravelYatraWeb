import type { NextAuthConfig } from 'next-auth';

/**
 * Everything about the session that does NOT need to know how a password is
 * checked: cookie/JWT policy, the custom pages, and the callbacks that shape the
 * token.
 *
 * ## Why this is split out from `auth.ts`
 *
 * `proxy.ts` runs on every single request to the app, including prefetches. It
 * needs to VERIFY a session JWT and nothing more. If it imported the full config
 * it would drag `bcryptjs`, `@prisma/client` and the `AdminUser` lookup into the
 * proxy bundle — code whose only entry point (`authorize()`) can never be reached
 * from there, because the proxy never handles a sign-in POST.
 *
 * So the provider list is the seam. This file is the part both sides share;
 * `auth.ts` is this plus the one Credentials provider. Both produce tokens the
 * other can read, because JWT verification depends on `AUTH_SECRET` and the
 * callbacks below — not on the provider list.
 *
 * NOTE: this file must stay free of `import 'server-only'` and of any Node-only
 * import. It is deliberately the boundary-crossing piece.
 */

/**
 * ## Session lifetime: 7-day idle expiry, refreshed at most daily
 *
 * `maxAge` is what NextAuth writes into the JWT's `exp` AND the cookie's
 * `Max-Age`, measured from the moment the token was last issued. Combined with
 * `updateAge` this is a SLIDING/IDLE window, not an absolute one: every time the
 * session is read more than `updateAge` after it was issued, NextAuth re-issues
 * it with a fresh 7 days. So the clock measures time since last USE, not time
 * since login.
 *
 * Why 7 days:
 * - This is a content-management tool for a handful of staff who will use it in
 *   bursts — publish a few tours, leave it a week. An 8-hour or 24-hour session
 *   would mean re-entering a password nearly every visit, and the well-documented
 *   consequence of that is a weaker password written on something, not better
 *   security.
 * - It is still short enough that an abandoned or stolen laptop stops being a
 *   valid session inside a week without anyone having to do anything.
 * - It bounds the cost of the thing this design genuinely cannot do: with
 *   stateless JWTs there is NO server-side revocation (see `auth.ts`), so
 *   `maxAge` is also the worst-case answer to "how long until a compromised
 *   session dies on its own". Seven days is a deliberate ceiling on that, and it
 *   is the number to lower if the CMS ever holds anything more sensitive than
 *   tour copy.
 *
 * Why `updateAge` is a day rather than 0: re-issuing on every request means a
 * `Set-Cookie` on every request, which is wasted bytes and makes the cookie's
 * value churn constantly. Once a day keeps the sliding behaviour with none of
 * that.
 */
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days
export const SESSION_UPDATE_AGE_SECONDS = 24 * 60 * 60; // 1 day

/** The one and only sign-in surface. Referenced by `proxy.ts` too — keep it here. */
export const ADMIN_LOGIN_PATH = '/admin/login';

/** Post-login landing page, and the fallback when `next=` is missing or unsafe. */
export const ADMIN_HOME_PATH = '/admin';

/**
 * `AUTH_SECRET` signs and encrypts every session token. There is no sensible
 * default: a generated-per-boot secret would invalidate every session on
 * restart, and a hardcoded one would mean anyone with the source can mint an
 * admin session for a production deployment.
 *
 * ## This resolution does NOT throw, and the guard is separate
 *
 * The obvious implementation — throw here when `NODE_ENV === 'production'` and
 * the variable is missing — was written first and broke `next build`. `next
 * build` sets `NODE_ENV=production` and then EVALUATES every page module to
 * collect its route config, so the throw fired during the build of any checkout
 * that had not set `AUTH_SECRET` (including CI), surfacing as the unhelpful
 * "Failed to collect page data for /admin/login".
 *
 * That was the right check at the wrong moment. Building an app and running one
 * are different things: a build produces an artefact and signs nothing, so it has
 * no business demanding a signing key.
 *
 * The second attempt made the whole config a per-request function, which
 * NextAuth does support — but `auth(wrapper)` under a function config returns a
 * PROMISE of a handler rather than a handler, so `proxy.ts` died at runtime with
 * "gn is not a function". Object config is the shape the library's own
 * middleware pattern is built around, so that is the shape used.
 *
 * So: resolve without throwing here, and enforce at request time via
 * {@link assertAuthSecretConfigured}, which every admin entry point calls.
 */
function resolveAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (secret && secret.length > 0) return secret;

  // Development, test, and — transiently — a misconfigured production build.
  // Fixed rather than random so a hot reload does not sign you out mid-edit. It
  // is checked into the repo, which is precisely why it must never be the value
  // a real deployment runs on, and why the assertion below exists.
  return 'gty-development-only-auth-secret-not-for-production';
}

/**
 * The production guard, at REQUEST time rather than build time.
 *
 * Called by every path that can issue or rely on an admin session — the login
 * action and the session DAL. A production deployment missing `AUTH_SECRET`
 * therefore fails loudly on the first request to `/admin`, instead of quietly
 * running on a signing key that is published in this repository.
 *
 * Note what this does and does not promise. Between module load and this check,
 * the config does hold the development fallback; the guarantee is that no admin
 * request completes without passing here first, not that the fallback never
 * exists in memory. Making that stronger would mean the build-time throw that
 * this design exists to avoid.
 */
export function assertAuthSecretConfigured(): void {
  if (process.env.NODE_ENV !== 'production') return;
  if (process.env.AUTH_SECRET && process.env.AUTH_SECRET.length > 0) return;

  throw new Error(
    'AUTH_SECRET is not set. The admin area cannot issue sessions without it. ' +
      'Generate one with `openssl rand -base64 32` and set it in the environment.'
  );
}

/**
 * A plain object, not a factory.
 *
 * NextAuth v5 accepts a per-request function too, and that was tried here — but
 * under a function config `auth(wrapper)` resolves to a Promise rather than a
 * middleware handler, which breaks `proxy.ts`. See {@link resolveAuthSecret}.
 */
export const authBaseConfig: NextAuthConfig = {
  /**
   * EMPTY ON PURPOSE — this is the seam described at the top of the file.
   *
   * `auth.ts` spreads this config and supplies the real Credentials provider;
   * `proxy.ts` uses it as-is, with none. A provider-free instance cannot sign
   * anyone in, which is precisely what is wanted in the proxy: it only ever needs
   * to VERIFY an existing session token, and verification depends on `secret` and
   * the callbacks below, not on the provider list.
   *
   * The type requires the key to be present, so it is declared here rather than
   * left to the spread — which also means TypeScript will flag it if someone later
   * adds a provider to this file instead of to `auth.ts`.
   */
  providers: [],

  secret: resolveAuthSecret(),

  /**
   * This app is deployed behind Railway's proxy on a domain NextAuth cannot infer
   * from a Vercel environment variable. Without `trustHost`, v5 refuses to
   * construct callback URLs from the forwarded Host header and every sign-in
   * fails in production while working perfectly on localhost.
   */
  trustHost: true,

  session: {
    /**
     * JWT rather than a database session table.
     *
     * The trade is explicit. WHAT WE GIVE UP: server-side revocation. Deleting an
     * `AdminUser` row, or changing its password, does NOT invalidate a session
     * that is already issued — that cookie keeps working until `maxAge` runs out.
     * With two or three staff and a 7-day ceiling that is a tolerable, bounded
     * exposure, and the mitigation if it ever stops being tolerable is a
     * `sessionVersion` column checked in the `jwt` callback, not a rewrite.
     *
     * WHAT WE GET: no `Session`/`Account`/`VerificationToken` tables to create in
     * a database whose stated purpose is CONTENT ONLY, and no database round-trip
     * on every page render of the admin area.
     */
    strategy: 'jwt',
    maxAge: SESSION_MAX_AGE_SECONDS,
    updateAge: SESSION_UPDATE_AGE_SECONDS,
  },

  pages: {
    signIn: ADMIN_LOGIN_PATH,
    /**
     * Errors render on the login page itself rather than NextAuth's own
     * `/api/auth/error` screen, which is unstyled and says things like
     * "Configuration" to a person who just mistyped a password.
     */
    error: ADMIN_LOGIN_PATH,
  },

  callbacks: {
    /**
     * Copies the user's id onto the token at sign-in. Runs with a `user` argument
     * only on the first call (the sign-in itself); subsequent calls get the
     * existing token back and must pass it through untouched.
     */
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.email = user.email;
      }
      return token;
    },

    /**
     * Shapes what server components see from `auth()`.
     *
     * Only `id` and `email` — there is nothing else an `AdminUser` has that a page
     * needs, and `passwordHash` must never be within reach of this object. The
     * narrow shape is enforced by `findAdminUserForLogin()` never selecting more
     * than three columns in the first place.
     */
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? '';
        session.user.email = token.email ?? session.user.email;
      }
      return session;
    },
  },
};
