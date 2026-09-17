import 'server-only';
import { getOptionalPrismaClient } from '@/server/db/prisma';
import { normalizeAdminEmail } from './admin-email';

/**
 * The ONLY module that reads `AdminUser` rows.
 *
 * `import 'server-only'` is doing real work here, not decoration: it makes the
 * build fail if this file ever ends up in a client component's import graph,
 * which is the mistake that would ship a password hash to a browser.
 *
 * `normalizeAdminEmail` is imported rather than defined here because
 * `prisma/seed-admin.ts` needs the identical function and cannot import anything
 * marked `server-only` — see the note in `admin-email.ts`.
 */
export { normalizeAdminEmail };

export interface AdminUserForLogin {
  id: string;
  email: string;
  passwordHash: string;
}

/**
 * Returns `null` for "no such user" AND for "no database configured" — the two
 * are different causes with the same correct outcome, which is to refuse the
 * login.
 *
 * Refusing rather than throwing is the deliberate half. `DATABASE_URL` being
 * unset is a SUPPORTED mode in this app (the site serves the fixture catalogue in
 * it — see `src/content/content-adapter.ts`), so auth must have a defined answer
 * for it, and "I cannot verify this password, therefore no" is the only safe one.
 * The alternative failure mode — treating an unreachable database as a reason to
 * let someone through — is the bug this shape exists to make unwriteable.
 *
 * Selects three columns explicitly rather than the row. `lastLoginAt` and
 * `createdAt` are not needed to check a password, and the narrower the object
 * that carries a hash, the fewer places it can accidentally be returned from.
 */
export async function findAdminUserForLogin(email: string): Promise<AdminUserForLogin | null> {
  const prisma = getOptionalPrismaClient();
  if (prisma === null) {
    console.warn(
      '[auth] DATABASE_URL is not set — every admin login will be refused. ' +
        'This is expected in the test/fixture mode; in production it is a missing environment variable.'
    );
    return null;
  }

  try {
    return await prisma.adminUser.findUnique({
      where: { email: normalizeAdminEmail(email) },
      select: { id: true, email: true, passwordHash: true },
    });
  } catch (error) {
    // A database outage must read as "cannot authenticate", never as "authenticated".
    console.error('[auth] admin user lookup failed', error);
    return null;
  }
}

/**
 * Best-effort. Called from the `signIn` EVENT, which fires only after the whole
 * sign-in has succeeded — not from `authorize()`, where a correct password can
 * still be followed by a later refusal and would be recorded as a login that
 * never happened.
 *
 * Swallows its own failure on purpose: a user who has just proved who they are
 * must not be bounced because a timestamp column could not be written.
 */
export async function recordAdminLogin(userId: string): Promise<void> {
  const prisma = getOptionalPrismaClient();
  if (prisma === null) return;

  try {
    await prisma.adminUser.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  } catch (error) {
    console.error('[auth] failed to record lastLoginAt', error);
  }
}
