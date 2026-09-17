import {
  LOCKOUT_MS,
  MAX_ATTEMPTS_PER_EMAIL,
  MAX_ATTEMPTS_PER_IP,
  WINDOW_MS,
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
