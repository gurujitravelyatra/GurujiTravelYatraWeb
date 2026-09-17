import 'server-only';

/**
 * Brute-force throttle for `/admin/login`.
 *
 * ## Scope, stated before the code so nobody over-reads it
 *
 * This is an IN-MEMORY, SINGLE-PROCESS limiter. It is real — it actually blocks,
 * it is actually wired into the only code path that can check a password, and
 * both unit tests and an E2E test drive it to lockout — but its guarantees stop
 * at the process boundary:
 *
 * - **It resets on deploy/restart.** An attacker who can trigger restarts, or who
 *   is simply patient across one, gets a fresh budget.
 * - **It does not survive horizontal scaling.** Two app instances mean two
 *   independent counters and twice the attempts. This app runs as a single
 *   container (`./Dockerfile`, `output: 'standalone'`), so today that is one
 *   counter; the day a second replica appears, this becomes a Redis/Postgres
 *   counter or it becomes decorative. **That is the trigger to watch for.**
 *
 * Those are acceptable for a login used by a few staff, and a distributed limiter
 * would be real infrastructure for a threat this deployment does not have yet.
 * What is NOT acceptable is pretending; hence this comment.
 *
 * It is also not the only defence. bcrypt at cost 12 (`password.ts`) already caps
 * an online guessing rate at a few attempts per second per core, and the account
 * set is not enumerable. This limiter closes the gap between "slow" and "bounded".
 */

/**
 * ## Two dimensions, two very different thresholds
 *
 * The email and IP buckets answer different questions, so giving them the same
 * budget is a mistake — and it was the mistake made here first.
 *
 * **Email (tight).** "Is someone attacking THIS account?" Five wrong passwords
 * for one address in fifteen minutes is already abnormal; a real person who has
 * mistyped five times needs a pause, not a sixth guess. This is the bucket that
 * actually protects an account, and it is the one that still binds when an
 * attacker rotates source addresses through a botnet — or simply spoofs
 * `x-forwarded-for`, which is a header and therefore a suggestion.
 *
 * **IP (loose).** "Is this source generating an abnormal VOLUME of failures?" An
 * IP is not a person. GTY's staff will sit behind one office NAT, and so will
 * any visitor on mobile carrier-grade NAT — so a tight IP budget punishes a
 * shared connection for one colleague's bad morning. Its job is to catch
 * enumeration sweeps across many addresses, which need far more than five
 * attempts to be worth running.
 *
 * The concrete failure that prompted splitting these: with both at 5, the
 * Playwright suite locked itself out. Every test in it connects from 127.0.0.1,
 * so the handful of deliberately-failing login tests plus the rate-limit test
 * exhausted a single shared bucket and unrelated tests started failing with
 * "Too many failed sign-in attempts". A limiter that cannot tell twelve staff
 * apart from one attacker is the same limiter that cannot tell four test cases
 * apart — the test suite was just the first place it showed.
 */
export const MAX_ATTEMPTS_PER_EMAIL = 5;
export const MAX_ATTEMPTS_PER_IP = 30;

/** Rolling window in which failures accumulate. */
export const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/** How long a key stays locked once it trips. */
export const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

interface AttemptRecord {
  /** Timestamps of failures still inside the window. */
  failures: number[];
  /** Epoch ms the lockout ends, or null when not locked. */
  lockedUntil: number | null;
  /** Failures tolerated inside the window before this key locks. */
  limit: number;
}

/**
 * Cached on `globalThis` for the same reason the Prisma client is: Next.js
 * rebuilds modules on every hot reload in development, and a module-scope `Map`
 * would be replaced — silently resetting the counter on every file save, which
 * would make the limiter look like it worked in a test and not in the app.
 */
const globalForRateLimit = globalThis as unknown as {
  gtyLoginAttempts?: Map<string, AttemptRecord>;
};

const attempts: Map<string, AttemptRecord> = (globalForRateLimit.gtyLoginAttempts ??= new Map());

/** A bucket to count against, and the budget that applies to it. */
export interface RateLimitKey {
  key: string;
  limit: number;
}

/**
 * One key per dimension, NOT a composite.
 *
 * A composite `ip|email` key would let an attacker from one IP try five
 * passwords against each of a thousand addresses without ever tripping
 * anything, because every pair would be its own bucket. An attempt is refused
 * if EITHER bucket is exhausted.
 */
export function loginRateLimitKeys(ip: string, email: string): RateLimitKey[] {
  return [
    { key: `ip:${ip}`, limit: MAX_ATTEMPTS_PER_IP },
    { key: `email:${email.trim().toLowerCase()}`, limit: MAX_ATTEMPTS_PER_EMAIL },
  ];
}

export interface RateLimitVerdict {
  allowed: boolean;
  /** Seconds until the caller may retry. 0 when allowed. */
  retryAfterSeconds: number;
}

function pruneAndRead({ key, limit }: RateLimitKey, now: number): AttemptRecord {
  const record = attempts.get(key) ?? { failures: [], lockedUntil: null, limit };
  record.limit = limit;

  if (record.lockedUntil !== null && record.lockedUntil <= now) {
    // Lockout served. Clear the failures with it, so the user gets a full fresh
    // budget rather than re-tripping on the first mistake after the wait.
    record.lockedUntil = null;
    record.failures = [];
  }
  record.failures = record.failures.filter((at) => now - at < WINDOW_MS);
  attempts.set(key, record);
  return record;
}

function verdictFrom(lockMs: number): RateLimitVerdict {
  if (lockMs > 0) return { allowed: false, retryAfterSeconds: Math.ceil(lockMs / 1000) };
  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * Read-only check. Call BEFORE touching the database or hashing anything — the
 * whole point is to not spend that work on an attacker.
 */
export function checkLoginAllowed(keys: RateLimitKey[], now: number = Date.now()): RateLimitVerdict {
  let longestLock = 0;
  for (const key of keys) {
    const record = pruneAndRead(key, now);
    if (record.lockedUntil !== null) {
      longestLock = Math.max(longestLock, record.lockedUntil - now);
    }
  }
  return verdictFrom(longestLock);
}

/**
 * Record a FAILED attempt. Trips the lockout when a bucket fills.
 *
 * Deliberately not called for a successful login — see {@link clearLoginAttempts}.
 */
export function recordLoginFailure(
  keys: RateLimitKey[],
  now: number = Date.now()
): RateLimitVerdict {
  let longestLock = 0;
  for (const key of keys) {
    const record = pruneAndRead(key, now);
    record.failures.push(now);
    if (record.failures.length >= record.limit) {
      record.lockedUntil = now + LOCKOUT_MS;
    }
    attempts.set(key.key, record);
    if (record.lockedUntil !== null) {
      longestLock = Math.max(longestLock, record.lockedUntil - now);
    }
  }
  return verdictFrom(longestLock);
}

/**
 * Clear on SUCCESS only.
 *
 * This is what makes the limiter tolerable for the real user: four typos
 * followed by the right password leaves no residue, so the fifth login of a bad
 * morning does not lock them out. An attacker gets no benefit, because reaching
 * this function means they already know the password.
 */
export function clearLoginAttempts(keys: RateLimitKey[]): void {
  for (const { key } of keys) attempts.delete(key);
}

/** Test seam. Not called by application code. */
export function __resetLoginRateLimitForTests(): void {
  attempts.clear();
}
