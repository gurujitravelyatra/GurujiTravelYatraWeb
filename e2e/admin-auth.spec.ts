import { expect, test, type Page } from '@playwright/test';

/**
 * Deliberately NOT imported from `src/server/auth/rate-limit.ts`, even though
 * that is where the real number lives: that module is marked `server-only`,
 * whose implementation is an unconditional `throw` outside React's
 * `react-server` condition, so importing it here would crash the spec file on
 * load.
 *
 * Duplicating the constant would then risk drift, so the test avoids depending
 * on the exact value at all — it retries up to this generous ceiling and asserts
 * only that a lockout eventually happens. Any threshold below the ceiling passes;
 * a limiter that never trips fails.
 */
const LOCKOUT_ATTEMPT_CEILING = 12;

/**
 * The `/admin` authentication gate, end to end, against the real standalone
 * production server.
 *
 * ## Two tiers, and why
 *
 * Everything that can be proved WITHOUT a valid credential runs unconditionally:
 * the redirects, the return-to round trip, the rejection of a wrong password, the
 * CSRF check, the absence of any public link. That is the majority of this file
 * and it is the half that guards the security property.
 *
 * The signed-in half needs a real account in a real database, so it reads
 * `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` from the environment and SKIPS when
 * they are absent. No credential is invented, checked in, or defaulted — a test
 * that silently passes because it made up a password would be worse than one
 * that says it did not run.
 *
 *   Create a throwaway account first, then run the suite:
 *     ADMIN_SEED_EMAIL="e2e@example.test" ADMIN_SEED_PASSWORD="<passphrase>" npm run db:seed:admin
 *     E2E_ADMIN_EMAIL="e2e@example.test" E2E_ADMIN_PASSWORD="<passphrase>" npx playwright test admin-auth
 */

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;
const HAS_CREDENTIALS = Boolean(ADMIN_EMAIL && ADMIN_PASSWORD);

/**
 * The login form's error banner, located by id rather than by `role="alert"`.
 *
 * `getByRole('alert')` looks like the right selector and is not: Next injects
 * its own `<div id="__next-route-announcer__" role="alert">` into every page, so
 * the role matches two elements and Playwright fails on strict mode — but only
 * AFTER a client-side navigation has occurred, which made it pass or fail
 * depending on test order.
 *
 * The banner keeps its `role="alert"` in the markup, because that is what makes
 * a screen reader announce the failure. This is purely about how the test
 * addresses it.
 */
function loginError(page: Page) {
  return page.locator('#admin-login-error');
}

/**
 * Playwright's 5s `expect` default is too tight for THIS assertion specifically,
 * and the reason is deliberate application behaviour rather than slowness worth
 * fixing.
 *
 * A rejected login is not a cheap request: `authorize()` runs bcrypt at cost 12,
 * and for an unknown email it ALSO runs `burnPasswordComparison()` — a second
 * full-cost hash, on purpose, so that "no such user" and "wrong password" take
 * the same time (see `src/server/auth/password.ts`). That is ~600ms of
 * deliberate CPU, and the first call of a run additionally generates the dummy
 * hash. With two Playwright workers and the rate-limit test submitting in a loop,
 * that crossed 5s and failed — then passed on a targeted re-run with no code
 * change, which is the signature of a timeout measuring machine load rather than
 * correctness.
 *
 * `jest.config.ts` carries the same note about the same class of false failure.
 */
const LOGIN_RESPONSE_TIMEOUT = 20_000;

