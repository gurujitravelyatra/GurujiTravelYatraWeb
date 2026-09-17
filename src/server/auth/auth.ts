import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

import { authBaseConfig } from './auth-base-config';
import { recordAdminLogin } from './admin-user';
import { authorizeAdminCredentials } from './authorize';

/**
 * The full auth instance — `authBaseConfig` plus the one provider that can
 * actually check a password.
 *
 * ## Library choice: NextAuth.js v5 (Auth.js), `5.0.0-beta.32`, pinned exactly
 *
 * v5 is the only major version with a native App Router API — the `auth()` helper
 * that works in server components, route handlers and `proxy.ts` alike, and
 * `signIn`/`signOut` as server actions. v4's App Router story is a compatibility
 * shim around `getServerSession`; building Phase A on it would mean writing the
 * migration to v5 into the plan on day one. Its peer range
 * (`next: ^14 || ^15 || ^16`) covers this app's Next 16.3.4 explicitly, and React
 * 19 likewise.
 *
 * **It is still a beta, and that is a real cost, not a footnote.** v5 has been in
 * beta for a long time and its releases have made breaking changes. The
 * mitigations are: the version is PINNED to an exact release (no `^`) so an
 * install cannot drift into a different beta; everything this app depends on is
 * the stable core of the API (Credentials, JWT sessions, `auth()`), not the parts
 * that churn (adapters, WebAuthn, OAuth edge cases); and the surface is small
 * enough — one provider, two callbacks — that the whole integration is a few
 * dozen lines to revisit.
 *
 * ## CSRF
 *
 * Not implemented here, and deliberately not re-implemented: `@auth/core` puts a
 * double-submit CSRF token on every POST to `/api/auth/*`, and the route handler
 * in `src/app/api/auth/[...nextauth]/route.ts` is what wires it up. Because it
 * arrives by default, it is the kind of protection that can silently stop being
 * true after an upgrade or a config change — so it is asserted directly against
 * the real handler in `src/server/auth/__tests__/csrf.test.ts`, which POSTs to
 * the credentials callback with no token and requires a rejection.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authBaseConfig,
  providers: [
    Credentials({
      /**
       * Describes the fields, not the validation. It exists so NextAuth knows the
       * shape; the real parsing is the zod schema in `authorize.ts`, which is
       * what a malformed POST straight at `/api/auth/callback/credentials`
       * (bypassing our form entirely) has to get past.
       */
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },

      /**
       * The whole decision lives in `authorize.ts` — see that file for why every
       * failure mode returns an identical `null`, and for the anti-enumeration
       * reasoning behind it.
       *
       * It is a separate module purely so it can be unit-tested: NextAuth v5 does
       * not expose the constructed provider list, so a callback defined inline
       * here would be unreachable from a test. Passed by reference, so the
       * function under test is the function that runs in production.
       */
      authorize: authorizeAdminCredentials,
    }),
  ],

  events: {
    /**
     * Fires only after a sign-in has fully succeeded, which is why `lastLoginAt`
     * is written here rather than in `authorize()`. Events cannot fail a sign-in,
     * so a database hiccup on this write costs a timestamp and not a session.
     */
    async signIn({ user }) {
      if (user.id) await recordAdminLogin(user.id);
    },
  },
});
