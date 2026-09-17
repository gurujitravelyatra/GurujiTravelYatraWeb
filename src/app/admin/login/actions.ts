'use server';

import { AuthError } from 'next-auth';
import { headers } from 'next/headers';
import { redirect, unstable_rethrow } from 'next/navigation';

import { signIn } from '@/server/auth/auth';
import { assertAuthSecretConfigured } from '@/server/auth/auth-base-config';
import { safeReturnPath } from '@/server/auth/admin-route-policy';
import {
  checkLoginAllowed,
  clearLoginAttempts,
  loginRateLimitKeys,
  recordLoginFailure,
} from '@/server/auth/rate-limit';

/**
 * The login server action. This is where rate limiting lives, because it is the
 * only layer that can see the client's IP — `authorize()` in the Credentials
 * provider is handed credentials and nothing else.
 *
 * ## Why a server action rather than posting to `/api/auth/callback/credentials`
 *
 * Both are CSRF-protected, by different mechanisms, and both are fine. The server
 * action wins on two practical points: Next verifies the Origin header and a
 * per-build action ID on every server action invocation, so there is no CSRF
 * token for the client to fetch and thread through a form; and returning a typed
 * error state to `useActionState` is how errors get rendered inline on the login
 * page instead of as a query-string round trip through NextAuth's error page.
 *
 * The HTTP endpoint still exists (NextAuth mounts it) and is still CSRF-checked
 * by `@auth/core` — `src/server/auth/__tests__/csrf.test.ts` proves it.
 */

export interface LoginFormState {
  /**
   * Visitor-safe message, or null on the first render.
   *
   * There is no success shape: a successful sign-in never returns, it redirects.
   */
  error: string | null;
}

/**
 * ONE message for every failure mode.
 *
 * Unknown email, wrong password, unconfigured database, malformed input — all
 * render this. Telling the user which of those happened would tell an attacker
 * which email addresses are real staff accounts. See the longer note in
 * `auth.ts`.
 */
const GENERIC_FAILURE = 'That email and password combination is not recognised.';

/**
 * `x-forwarded-for` is set by Railway's proxy; `x-real-ip` is the common
 * alternative. Falling back to a constant rather than skipping the limit is the
 * safer direction: if a deployment strips both headers, every request shares one
 * bucket and the limiter becomes global rather than becoming absent.
 *
 * Worth stating plainly: a header is spoofable, so an attacker who controls it
 * can rotate the IP key at will. The email key (see `loginRateLimitKeys`) is the
 * one that still binds in that case, which is exactly why there are two.
 */
async function resolveClientIp(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get('x-forwarded-for');
  if (forwarded) {
    // Left-most entry is the original client; the rest are proxies.
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return headerList.get('x-real-ip')?.trim() || 'unknown';
}

export async function loginAction(
  _previousState: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
  /**
   * Before anything else. Issuing a session signed with the repository's
   * development fallback would be worse than refusing to sign anyone in — the
   * resulting cookie would be forgeable by anyone who has read this code.
   */
  assertAuthSecretConfigured();

  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const redirectTo = safeReturnPath(String(formData.get('next') ?? ''));

  const ip = await resolveClientIp();
  const keys = loginRateLimitKeys(ip, email);

  /**
   * Checked BEFORE the database lookup and before bcrypt runs. A locked-out
   * attacker should cost us a map lookup, not a 300ms hash.
   */
  const verdict = checkLoginAllowed(keys);
  if (!verdict.allowed) {
    return {
      error: `Too many failed sign-in attempts. Try again in ${Math.ceil(
        verdict.retryAfterSeconds / 60
      )} minute(s).`,
    };
  }

  try {
    /**
     * `redirect: false` so a failure comes back as a thrown `AuthError` we can
     * turn into inline form state. With NextAuth's default redirect behaviour a
     * bad password becomes a redirect to `?error=CredentialsSignin`, which loses
     * the typed state and puts the failure in the URL.
     */
    await signIn('credentials', { email, password, redirect: false });
  } catch (error) {
    /**
     * Next signals control flow (`redirect()`, `notFound()`) by THROWING. Those
     * throws must pass straight through, or the navigation is swallowed and the
     * user sits on a form that appears to have done nothing. `unstable_rethrow`
     * is the framework's own helper for exactly this and re-throws only those
     * internal errors, returning normally for everything else — a plain
     * `catch` that inspects `error.digest` is the version of this that goes
     * stale when the internals change.
     */
    unstable_rethrow(error);

    if (error instanceof AuthError) {
      const limited = recordLoginFailure(keys);
      if (!limited.allowed) {
        return {
          error: `Too many failed sign-in attempts. Try again in ${Math.ceil(
            limited.retryAfterSeconds / 60
          )} minute(s).`,
        };
      }
      return { error: GENERIC_FAILURE };
    }

    // Something genuinely unexpected — a bug, not a bad password. Log it for us,
    // show the same message to them: an internal error message on a login form is
    // a reconnaissance gift.
    console.error('[auth] unexpected error during sign-in', error);
    return { error: GENERIC_FAILURE };
  }

  // Success. Clear both buckets so a bad-typing day leaves no residue. Must
  // happen before the redirect below, which throws.
  clearLoginAttempts(keys);

  /**
   * Redirect from the SERVER, outside the try/catch.
   *
   * `redirect()` signals by throwing, so it must not be inside the `catch` above
   * — and it must not be inside the `try` either, or `unstable_rethrow` would be
   * handed its own control-flow error to sort out.
   *
   * The first version of this returned the path as form state and let a
   * `useEffect` in the client component call `router.replace()`. That worked for
   * the plain case and silently did not for a `next=` deep link: the E2E test
   * "the return-to path is honoured after signing in" sat on the login page
   * forever, because a `router.refresh()` and a `router.replace()` fired from
   * the same effect race, and the refresh (an RSC fetch, not a navigation)
   * swallowed the result. A server redirect has no such race and needs no
   * effect.
   *
   * `redirectTo` went through `safeReturnPath()` above, so it cannot be an
   * off-site URL.
   */
  redirect(redirectTo);
}
