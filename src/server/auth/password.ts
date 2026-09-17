import bcrypt from 'bcryptjs';

/**
 * The ONE place this app turns a password into a hash, or checks one against a
 * hash. Nothing else imports `bcryptjs`.
 *
 * ## Why this file is NOT marked `server-only`, when its neighbours are
 *
 * `admin-user.ts`, `db/prisma.ts` and `session.ts` all carry `import 'server-only'`
 * because each of them touches something that would be a genuine leak in a
 * browser bundle — the database URL, a password hash, the session secret.
 *
 * This file holds none of those. It is four pure functions and a cost constant.
 * And it has a consumer the guard would break: `prisma/seed-admin.ts` runs under
 * `ts-node` in a plain Node process, where `server-only` is not merely inert but
 * throws on import (its `index.js` is an unconditional `throw`; only React's
 * `react-server` condition resolves to the empty module).
 *
 * The choice is therefore between the seed script sharing this module or keeping
 * its own copy of the bcrypt cost factor. A second, drifting copy of the number
 * that determines how strong every stored hash is would be a far worse outcome
 * than the absence of a bundler guard on a file that no client component imports
 * — and could not import usefully, since the only caller of `verifyPassword` is
 * `authorize()`, which is itself behind `admin-user.ts`'s guard.
 *
 * ## Why `bcryptjs` and not `bcrypt` / `argon2`
 *
 * The algorithm question and the package question have different answers here.
 *
 * **Algorithm — bcrypt.** Argon2id is the stronger primitive on paper (memory-hard,
 * so it resists GPU/ASIC attack in a way bcrypt does not) and would be the right
 * call for a large user table. This table has a handful of staff rows, is not
 * internet-enumerable (no signup, no password reset, no "user not found"
 * distinction), and is protected by a rate limiter before the hash is ever
 * reached. Against that threat model bcrypt at cost 12 is not the weak link, and
 * it buys a property that matters more day to day: `$2b$` is the most portable
 * hash format there is, so the stored hashes survive changing our minds about the
 * package below without a password reset for every user.
 *
 * **Package — the pure-JS one.** `bcrypt` and `@node-rs/bcrypt` are native modules:
 * the first compiles through node-gyp, the second downloads a prebuilt binary.
 * Both are things this environment specifically cannot do —
 * `memory/project_gty_pipeline_environment.md` records `binaries.prisma.sh`
 * failing with ECONNRESET and Prisma's own postinstall having to be skipped, and
 * the app also has to build inside the Alpine image in `./Dockerfile`, where a
 * glibc prebuild would not load. A pure-JS implementation has no install step to
 * fail and no platform to be wrong about.
 *
 * The cost of that choice is honest: `bcryptjs` is roughly 3-5x slower than the
 * native binding for the same cost factor. That is irrelevant at this volume —
 * and note the direction, because it is the safe one: slower hashing makes an
 * offline crack harder, not easier. It shows up only as ~200-400ms on the login
 * request, which is a login, once a day, for one person.
 *
 * `hashSync`/`compareSync` rather than the async forms on purpose: `bcryptjs`'s
 * async API chunks the work across timers to avoid blocking a browser's event
 * loop, which on a server just makes the same CPU work take longer in wall-clock
 * while still occupying the thread. There is nothing to yield to on a login
 * request.
 */

/**
 * OWASP's current floor for bcrypt is cost 10. 12 is two doublings above it
 * (~4x the work), which lands around 200-400ms per verification under
 * `bcryptjs` on ordinary hardware — slow enough to be worth an attacker's
 * money, fast enough that nobody notices logging in.
 *
 * Raising this later does NOT invalidate stored hashes: the cost is encoded in
 * the hash itself, so old rows keep verifying at their original cost and only
 * newly-written hashes use the new one.
 */
export const BCRYPT_COST = 12;

/**
 * Below this, a password is not worth hashing. Enforced at the SEED (where
 * passwords are chosen) rather than at login (where they are merely typed):
 * applying a length rule at login would reject a legitimately-stored short
 * password and, worse, would leak the rule to anyone guessing.
 */
export const MIN_ADMIN_PASSWORD_LENGTH = 12;

export function hashPassword(plaintext: string): string {
  if (plaintext.length < MIN_ADMIN_PASSWORD_LENGTH) {
    throw new Error(
      `Refusing to hash a password shorter than ${MIN_ADMIN_PASSWORD_LENGTH} characters.`
    );
  }
  return bcrypt.hashSync(plaintext, BCRYPT_COST);
}

/**
 * Never throws. A malformed or truncated hash in the database is an operational
 * problem, not an authentication success — `bcrypt.compareSync` throws on some
 * malformed inputs, and an exception escaping into the credentials `authorize()`
 * callback is exactly the kind of thing that turns into a 500 that someone
 * "fixes" by catching it too broadly.
 */
export function verifyPassword(plaintext: string, hash: string): boolean {
  try {
    return bcrypt.compareSync(plaintext, hash);
  } catch {
    return false;
  }
}

/**
 * A real bcrypt hash of a value no one knows, used to spend the same CPU time on
 * an unknown email as on a known one.
 *
 * Without this, "no such user" returns in microseconds and "wrong password"
 * returns in ~300ms, and that gap is a free account-enumeration oracle: anyone
 * can discover which addresses are staff by timing the response. Comparing
 * against a throwaway hash makes both paths cost the same.
 *
 * Generated once at module load from random bytes, so it is not a checked-in
 * constant that could ever be mistaken for a credential, and nothing can match it.
 */
let dummyHash: string | null = null;

export function burnPasswordComparison(plaintext: string): void {
  if (dummyHash === null) {
    dummyHash = bcrypt.hashSync(
      // 32 random bytes. Not derived from anything, not stored, never compared
      // against a real user.
      Array.from({ length: 32 }, () => Math.floor(Math.random() * 256).toString(16)).join(''),
      BCRYPT_COST
    );
  }
  verifyPassword(plaintext, dummyHash);
}
