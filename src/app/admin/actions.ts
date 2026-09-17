'use server';

import { redirect } from 'next/navigation';

import { signOut } from '@/server/auth/auth';
import { ADMIN_LOGIN_PATH } from '@/server/auth/auth-base-config';

/**
 * Sign out: clear the session cookie, then land on the login page.
 *
 * `redirect: false` + an explicit `redirect()` rather than letting NextAuth do
 * it, so the destination is this app's constant and not NextAuth's default
 * `/api/auth/signout` flow (which renders its own unstyled confirmation page).
 *
 * ## What logging out does and does not do
 *
 * It deletes the cookie from THIS browser. It does not and cannot invalidate the
 * underlying JWT — that is the stateless-session trade documented in
 * `auth-base-config.ts`. A copy of the token taken before sign-out stays valid
 * until it expires. For a staff CMS with a 7-day ceiling that is the accepted
 * cost; it is written down here because "log out" implies more than it delivers
 * and the gap should not be a surprise to whoever reads this next.
 *
 * No auth check guards this action on purpose: signing out when you are already
 * signed out is a no-op, not an error, and requiring a session to end a session
 * is how people get stuck with a cookie they cannot clear.
 */
export async function logoutAction(): Promise<never> {
  await signOut({ redirect: false });
  redirect(ADMIN_LOGIN_PATH);
}
