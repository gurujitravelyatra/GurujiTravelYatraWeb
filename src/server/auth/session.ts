import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';

import { auth } from './auth';
import { ADMIN_LOGIN_PATH, assertAuthSecretConfigured } from './auth-base-config';

/**
 * The Data Access Layer for admin identity — the REAL authorization gate.
 *
 * `proxy.ts` is an optimistic pre-filter; this is the check that must be correct.
 * Next's own auth guide makes the distinction and the reason: a proxy cannot see
 * server actions invoked directly, and a layout's check does not stop nested
 * route segments from rendering (layouts do not re-run on client-side
 * navigation). So the rule for Phase B onward is simple and has no exceptions:
 *
 *   **Every `/admin` page, every server action, and every admin route handler
 *   calls `requireAdminSession()` before it does anything else.**
 *
 * Not "the layout calls it once". The guide is explicit that the `return null` in
 * a layout pattern is not sufficient, because a Next app has multiple entry
 * points into the same segment.
 */

export interface AdminSession {
  userId: string;
  email: string;
}

/**
 * Wrapped in React's `cache()` so several components in one render pass share a
 * single resolution instead of each decrypting the token again. The cache is
 * per-request by construction — React discards it between requests — so there is
 * no cross-user leak available here.
 */
export const getAdminSession = cache(async (): Promise<AdminSession | null> => {
  /**
   * Throws in production when `AUTH_SECRET` is missing. Deliberately a hard
   * failure rather than "no session": a misconfigured deployment must not be
   * able to serve the admin area on the development signing key that is checked
   * into this repository. See `auth-base-config.ts` for why the check lives
   * here and not at module load.
   */
  assertAuthSecretConfigured();

  const session = await auth();
  const userId = session?.user?.id;
  const email = session?.user?.email;

  // Both must be present. A token that decodes but carries no subject is not a
  // session, and treating it as one would mean an authenticated request with
  // nobody attached to it.
  if (!userId || !email) return null;

  return { userId, email };
});

/**
 * Returns the session or REDIRECTS. Never returns null.
 *
 * The signature is the safety property: because there is no falsy branch to
 * forget, a caller cannot accidentally proceed unauthenticated by ignoring the
 * return value. `redirect()` throws internally, so nothing after this line runs.
 */
export async function requireAdminSession(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (session === null) redirect(ADMIN_LOGIN_PATH);
  return session;
}