test.describe('unauthenticated access to /admin', () => {
  test('/admin redirects to the login page', async ({ page }) => {
    await page.goto('/admin');

    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByRole('heading', { name: /staff sign-in/i })).toBeVisible();
  });

  test('a deep admin route redirects and remembers where you were going', async ({ page }) => {
    await page.goto('/admin/tours?page=2');

    await expect(page).toHaveURL(/\/admin\/login/);

    // The return-to path survives the detour, query string included. Without
    // this, a bookmarked deep link always dumps the user on the dashboard.
    const next = new URL(page.url()).searchParams.get('next');
    expect(next).toBe('/admin/tours?page=2');
  });

  test('the login page itself is reachable, and does not redirect', async ({ page }) => {
    const response = await page.goto('/admin/login');

    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  test('the dashboard never renders its content to an anonymous visitor', async ({ page }) => {
    await page.goto('/admin');

    // Not just "the URL changed" — assert the protected content itself never
    // reached the browser. A gate that redirects AFTER streaming the page has
    // already leaked it.
    await expect(page.locator('body')).not.toContainText('Content admin');
    await expect(page.locator('body')).not.toContainText('Signed in as');
  });
});

test.describe('login failures', () => {
  test('a wrong password shows an error and creates no session', async ({ page }) => {
    await page.goto('/admin/login');

    await page.getByLabel('Email').fill('definitely-not-a-real-admin@example.test');
    await page.getByLabel('Password').fill('definitely-not-the-right-password');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(loginError(page)).toBeVisible({ timeout: LOGIN_RESPONSE_TIMEOUT });

    // Still on the login page, and still shut out of the dashboard.
    await expect(page).toHaveURL(/\/admin\/login/);
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test('the error message does not reveal whether the account exists', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByLabel('Email').fill('nobody-here@example.test');
    await page.getByLabel('Password').fill('some-wrong-password-value');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for the banner before reading it — `textContent()` does not
    // auto-retry, so without this it can return null on a slow response and the
    // assertions below would pass vacuously against nothing.
    await expect(loginError(page)).toBeVisible({ timeout: LOGIN_RESPONSE_TIMEOUT });
    const message = await loginError(page).textContent();

    // Anything that distinguishes "no such user" from "wrong password" turns
    // this form into an account-enumeration oracle.
    expect(message).not.toMatch(/no such|not found|unknown (user|email|account)|does not exist/i);
    expect(message).not.toMatch(/incorrect password|wrong password/i);
  });

  test('no session cookie is issued for a failed login', async ({ page, context }) => {
    await page.goto('/admin/login');
    await page.getByLabel('Email').fill('nobody-here@example.test');
    await page.getByLabel('Password').fill('some-wrong-password-value');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(loginError(page)).toBeVisible({ timeout: LOGIN_RESPONSE_TIMEOUT });

    const cookies = await context.cookies();
    const session = cookies.find((cookie) => /session-token/.test(cookie.name));
    expect(session).toBeUndefined();
  });
});

test.describe('brute-force rate limiting', () => {
  test('locks out after repeated failures against one account, and says so', async ({ page }) => {
    /**
     * Drives the EMAIL bucket (`MAX_ATTEMPTS_PER_EMAIL` = 5), not the IP bucket.
     *
     * That is deliberate and it is the only way this test can coexist with the
     * rest of the suite: every Playwright worker connects from 127.0.0.1, so the
     * IP bucket is shared by every test in the run. An earlier version of this
     * file drove the IP dimension and locked out unrelated tests — which is the
     * same real-world flaw as an office NAT locking out twelve staff for one
     * colleague's typos, and is why the two dimensions now have very different
     * budgets (see `src/server/auth/rate-limit.ts`).
     *
     * A unique email per run keeps this test independent of any previous run's
     * leftover state.
     */
    const email = `ratelimit-${Date.now()}@example.test`;

    let sawLockout = false;

    /**
     * The page is RELOADED before every attempt, rather than re-submitting the
     * same rendered form in a loop.
     *
     * That is not tidiness. Submitting repeatedly without a reload silently drops
     * attempts: the submit button is `disabled` while the action is pending, and
     * consecutive fill/click pairs raced that state badly enough that six loop
     * iterations produced only four requests at the server. The test then failed
     * for looking like the limiter was broken when it was counting correctly —
     * server-side instrumentation showed failures reaching 4 and stopping.
     *
     * Reloading makes each attempt an independent page load and an independent
     * submission, which is also closer to what an attacker's script does.
     */
    for (let attempt = 0; attempt < LOCKOUT_ATTEMPT_CEILING; attempt += 1) {
      await page.goto('/admin/login');
      await page.getByLabel('Email').fill(email);
      await page.getByLabel('Password').fill(`wrong-password-attempt-${attempt}`);
      await page.getByRole('button', { name: /sign in/i }).click();
      await expect(loginError(page)).toBeVisible({ timeout: LOGIN_RESPONSE_TIMEOUT });

      const message = (await loginError(page).textContent()) ?? '';
      if (/too many/i.test(message)) {
        sawLockout = true;
        // The message must be actionable — "try again later" with no duration is
        // indistinguishable from a broken form.
        expect(message).toMatch(/minute/i);
        break;
      }
    }

    expect(sawLockout).toBe(true);
  });
});

test.describe('CSRF', () => {
  test('the credentials endpoint rejects a POST with no CSRF token', async ({ request }) => {
    // Straight at the HTTP endpoint, bypassing the form entirely — which is
    // precisely what a cross-site attacker would do. The unit test in
    // `src/server/auth/__tests__/csrf.test.ts` drives the same handler in
    // isolation; this one proves it is wired up in the deployed server.
    const response = await request.post('/api/auth/callback/credentials', {
      form: { email: 'anyone@example.test', password: 'anything-at-all-here' },
      maxRedirects: 0,
      failOnStatusCode: false,
    });

    const setCookie = response.headersArray().filter((h) => h.name.toLowerCase() === 'set-cookie');
    const issuedSession = setCookie.some(
      (h) => /session-token/.test(h.value) && !/Max-Age=0/.test(h.value)
    );

    expect(issuedSession).toBe(false);
  });
});

test.describe('search engines are told to stay out', () => {
  test('robots.txt disallows /admin and /api', async ({ request }) => {
    const response = await request.get('/robots.txt');
    expect(response.status()).toBe(200);

    const body = await response.text();
    expect(body).toMatch(/Disallow:\s*\/admin/);
    expect(body).toMatch(/Disallow:\s*\/api/);
  });

  test('the login page carries a noindex directive', async ({ page }) => {
    // robots.txt stops a crawler FETCHING the page; this stops one that reached
    // it from a link INDEXING it. Different cases, both needed.
    await page.goto('/admin/login');

    const robotsMeta = page.locator('meta[name="robots"]');
    await expect(robotsMeta).toHaveAttribute('content', /noindex/i);
  });
});

test.describe('signed in', () => {
  test.skip(
    !HAS_CREDENTIALS,
    'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run the signed-in checks. See the header of this file.'
  );

  test('correct credentials land on the dashboard and set a session', async ({ page, context }) => {
    await page.goto('/admin/login');
    await page.getByLabel('Email').fill(ADMIN_EMAIL!);
    await page.getByLabel('Password').fill(ADMIN_PASSWORD!);
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('heading', { name: /content admin/i })).toBeVisible();
    await expect(page.getByText(ADMIN_EMAIL!)).toBeVisible();

    const session = (await context.cookies()).find((cookie) => /session-token/.test(cookie.name));
    expect(session).toBeDefined();
    // The session cookie must not be readable by client-side JavaScript — that
    // is what keeps an XSS anywhere on the site from becoming a stolen session.
    expect(session?.httpOnly).toBe(true);
  });

  test('the return-to path is honoured after signing in', async ({ page }) => {
    // The full round trip: hit a deep route anonymously, get bounced, sign in,
    // and land back where you were headed rather than on the dashboard.
    await page.goto('/admin/login?next=%2Fadmin%3Ftab%3Dtours');
    await page.getByLabel('Email').fill(ADMIN_EMAIL!);
    await page.getByLabel('Password').fill(ADMIN_PASSWORD!);
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/admin\?tab=tours$/);
  });

  test('a hostile return-to is ignored, not followed', async ({ page }) => {
    // The open-redirect case, at the moment it is worth the most to an attacker:
    // immediately after the victim has proved their identity.
    await page.goto('/admin/login?next=https%3A%2F%2Fexample.com%2Fharvest');
    await page.getByLabel('Email').fill(ADMIN_EMAIL!);
    await page.getByLabel('Password').fill(ADMIN_PASSWORD!);
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL(/127\.0\.0\.1.*\/admin$/);
  });

  test('a signed-in visitor is bounced off the login page', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByLabel('Email').fill(ADMIN_EMAIL!);
    await page.getByLabel('Password').fill(ADMIN_PASSWORD!);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto('/admin/login');
    await expect(page).toHaveURL(/\/admin$/);
  });

  test('logging out ends the session and re-locks the dashboard', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByLabel('Email').fill(ADMIN_EMAIL!);
    await page.getByLabel('Password').fill(ADMIN_PASSWORD!);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/admin$/);

    await page.getByRole('button', { name: /log out/i }).click();
    await expect(page).toHaveURL(/\/admin\/login/);

    // And it is a real sign-out, not just a navigation.
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});
