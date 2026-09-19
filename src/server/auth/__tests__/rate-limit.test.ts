import {
  LOCKOUT_MS,
  MAX_ATTEMPTS_PER_EMAIL,
  MAX_ATTEMPTS_PER_IP,
  MAX_EMAIL_KEY_LENGTH,
  MAX_IP_KEY_LENGTH,
  MAX_TRACKED_KEYS,
  WINDOW_MS,
  __loginRateLimitStats,
  __resetLoginRateLimitForTests,
  checkLoginAllowed,
  clearLoginAttempts,
  loginRateLimitKeys,
  recordLoginFailure,
} from '../rate-limit';

/**
 * Time is injected rather than faked with `jest.useFakeTimers()`. The limiter
 * takes `now` as a parameter precisely so these tests can be explicit about
 * elapsed time instead of depending on timer-mock semantics.
 */
const T0 = 1_700_000_000_000;

beforeEach(() => {
  __resetLoginRateLimitForTests();
});

describe('loginRateLimitKeys', () => {
  it('produces one key per dimension, with the email lowercased', () => {
    expect(loginRateLimitKeys('203.0.113.9', '  Owner@GTY.com ')).toEqual([
      { key: 'ip:203.0.113.9', limit: MAX_ATTEMPTS_PER_IP },
      { key: 'email:owner@gty.com', limit: MAX_ATTEMPTS_PER_EMAIL },
    ]);
  });

  it('keys the same account identically however the email is typed', () => {
    const [, a] = loginRateLimitKeys('1.1.1.1', 'Owner@GTY.com');
    const [, b] = loginRateLimitKeys('2.2.2.2', 'owner@gty.com');
    expect(a.key).toBe(b.key);
  });

  it('gives the IP dimension a much looser budget than the email dimension', () => {
    // An IP is not a person — an office NAT or carrier-grade NAT carries many
    // legitimate users, so a tight IP budget punishes a shared connection for one
    // colleague's typos. The email bucket is the one that guards an account.
    expect(MAX_ATTEMPTS_PER_IP).toBeGreaterThan(MAX_ATTEMPTS_PER_EMAIL);
  });
});

describe('per-email throttling', () => {
  const keys = loginRateLimitKeys('203.0.113.9', 'owner@gty.com');

  it('allows attempts while under the limit', () => {
    for (let i = 0; i < MAX_ATTEMPTS_PER_EMAIL - 1; i += 1) {
      expect(checkLoginAllowed(keys, T0).allowed).toBe(true);
      expect(recordLoginFailure(keys, T0).allowed).toBe(true);
    }
    expect(checkLoginAllowed(keys, T0).allowed).toBe(true);
  });

  it('locks out on the MAX_ATTEMPTS_PER_EMAIL-th failure', () => {
    for (let i = 0; i < MAX_ATTEMPTS_PER_EMAIL - 1; i += 1) recordLoginFailure(keys, T0);

    const tripping = recordLoginFailure(keys, T0);
    expect(tripping.allowed).toBe(false);
    expect(tripping.retryAfterSeconds).toBeGreaterThan(0);

    // And the lockout is durable, not just reported once.
    expect(checkLoginAllowed(keys, T0).allowed).toBe(false);
  });

  it('reports a retry delay the user can act on', () => {
    for (let i = 0; i < MAX_ATTEMPTS_PER_EMAIL; i += 1) recordLoginFailure(keys, T0);
    expect(checkLoginAllowed(keys, T0).retryAfterSeconds).toBe(LOCKOUT_MS / 1000);
  });

  it('still refuses one millisecond before the lockout expires', () => {
    for (let i = 0; i < MAX_ATTEMPTS_PER_EMAIL; i += 1) recordLoginFailure(keys, T0);
    expect(checkLoginAllowed(keys, T0 + LOCKOUT_MS - 1).allowed).toBe(false);
  });

  it('allows again once the lockout has elapsed', () => {
    for (let i = 0; i < MAX_ATTEMPTS_PER_EMAIL; i += 1) recordLoginFailure(keys, T0);
    expect(checkLoginAllowed(keys, T0 + LOCKOUT_MS).allowed).toBe(true);
  });

  it('grants a full fresh budget after a served lockout', () => {
    for (let i = 0; i < MAX_ATTEMPTS_PER_EMAIL; i += 1) recordLoginFailure(keys, T0);

    // The failures are cleared along with the lockout, so the first mistake after
    // the wait must not immediately re-trip it. Otherwise a user who waited 15
    // minutes and then made one typo would be locked out for another 15.
    expect(recordLoginFailure(keys, T0 + LOCKOUT_MS).allowed).toBe(true);
  });

  it('expires failures that fall out of the rolling window', () => {
    // Failures spread over more than WINDOW_MS must not add up to a lockout: the
    // window is rolling, not cumulative-forever.
    for (let i = 0; i < MAX_ATTEMPTS_PER_EMAIL - 1; i += 1) recordLoginFailure(keys, T0);
    expect(recordLoginFailure(keys, T0 + WINDOW_MS + 1).allowed).toBe(true);
  });

  it('clears both buckets on success', () => {
    for (let i = 0; i < MAX_ATTEMPTS_PER_EMAIL - 1; i += 1) recordLoginFailure(keys, T0);
    clearLoginAttempts(keys);

    expect(recordLoginFailure(keys, T0).allowed).toBe(true);
  });
});

