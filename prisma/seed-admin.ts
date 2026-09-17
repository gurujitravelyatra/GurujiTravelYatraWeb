/**
 * Creates (or updates the password of) ONE admin user.
 *
 * ## Run it
 *
 *   ADMIN_SEED_EMAIL="owner@example.com" ADMIN_SEED_PASSWORD="<a long passphrase>" \
 *     npm run db:seed:admin
 *
 * On Windows PowerShell:
 *
 *   $env:ADMIN_SEED_EMAIL="owner@example.com"
 *   $env:ADMIN_SEED_PASSWORD="<a long passphrase>"
 *   npm run db:seed:admin
 *   Remove-Item Env:ADMIN_SEED_PASSWORD
 *
 * ## Why this is a SEPARATE script from `prisma/seed.ts`
 *
 * Not tidiness — `prisma/seed.ts` is registered as Prisma's `seed` hook, it is
 * DESTRUCTIVE by design (it deletes and rewrites the content tables so re-running
 * converges on the fixtures), and it is safe to be destructive precisely because
 * its own header states that this database holds "no leads and no user-generated
 * data". An admin account is the first row in this database that is neither
 * derived from a fixture nor safe to drop and rewrite: wiping it would lock the
 * owner out of the CMS on every content re-seed.
 *
 * Keeping them apart means content can be re-seeded freely, and credentials are
 * only ever touched by someone who explicitly ran this command.
 *
 * ## No credential is hardcoded, and none is ever printed
 *
 * Both values come from the environment. There is no default email, no default
 * password, and no `--password` CLI flag (flags land in shell history and in `ps`
 * output). The script prints the email it wrote and never the password.
 *
 * ## Idempotent, and safe to re-run to ROTATE a password
 *
 * `upsert` on the unique email: a new address creates a user, an existing one has
 * its `passwordHash` replaced. `createdAt` and `lastLoginAt` are left alone on
 * update — a password rotation is not a new account and must not look like one in
 * the audit trail.
 */
import { existsSync } from 'node:fs';

import { PrismaClient } from '@prisma/client';

/**
 * `prisma/seed.ts` gets `DATABASE_URL` for free because the Prisma CLI loads
 * `.env` before running the `prisma.seed` hook. This script is invoked by npm,
 * not by Prisma, so nothing loads it — without this the script would fail with an
 * unhelpful "the URL must start with postgresql://" from deep inside the client.
 *
 * `process.loadEnvFile` is Node's own built-in (20.12+), so this costs no
 * dependency. Guarded on existence because `.env` is gitignored and a fresh
 * checkout will not have one; in that case the environment is expected to supply
 * the variables directly, which is how a deployment would run this.
 *
 * It does NOT override variables already present in the environment — which is
 * what makes the documented `ADMIN_SEED_PASSWORD=... npm run db:seed:admin`
 * invocation work even if someone has also put a value in `.env`.
 */
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

/**
 * Both imports are relative, and both target modules deliberately free of
 * `server-only` — `ts-node` runs this in a plain Node process where that marker
 * throws on import. See the note in `src/server/auth/password.ts`.
 */
import { hashPassword, MIN_ADMIN_PASSWORD_LENGTH } from '../src/server/auth/password';
import { normalizeAdminEmail } from '../src/server/auth/admin-email';

/**
 * Its own client, not `src/server/db/prisma.ts`'s.
 *
 * That module is marked `server-only`, which is a bundler guard for the Next app
 * and meaningless (and unresolvable) in a `ts-node` script. This is a separate
 * short-lived process with a single connection that exits immediately, so it is
 * not the multi-pool problem that module exists to prevent — `prisma/seed.ts`
 * does the same thing for the same reason.
 */
const prisma = new PrismaClient();

function readRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(
      `${name} is not set.\n\n` +
        'Both ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD must be supplied via the\n' +
        'environment. See the usage block at the top of prisma/seed-admin.ts.'
    );
  }
  return value;
}

/**
 * Deliberately weak-looking validation, and that is the correct scope.
 *
 * A long minimum is the one password rule with good evidence behind it (NIST
 * SP 800-63B), and composition rules — "one uppercase, one symbol" — measurably
 * push people toward `Password1!`. So: a floor on length, a check that the
 * address is plausibly an address, and nothing else. The floor itself lives in
 * `password.ts` next to the hashing, so there is one number rather than two that
 * can disagree.
 */
function assertPlausibleEmail(email: string): void {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(`ADMIN_SEED_EMAIL does not look like an email address: ${email}`);
  }
}

async function main(): Promise<void> {
  const email = normalizeAdminEmail(readRequiredEnv('ADMIN_SEED_EMAIL'));
  const password = readRequiredEnv('ADMIN_SEED_PASSWORD');

  assertPlausibleEmail(email);

  if (password.length < MIN_ADMIN_PASSWORD_LENGTH) {
    // `hashPassword` would throw anyway; catching it here gives a message that
    // names the variable instead of surfacing an internal error.
    throw new Error(
      `ADMIN_SEED_PASSWORD must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters. ` +
        'A passphrase of several words is easier to type and stronger than a short scramble.'
    );
  }

  const existing = await prisma.adminUser.findUnique({
    where: { email },
    select: { id: true },
  });

  const passwordHash = hashPassword(password);

  await prisma.adminUser.upsert({
    where: { email },
    // Update path: rotate the hash ONLY. createdAt and lastLoginAt are history.
    update: { passwordHash },
    create: { email, passwordHash },
  });

  // The email, never the password. Also note what was done, so re-running by
  // accident against the wrong address is visible immediately.
  console.log(
    existing
      ? `[seed-admin] Password rotated for existing admin user: ${email}`
      : `[seed-admin] Created admin user: ${email}`
  );
  console.log('[seed-admin] Sign in at /admin/login');
}

main()
  .catch((error: unknown) => {
    console.error('[seed-admin]', error instanceof Error ? error.message : error);
    // Non-zero exit so a CI step or a shell `&&` chain actually stops.
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
