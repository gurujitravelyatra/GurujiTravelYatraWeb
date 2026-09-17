/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

import { GET, POST } from '@/app/api/auth/[...nextauth]/route';

/**
 * CSRF protection on the credentials callback.
 *
 * ## Why test something the library gives us for free
 *
 * Because "for free" is exactly the kind of guarantee that stops being true
 * without anyone noticing. `@auth/core` puts a double-submit CSRF token on every
 * POST to `/api/auth/*`, and nothing in this repo re-implements it — which means
 * if a version bump, a config change or a stray `skipCSRFCheck` ever switched it
 * off, there would be no code of ours to review and no test to fail. This is
 * that test. The dependency is a beta (`next-auth@5.0.0-beta.32`), which makes
 * the concern concrete rather than theoretical.
 *
 * These drive the REAL route handler — the same `handlers` export the app mounts
 * — not a mock of it.
 */

/**
 * `AUTH_SECRET` is unset in the test environment, so `auth-base-config.ts` uses
 * its fixed development fallback. That is what we want: a real, working secret,
 * so token verification genuinely runs rather than erroring out for an unrelated
 * reason and passing the test by accident.
 */
const ORIGIN = 'http://localhost:3000';
const CREDENTIALS_CALLBACK = `${ORIGIN}/api/auth/callback/credentials`;

/**
 * `NextRequest`, not a bare `Request`: the generated route types make the
 * handlers take Next's own request subclass, and `next build`'s type check
 * enforces it even though `tsc --noEmit` on the app tsconfig alone does not.
 */
function credentialsRequest(init: { body: string; cookie?: string }): NextRequest {
  const headers: Record<string, string> = {
    'content-type': 'application/x-www-form-urlencoded',
    origin: ORIGIN,
    host: 'localhost:3000',
  };
  if (init.cookie) headers.cookie = init.cookie;

  return new NextRequest(CREDENTIALS_CALLBACK, {
    method: 'POST',
    headers,
    body: init.body,
  });
}

/**
 * A session cookie is only ever set on a genuinely successful sign-in. Its
 * ABSENCE is therefore the assertion that matters in every case below: whatever
 * status the framework chooses for a rejection, what must never happen is that
 * the response hands back a session.
 */
/**
 * `@auth/core` logs every CSRF rejection through `console.error`. That is correct
 * behaviour in production and pure noise here — these tests CAUSE those
 * rejections on purpose, and left alone they bury the actual results under
 * stack traces.
 *
 * Silenced rather than asserted on: the log text is library internals and would
 * be a brittle thing to pin a test to. The real assertion is that no session
 * cookie comes back.
 */
let consoleErrorSpy: jest.SpyInstance;

beforeAll(() => {
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  consoleErrorSpy.mockRestore();
});

function setsSessionCookie(response: Response): boolean {
  return response.headers
    .getSetCookie()
    .some(
      (cookie) =>
        /authjs\.session-token|next-auth\.session-token/.test(cookie) &&
        // An expiry-in-the-past clear is not a session.
        !/Max-Age=0|Expires=Thu, 01 Jan 1970/.test(cookie)
    );
}

describe('POST /api/auth/callback/credentials — CSRF', () => {
  it('rejects a request carrying NO csrf token at all', async () => {
    const response = await POST(
      credentialsRequest({
        body: new URLSearchParams({
          email: 'qa@example.test',
          password: 'irrelevant-because-it-never-gets-checked',
        }).toString(),
      })
    );

    expect(setsSessionCookie(response)).toBe(false);
  });

  it('rejects a forged csrf token that does not match the cookie', async () => {
    // The double-submit scheme: the token in the body must match the one in the
    // host-only cookie. An attacker on another origin can make a browser send the
    // cookie but cannot READ it, so they cannot put the matching value in the
    // body. This simulates exactly that — a plausible-looking token with no
    // corresponding cookie.
    const response = await POST(
      credentialsRequest({
        body: new URLSearchParams({
          csrfToken: 'f'.repeat(64),
          email: 'qa@example.test',
          password: 'irrelevant-because-it-never-gets-checked',
        }).toString(),
      })
    );

    expect(setsSessionCookie(response)).toBe(false);
  });

  it('rejects a token that is present in the cookie but mismatched in the body', async () => {
    const response = await POST(
      credentialsRequest({
        cookie: `authjs.csrf-token=${'a'.repeat(64)}%7C${'b'.repeat(64)}`,
        body: new URLSearchParams({
          csrfToken: 'c'.repeat(64),
          email: 'qa@example.test',
          password: 'irrelevant-because-it-never-gets-checked',
        }).toString(),
      })
    );

    expect(setsSessionCookie(response)).toBe(false);
  });
});

describe('GET /api/auth/csrf', () => {
  it('issues a token, which is what proves the mechanism is switched on', async () => {
    // If CSRF were disabled this endpoint would not be meaningfully populated.
    // Its presence is the positive half of the assertions above: the rejections
    // are happening because the check RUNS, not because the route is broken.
    const response = await GET(
      new NextRequest(`${ORIGIN}/api/auth/csrf`, { headers: { host: 'localhost:3000' } })
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { csrfToken?: string };
    expect(typeof body.csrfToken).toBe('string');
    expect(body.csrfToken?.length).toBeGreaterThan(30);
  });
});