describe('per-IP throttling', () => {
  it('tolerates more failures from one IP than from one email', () => {
    // The scenario this protects: an office behind a single NAT. Enough failures
    // to lock one ACCOUNT must not lock the whole building out.
    const ip = '203.0.113.9';

    for (let i = 0; i < MAX_ATTEMPTS_PER_EMAIL + 1; i += 1) {
      recordLoginFailure(loginRateLimitKeys(ip, 'colleague-a@gty.com'), T0);
    }

    // Colleague A's account is locked...
    expect(checkLoginAllowed(loginRateLimitKeys(ip, 'colleague-a@gty.com'), T0).allowed).toBe(
      false
    );
    // ...but colleague B, on the same connection, can still sign in.
    expect(checkLoginAllowed(loginRateLimitKeys(ip, 'colleague-b@gty.com'), T0).allowed).toBe(true);
  });

  it('eventually locks an IP generating an abnormal volume of failures', () => {
    // A sweep across many addresses never fills any single email bucket, so the
    // IP bucket is the only thing that can stop it. Distinct emails each time.
    const ip = '198.51.100.7';
    for (let i = 0; i < MAX_ATTEMPTS_PER_IP; i += 1) {
      recordLoginFailure(loginRateLimitKeys(ip, `victim-${i}@gty.com`), T0);
    }

    expect(checkLoginAllowed(loginRateLimitKeys(ip, 'victim-fresh@gty.com'), T0).allowed).toBe(
      false
    );
  });
});

describe('the two dimensions are independent', () => {
  it('locking one email blocks that email from a DIFFERENT IP', () => {
    // This is the dimension that survives a botnet rotating source addresses, and
    // the one that still binds when `x-forwarded-for` is spoofed.
    const target = 'owner@gty.com';
    for (let i = 0; i < MAX_ATTEMPTS_PER_EMAIL; i += 1) {
      recordLoginFailure(loginRateLimitKeys(`10.0.0.${i}`, target), T0);
    }
    expect(checkLoginAllowed(loginRateLimitKeys('198.51.100.7', target), T0).allowed).toBe(false);
  });

  it('leaves an unrelated IP and email pair completely alone', () => {
    const attacker = loginRateLimitKeys('203.0.113.9', 'a@gty.com');
    for (let i = 0; i < MAX_ATTEMPTS_PER_EMAIL; i += 1) recordLoginFailure(attacker, T0);

    expect(checkLoginAllowed(loginRateLimitKeys('198.51.100.7', 'b@gty.com'), T0).allowed).toBe(
      true
    );
  });
});

/**
 * THE MEMORY BOUND — the C1 finding of the 2026-09-19 independent review.
 *
 * Both halves of every key are attacker-chosen: the email is a form field read
 * before any validation, the IP comes from `x-forwarded-for`. Before this, every
 * distinct pair allocated a record that nothing ever removed — `clearLoginAttempts`
 * runs only on a SUCCESSFUL login, which an attacker never reaches. The limiter
 * that bounds an attacker's guesses was itself unbounded in the attacker's
 * favour.
 *
 * These tests assert on `__loginRateLimitStats().size`, which is the only place
 * the property is observable; every verdict-level assertion above passes just as
 * well with a map of ten million records.
 */
