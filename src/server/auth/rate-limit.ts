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
 * ## The accepted cost of the email bucket, stated so nobody rediscovers it
 *
 * A tight per-email budget with a HARD 15-minute lockout means anyone who can
 * guess the admin's address can keep that account locked out indefinitely, for
 * the price of five wrong passwords every quarter of an hour. That is a real
 * denial of service and it is an ACCEPTED, user-confirmed trade (2026-09-19):
 * the alternatives — exponential backoff that never fully locks, or dropping to
 * a per-IP-only budget — both restore an online guessing channel against the one
 * account that matters, and this deployment has a handful of staff who can wait
 * fifteen minutes. The mitigation is operational (a second admin account), not
 * algorithmic. BLOCKERS.md item 14 records the decision.
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

/**
 * ## The memory bound, and why a limiter needs one
 *
 * Every key in this map is ATTACKER-CHOSEN. The email half comes from a form
 * field read before any validation (`login/actions.ts` does `String(formData.get
 * ('email'))` and hands it straight here), and the IP half comes from
 * `x-forwarded-for`, which is a header and therefore a suggestion. So "one record
 * per distinct key" is "one record per request an attacker cares to vary", and
 * a map with no ceiling is a memory-exhaustion primitive wearing a security
 * control's clothes: the very feature that is supposed to bound an attacker's
 * attempts is the thing that grows without bound as they make them.
 *
 * Nothing evicted records before this. `pruneAndRead` trimmed each record's
 * `failures` array — which bounds the SIZE of a record and says nothing about
 * how many records exist — and `clearLoginAttempts` only ran on a SUCCESSFUL
 * login, which is exactly the path an attacker never reaches.
 *
 * Two changes bound it, and they are independent:
 *
 *  1. **Keys are normalised and LENGTH-CAPPED before a bucket is minted**
 *     (`loginRateLimitKeys`). Without that the ceiling below still holds, but
 *     each record could carry a megabyte of attacker-supplied "email".
 *  2. **A hard record ceiling with tiered eviction** (`evictIfOverCapacity`).
 *
 * `MAX_TRACKED_KEYS` counts BOTH dimensions, since they share one map. 20,000
 * records at a worst case of ~30 timestamps plus a short key each is a few
 * megabytes — small enough to be uninteresting, and vastly more keys than the
 * legitimate traffic of a login used by a handful of staff will ever produce.
 * Reaching it at all means an attack is in progress.
 */
export const MAX_TRACKED_KEYS = 20_000;

/**
 * Evicting down to a LOW-WATER MARK rather than to the ceiling, so the scan that
 * does it runs roughly once per 2,000 inserts instead of on every insert once
 * the map is full. The alternative — evict exactly one record per insert — turns
 * a full map into a full sort/scan on every single login attempt, which hands
 * the attacker a CPU amplification in place of the memory one.
 */
const EVICTION_TARGET = Math.floor(MAX_TRACKED_KEYS * 0.9);

/**
 * RFC 5321's maximum email address length. Anything longer is not an address
 * that could ever match a seeded admin account, so truncating loses nothing
 * real. Two distinct over-length inputs sharing a 254-character prefix share a
 * bucket; that is not a weakening, because neither can name an account.
 */
export const MAX_EMAIL_KEY_LENGTH = 254;

/**
 * 45 characters is the longest textual IP address there is — an IPv4-mapped
 * IPv6 address, `0000:…:255.255.255.255`. Same reasoning as the email cap: a
 * longer value is not an address, and the limiter's job is to bucket it
 * somewhere bounded rather than to believe it.
 */
export const MAX_IP_KEY_LENGTH = 45;

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

/**
 * How many ACTIVE lockouts eviction has had to discard (tier 3 in
 * `evictIfOverCapacity`). Non-zero means the ceiling was hit hard enough that
 * the limiter had to choose between bounded memory and an intact lockout — the
 * one outcome in this file worth being able to see rather than infer, and the
 * signal that the in-memory design has been outgrown.
 */
let evictedLockouts = 0;

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
    { key: `ip:${normaliseIpKey(ip)}`, limit: MAX_ATTEMPTS_PER_IP },
    { key: `email:${normaliseEmailKey(email)}`, limit: MAX_ATTEMPTS_PER_EMAIL },
  ];
}

/**
 * Normalisation happens HERE, before a key string exists — not inside the map
 * lookup, and not at the call site.
 *
 * The ordering is the point. `loginAction` reads the email field before any
 * validation has run (it must: the rate limit is checked before the database
 * lookup, which is the whole reason it is cheap), so the value arriving here can
 * be a megabyte of anything. Capping it at the point the KEY is minted means
 * there is no path that stores an unbounded string, rather than a rule each
 * caller has to remember.
 *
 * Lowercasing is also a correctness fix and not only a bound: without it
 * `Admin@gty.test` and `admin@gty.test` were separate buckets, so an attacker
 * got `MAX_ATTEMPTS_PER_EMAIL` guesses per capitalisation of the same address.
 * (The previous code did lowercase, inline; this keeps it and makes it a named,
 * testable step.)
 */
function normaliseEmailKey(email: string): string {
  return email.trim().toLowerCase().slice(0, MAX_EMAIL_KEY_LENGTH);
}

function normaliseIpKey(ip: string): string {
  return ip.trim().slice(0, MAX_IP_KEY_LENGTH);
}

