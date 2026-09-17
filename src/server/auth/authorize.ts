import 'server-only';
import { z } from 'zod';

import { findAdminUserForLogin } from './admin-user';
import { burnPasswordComparison, verifyPassword } from './password';

/**
 * The credentials check, extracted from the provider definition in `auth.ts`.
 *
 * It lives in its own module for one reason: NextAuth v5 does not expose the
 * constructed provider list, so a callback defined inline inside `NextAuth({...})`
 * is unreachable from a test. The alternative to this file is asserting the most
 * security-critical function in the application only indirectly, through the HTTP
 * layer — which is a fine integration test and a poor place to enumerate every
 * malformed-input case.
 *
 * `auth.ts` passes this straight through as the provider's `authorize`, so the
 * function under test and the function in production are the same object.
 */

/**
 * Deliberately separate from any client-side form validation.
 *
 * `/api/auth/callback/credentials` is a public HTTP endpoint. Anyone can POST to
 * it directly without ever loading the login page, so the rules that matter are
 * the ones enforced here — the browser's `required` attributes and the form's
 * own checks are a convenience for honest users, not a gate.
 */
const credentialsSchema = z.object({
  /**
   * `.trim()` runs BEFORE `.email()`, and that ordering is the whole point.
   *
   * Without it, `" owner@gty.com "` fails validation and the user is told their
   * credentials are not recognised — for a trailing space they cannot see.
   * Browsers and password managers add exactly that on autofill and on
   * copy-paste, so this is a routine input, not an edge case. A unit test caught
   * it (`authorize.test.ts` → "looks the user up by the normalised email"), which
   * is the one place it would ever have been visible short of a confused user.
   *
   * The 320 cap is the RFC 5321 maximum (64-char local part + @ + 255-char
   * domain), applied before the regex so a pathological input is rejected on
   * length rather than on backtracking.
   */
  email: z.string().min(1).max(320).trim().email(),
  /**
   * No minimum length. A length rule at login would reject a legitimately short
   * stored password and would leak the rule to anyone probing. The minimum is
   * enforced where passwords are CHOSEN — `hashPassword()`.
   *
   * The maximum is a denial-of-service guard: bcrypt truncates its input at 72
   * bytes, so nothing beyond the cap can change the outcome, but without one a
   * megabyte-long "password" is free CPU for an attacker.
   */
  password: z.string().min(1).max(200),
});

export interface AuthorizedAdmin {
  id: string;
  email: string;
}

/**
 * Returns the user, or `null`. NEVER throws a message a visitor could read, and
 * never returns anything carrying a password hash.
 *
 * ## Every failure looks identical, on purpose
 *
 * Unknown email, wrong password, database down, no database configured,
 * malformed input — all return `null`, and the login page renders one sentence
 * for all of them. Distinguishing "no such account" from "wrong password" would
 * turn this endpoint into an account-enumeration oracle, which matters more than
 * usual here: the accounts are a handful of named staff at a real company, and
 * confirming that one of their addresses is a working admin login is a gift to a
 * phishing attempt.
 *
 * The timing half of that same leak is closed by `burnPasswordComparison()`.
 *
 * ## Rate limiting is NOT here
 *
 * It lives in the server action (`src/app/admin/login/actions.ts`), because it
 * needs the request's IP, which this callback is never given. That means the HTTP
 * endpoint is reachable without passing the limiter — which is why the limiter is
 * not the only defence (bcrypt cost 12 bounds the attempt rate on its own), and
 * why `rate-limit.ts` says so out loud rather than overstating its coverage.
 */
export async function authorizeAdminCredentials(
  rawCredentials: unknown
): Promise<AuthorizedAdmin | null> {
  const parsed = credentialsSchema.safeParse(rawCredentials);
  if (!parsed.success) return null;

  const { email, password } = parsed.data;
  const user = await findAdminUserForLogin(email);

  if (user === null) {
    // Spend the same CPU as a real comparison, so "no such user" and "wrong
    // password" take the same wall-clock time.
    burnPasswordComparison(password);
    return null;
  }

  if (!verifyPassword(password, user.passwordHash)) return null;

  // Only id and email cross this boundary. The hash stops here.
  return { id: user.id, email: user.email };
}
