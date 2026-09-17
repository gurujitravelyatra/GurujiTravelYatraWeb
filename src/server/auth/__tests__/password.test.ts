import {
  BCRYPT_COST,
  MIN_ADMIN_PASSWORD_LENGTH,
  burnPasswordComparison,
  hashPassword,
  verifyPassword,
} from '../password';

/**
 * These tests are slow by design — each `hashPassword` call is a deliberate
 * ~300ms of bcrypt work at cost 12. That is the feature under test, so they are
 * kept few and specific rather than parameterised over a table of inputs.
 */

const VALID = 'a-sufficiently-long-test-passphrase';

describe('hashPassword', () => {
  it('produces a bcrypt hash and never contains the plaintext', () => {
    const hash = hashPassword(VALID);

    // `$2b$` is modern bcrypt; the two digits are the cost. Asserting the prefix
    // rather than just "it is a string" is what would catch a future change that
    // swapped the algorithm out from under stored hashes.
    expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/);
    expect(hash).toHaveLength(60);
    expect(hash).not.toContain(VALID);
  });

  it('applies the documented cost factor', () => {
    // The cost lives in the hash, which is why raising BCRYPT_COST later does not
    // invalidate old rows. This asserts the constant and the output agree.
    expect(hashPassword(VALID)).toContain(`$${BCRYPT_COST}$`);
  });

  it('salts, so the same password never produces the same hash twice', () => {
    // Identical hashes for identical passwords would mean an unsalted digest, and
    // would let anyone reading the table see which accounts share a password.
    expect(hashPassword(VALID)).not.toEqual(hashPassword(VALID));
  });

  it('refuses a password below the minimum length', () => {
    expect(() => hashPassword('x'.repeat(MIN_ADMIN_PASSWORD_LENGTH - 1))).toThrow(
      /at least|shorter than/i
    );
  });

  it('accepts a password at exactly the minimum length', () => {
    // Boundary in the allowed direction — an off-by-one here would lock out a
    // password the documentation says is acceptable.
    expect(() => hashPassword('x'.repeat(MIN_ADMIN_PASSWORD_LENGTH))).not.toThrow();
  });
});

describe('verifyPassword', () => {
  it('accepts the correct password and rejects a wrong one', () => {
    const hash = hashPassword(VALID);
    expect(verifyPassword(VALID, hash)).toBe(true);
    expect(verifyPassword(`${VALID}x`, hash)).toBe(false);
    expect(verifyPassword('', hash)).toBe(false);
  });

  it('is case-sensitive', () => {
    const hash = hashPassword(VALID);
    expect(verifyPassword(VALID.toUpperCase(), hash)).toBe(false);
  });

  it('returns false rather than throwing on a malformed stored hash', () => {
    // A truncated or garbage hash column is an operational problem. It must read
    // as "not authenticated", never as an exception escaping into `authorize()`
    // — and above all never as a pass.
    for (const broken of ['', 'not-a-hash', '$2b$12$tooshort', '$2b$']) {
      expect(verifyPassword(VALID, broken)).toBe(false);
    }
  });
});

describe('burnPasswordComparison', () => {
  it('never throws and returns nothing', () => {
    // Its only job is to spend CPU so that "unknown email" and "wrong password"
    // take comparable time. If it ever threw, the unknown-email path would 500
    // while the wrong-password path returned normally — re-opening the exact
    // enumeration channel it exists to close, via a different signal.
    expect(burnPasswordComparison('anything')).toBeUndefined();
    expect(() => burnPasswordComparison('')).not.toThrow();
  });
});
