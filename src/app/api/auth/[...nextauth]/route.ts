import { handlers } from '@/server/auth/auth';

/**
 * NextAuth's own endpoints: `/api/auth/session`, `/api/auth/csrf`,
 * `/api/auth/callback/credentials`, `/api/auth/signout`, …
 *
 * Re-exporting `handlers` is the whole file — everything these routes do is
 * `@auth/core`'s, including the double-submit **CSRF token** that every POST to
 * `/api/auth/*` must carry. That protection arriving for free is exactly why
 * `src/server/auth/__tests__/csrf.test.ts` asserts it against this handler
 * rather than trusting it: "secure by default" is a property that can quietly
 * stop being true across a version bump, and this is a beta dependency.
 *
 * ## Not indexable
 *
 * `src/app/robots.ts` disallows `/api`, so these paths stay out of search
 * results along with the rest of the API surface.
 */
export const { GET, POST } = handlers;

/**
 * Sign-in must never be served from a cache — a cached `/api/auth/session`
 * response would hand one user's session state to the next visitor. Next does not
 * cache route handlers with dynamic behaviour by default, but this one is worth
 * being explicit about rather than relying on a default staying put.
 */
export const dynamic = 'force-dynamic';