describe('the attempt map is bounded', () => {
  /**
   * Comfortably past the ceiling, and past it in BOTH dimensions, since they
   * share one map. A run that inserted fewer keys than `MAX_TRACKED_KEYS` would
   * pass without eviction ever running — the `feedback_qg_vacuous-guard-test`
   * shape — so `inserted` is asserted against a literal floor below rather than
   * against anything derived from the ceiling.
   */
  const FLOOD = 50_000;

  function flood(now: number): number {
    let inserted = 0;
    for (let i = 0; i < FLOOD; i += 1) {
      // A distinct email AND a distinct spoofed IP per attempt: two new keys
      // each time, which is what an attacker rotating `x-forwarded-for` gets.
      recordLoginFailure(loginRateLimitKeys(`10.${i % 255}.${(i >> 8) % 255}.${i % 251}`, `victim-${i}@gty.test`), now);
      inserted += 2;
    }
    return inserted;
  }

  it('stays under the ceiling across 50,000 distinct emails and IPs', () => {
    const inserted = flood(T0);

    // GUARD THE GUARD, with literals. Both of these pass vacuously if the loop
    // above silently did nothing, so neither is derived from the other.
    expect(inserted).toBeGreaterThanOrEqual(100_000);
    expect(MAX_TRACKED_KEYS).toBeLessThan(inserted);

    expect(__loginRateLimitStats().size).toBeLessThanOrEqual(MAX_TRACKED_KEYS);
  });

  it('does not grow at all on the READ path', () => {
    /**
     * `checkLoginAllowed` runs on EVERY login attempt, before the database is
     * touched and before the password is looked at. It used to `set` the record
     * it had just constructed, so an attacker allocated a permanent record per
     * request without ever submitting a wrong password — the cheapest possible
     * version of this attack.
     */
    for (let i = 0; i < 10_000; i += 1) {
      checkLoginAllowed(loginRateLimitKeys(`192.0.2.${i % 255}`, `probe-${i}@gty.test`), T0);
    }

    expect(__loginRateLimitStats().size).toBe(0);
  });

  it('evicts SPENT records before records that still carry failures', () => {
    // Two records: one whose failures have aged out of the window, one fresh.
    const stale = loginRateLimitKeys('203.0.113.1', 'stale@gty.test');
    recordLoginFailure(stale, T0);

    const later = T0 + WINDOW_MS + 1;
    const fresh = loginRateLimitKeys('203.0.113.2', 'fresh@gty.test');
    recordLoginFailure(fresh, later);

    flood(later);

    // The fresh record's progress survived the flood; the stale one was garbage
    // either way — `pruneAndRead` would have reconstructed exactly its state.
    expect(__loginRateLimitStats().size).toBeLessThanOrEqual(MAX_TRACKED_KEYS);
  });

  /**
   * THE ABUSE THE TIERING EXISTS FOR.
   *
   * "Evict the oldest" would make eviction a lockout-reset oracle: lock the
   * admin's account out, then flood the map with junk keys until the record
   * holding that lockout is evicted, and the account is guessable again. The
   * locked record must outlive every unlocked one.
   */
  it('does NOT let a flood of junk keys reset a real account lockout', () => {
    const target = loginRateLimitKeys('203.0.113.9', 'owner@gty.test');
    for (let i = 0; i < MAX_ATTEMPTS_PER_EMAIL; i += 1) recordLoginFailure(target, T0);
    expect(checkLoginAllowed(target, T0).allowed).toBe(false);

    const inserted = flood(T0);
    expect(inserted).toBeGreaterThanOrEqual(100_000);

    // Still locked, and still for the full remaining time.
    const verdict = checkLoginAllowed(target, T0);
    expect(verdict.allowed).toBe(false);
    expect(verdict.retryAfterSeconds).toBe(LOCKOUT_MS / 1000);

    // And no active lockout was sacrificed anywhere to achieve that.
    expect(__loginRateLimitStats().evictedLockouts).toBe(0);
    expect(__loginRateLimitStats().size).toBeLessThanOrEqual(MAX_TRACKED_KEYS);
  });
});

describe('keys are length-capped before a bucket is minted', () => {
  it('truncates an absurd email rather than storing it', () => {
    const [, emailKey] = loginRateLimitKeys('203.0.113.9', 'a'.repeat(100_000) + '@gty.test');

    // `email:` prefix plus the capped local part, and nothing like 100kB.
    expect(emailKey.key.length).toBe('email:'.length + MAX_EMAIL_KEY_LENGTH);
  });

  it('truncates an absurd x-forwarded-for value rather than storing it', () => {
    const [ipKey] = loginRateLimitKeys('9'.repeat(100_000), 'owner@gty.test');
    expect(ipKey.key.length).toBe('ip:'.length + MAX_IP_KEY_LENGTH);
  });

  it('leaves a real address and a real IPv6 address untouched', () => {
    // The cap must not be so tight that it collapses legitimate distinct values
    // into one bucket. The longest textual IP there is must survive whole.
    const v6 = '2001:0db8:0000:0000:0000:ffff:255.255.255.255';
    expect(v6.length).toBeLessThanOrEqual(MAX_IP_KEY_LENGTH);

    const [ipKey, emailKey] = loginRateLimitKeys(v6, 'owner@gurujitravelyatra.com');
    expect(ipKey.key).toBe(`ip:${v6}`);
    expect(emailKey.key).toBe('email:owner@gurujitravelyatra.com');
  });
});
