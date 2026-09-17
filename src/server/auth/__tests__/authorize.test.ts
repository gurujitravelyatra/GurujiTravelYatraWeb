/**
 * @jest-environment node
 */

/**
 * The credentials `authorize()` callback — the function that decides whether a
 * password is correct.
 *
 * The database layer is mocked so these can assert the DECISION logic exhaustively
 * without a Postgres connection (the whole suite runs with `DATABASE_URL` unset —
 * see `src/content/content-adapter.ts`). What is NOT mocked is bcrypt: the hashes
 * below are real, produced by the real `hashPassword`, so a change that broke
 * verification would fail here rather than passing against a stub that always
 * returns true.
 */

const findAdminUserForLogin = jest.fn();
const recordAdminLogin = jest.fn();

jest.mock('../admin-user', () => ({
  findAdminUserForLogin: (...args: unknown[]) => findAdminUserForLogin(...args),
  recordAdminLogin: (...args: unknown[]) => recordAdminLogin(...args),
  normalizeAdminEmail: (email: string) => email.trim().toLowerCase(),
}));

import { hashPassword } from '../password';

const PASSWORD = 'a-real-test-passphrase-long-enough';
const KNOWN_USER = {
  id: 'admin_1',
  email: 'owner@gty.com',
  passwordHash: hashPassword(PASSWORD),
};

/**
 * `authorizeAdminCredentials` is the exact function object `auth.ts` hands to the
 * Credentials provider as its `authorize` callback — not a copy of it. So these
 * tests exercise the code path that runs in production, and deleting the provider
 * wiring would be caught by the E2E login test rather than silently passing here.
 */
import { authorizeAdminCredentials } from '../authorize';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('authorizeAdminCredentials', () => {
  it('returns the user for correct credentials', async () => {
    findAdminUserForLogin.mockResolvedValue(KNOWN_USER);

    await expect(
      authorizeAdminCredentials({ email: 'owner@gty.com', password: PASSWORD })
    ).resolves.toEqual({ id: 'admin_1', email: 'owner@gty.com' });
  });

  it('NEVER returns the password hash', async () => {
    findAdminUserForLogin.mockResolvedValue(KNOWN_USER);

    const result = await authorizeAdminCredentials({
      email: 'owner@gty.com',
      password: PASSWORD,
    });

    // The hash must stop at this boundary. Anything returned here flows into the
    // JWT and from there into `session.user`, which server components render.
    expect(result).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(result)).not.toContain('$2b$');
  });

  it('rejects a wrong password for a known user', async () => {
    findAdminUserForLogin.mockResolvedValue(KNOWN_USER);

    await expect(
      authorizeAdminCredentials({ email: 'owner@gty.com', password: 'wrong-password-here' })
    ).resolves.toBeNull();
  });

  it('rejects an unknown email', async () => {
    findAdminUserForLogin.mockResolvedValue(null);

    await expect(
      authorizeAdminCredentials({ email: 'nobody@gty.com', password: PASSWORD })
    ).resolves.toBeNull();
  });

  it('still spends a password comparison on an unknown email', async () => {
    // The anti-enumeration property. Both branches must cost comparable time, so
    // "does this address exist" cannot be answered with a stopwatch.
    findAdminUserForLogin.mockResolvedValue(null);

    const start = Date.now();
    await authorizeAdminCredentials({ email: 'nobody@gty.com', password: PASSWORD });
    const unknownMs = Date.now() - start;

    // bcrypt cost 12 under bcryptjs is comfortably over 50ms. A short-circuit
    // return would come back in single-digit milliseconds.
    expect(unknownMs).toBeGreaterThan(50);
  });

  it.each([
    ['missing password', { email: 'owner@gty.com' }],
    ['missing email', { password: PASSWORD }],
    ['empty password', { email: 'owner@gty.com', password: '' }],
    ['malformed email', { email: 'not-an-email', password: PASSWORD }],
    ['non-string password', { email: 'owner@gty.com', password: 12345 }],
    ['null credentials', null],
    ['undefined credentials', undefined],
  ])('rejects %s without hitting the database', async (_label, credentials) => {
    // Validation happens before the lookup, so a malformed POST straight at the
    // HTTP callback cannot cost a query.
    await expect(authorizeAdminCredentials(credentials)).resolves.toBeNull();
    expect(findAdminUserForLogin).not.toHaveBeenCalled();
  });

  it('rejects an absurdly long password without hashing it', async () => {
    // DoS guard. bcrypt truncates at 72 bytes, so nothing beyond the cap can
    // change the outcome — but without a cap, a megabyte of "password" is free
    // CPU for an attacker.
    await expect(
      authorizeAdminCredentials({ email: 'owner@gty.com', password: 'x'.repeat(100_000) })
    ).resolves.toBeNull();
    expect(findAdminUserForLogin).not.toHaveBeenCalled();
  });

  it('accepts an email with surrounding whitespace and still finds the user', async () => {
    findAdminUserForLogin.mockResolvedValue(KNOWN_USER);

    // Browsers and password managers routinely autofill a trailing space, and a
    // copy-pasted address almost always carries one. Rejecting that would show
    // the user "not recognised" for something invisible to them — so the schema
    // trims BEFORE validating. This test is why that ordering exists.
    await expect(
      authorizeAdminCredentials({ email: '  Owner@GTY.com  ', password: PASSWORD })
    ).resolves.toEqual({ id: 'admin_1', email: 'owner@gty.com' });

    expect(findAdminUserForLogin).toHaveBeenCalledTimes(1);
    expect(findAdminUserForLogin).toHaveBeenCalledWith('Owner@GTY.com');
  });

  it('refuses when the user lookup fails entirely', async () => {
    // `findAdminUserForLogin` already converts a database outage into `null`
    // rather than throwing. This asserts the consequence: an outage is a refusal,
    // never a pass.
    findAdminUserForLogin.mockResolvedValue(null);

    await expect(
      authorizeAdminCredentials({ email: 'owner@gty.com', password: PASSWORD })
    ).resolves.toBeNull();
  });
});