/** True when an active lockout is in force — i.e. this record is doing its job. */
function isLocked(record: AttemptRecord, now: number): boolean {
  return record.lockedUntil !== null && record.lockedUntil > now;
}

/**
 * True when a record protects nothing: no live lockout, and every failure it
 * remembers has aged out of the window. Deleting one of these is indistinguishable
 * from keeping it, because `pruneAndRead` would reconstruct exactly this state.
 */
function isSpent(record: AttemptRecord, now: number): boolean {
  if (isLocked(record, now)) return false;
  return record.failures.every((at) => now - at >= WINDOW_MS);
}

/**
 * Bring the map back under its ceiling.
 *
 * ## Eviction order is a SECURITY decision, not a cache-tuning one
 *
 * The obvious implementation — "drop the oldest entries" — is a vulnerability
 * here rather than a policy. An attacker who can cause eviction can choose WHAT
 * gets evicted, and the thing worth evicting, from their point of view, is the
 * lockout currently protecting the account they are attacking. That turns the
 * memory fix into a lockout-reset oracle: fill the map, and the real admin's
 * 15-minute lockout disappears.
 *
 * So records are evicted in tiers, strongest protection last:
 *
 *  1. **SPENT** — no lockout, no in-window failures. Evicting these costs
 *     nothing at all; they are pure garbage the old code never collected.
 *  2. **PARTIAL** — failures accumulating but no lockout yet. Evicting one loses
 *     progress toward a future lockout, which is a real but small cost.
 *  3. **LOCKED** — an active lockout. Evicting one RESETS it, which is precisely
 *     the abuse above, so this tier is a last resort and is ordered by
 *     `lockedUntil` ASCENDING: if a locked record must go, it is the one with
 *     the least protection left to lose.
 *
 * Tier 3 is reachable only when more than {@link MAX_TRACKED_KEYS} keys are
 * SIMULTANEOUSLY locked, which needs ~100,000 failed attempts inside one
 * 15-minute window. At that point the map is already telling the truth — this is
 * an attack, not traffic — and the alternative to evicting is an unbounded map,
 * which is the defect being fixed. It is not silent: see `__loginRateLimitStats`.
 *
 * Within tiers 1 and 2 the order is `Map` insertion order, i.e. record CREATION
 * order. That is deliberate rather than an LRU: a record's usefulness is bounded
 * by `WINDOW_MS` regardless of how recently it was touched, so age is the right
 * proxy and it needs no bookkeeping on the hot path.
 */
function evictIfOverCapacity(now: number): void {
  if (attempts.size <= MAX_TRACKED_KEYS) return;

  const partial: string[] = [];
  const locked: { key: string; lockedUntil: number }[] = [];

  /**
   * One pass: delete tier 1 as it is found, and bucket tiers 2 and 3 for the
   * passes below. Deleting the current entry while iterating a `Map` is defined
   * behaviour — the remaining entries are still visited.
   */
  for (const [key, record] of attempts) {
    if (isSpent(record, now)) {
      attempts.delete(key);
      if (attempts.size <= EVICTION_TARGET) return;
    } else if (isLocked(record, now)) {
      locked.push({ key, lockedUntil: record.lockedUntil as number });
    } else {
      partial.push(key);
    }
  }

  for (const key of partial) {
    attempts.delete(key);
    if (attempts.size <= EVICTION_TARGET) return;
  }

  locked.sort((a, b) => a.lockedUntil - b.lockedUntil);
  for (const { key } of locked) {
    attempts.delete(key);
    evictedLockouts += 1;
    if (attempts.size <= EVICTION_TARGET) return;
  }
}

export interface RateLimitVerdict {
  allowed: boolean;
  /** Seconds until the caller may retry. 0 when allowed. */
  retryAfterSeconds: number;
}

/**
 * Read a key's state, trimming what has expired.
 *
 * ## THIS FUNCTION NO LONGER WRITES TO THE MAP
 *
 * It used to end in `attempts.set(key, record)`, which meant the READ path grew
 * the map: `checkLoginAllowed()` runs on every single login attempt, before the
 * database is touched, so merely POSTing a new email address created a permanent
 * record. An attacker did not even have to submit a wrong PASSWORD to allocate —
 * an empty one did it, because the allocation happened before the credential was
 * ever checked.
 *
 * Now an unknown key yields a transient zero record that is never stored, and
 * {@link recordLoginFailure} — the only function with a reason to remember
 * anything — is the single place that inserts. An existing record is still
 * mutated in place, so the pruning below persists without a `set`.
 */
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

    /**
     * The ONLY insertion point in this module, and therefore the only place the
     * ceiling has to be enforced. Eviction runs AFTER the insert rather than
     * before it, so the record that triggered the overflow is itself a candidate
     * under the same tier rules as every other — a newly-created PARTIAL record
     * has no special claim to survive over an older one.
     */
    attempts.set(key.key, record);
    evictIfOverCapacity(now);

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
  evictedLockouts = 0;
}

/**
 * Test/diagnostic seam for the memory bound.
 *
 * Exported because the property being enforced — "the map stays under a ceiling
 * no matter what an attacker sends" — is not observable from any of the four
 * functions above. A test that could only call `checkLoginAllowed` would be
 * asserting on the verdicts while the actual defect (unbounded growth) sat one
 * layer down, which is the `feedback_qg_vacuous-guard-test` shape.
 */
export function __loginRateLimitStats(): { size: number; evictedLockouts: number } {
  return { size: attempts.size, evictedLockouts };
}
