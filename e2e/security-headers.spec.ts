import { expect, test, type APIResponse } from '@playwright/test';

/**
 * Security response headers — M10 of the 2026-09-19 independent review.
 *
 * Asserted on REAL responses from the standalone production server, because a
 * `headers()` entry in `next.config.ts` is a request for headers, not proof of
 * them: route order, a proxy (`src/proxy.ts`) short-circuiting with a redirect,
 * or Next's own `Cache-Control` for a route type can each mean the header never
 * reaches the wire. Every check below first asserts the STATUS, so it is known
 * which response was examined (see `memory/feedback_qg_vacuous-guard-test.md`:
 * a header scan of the wrong response is green and worthless).
 */

const SITEWIDE: Record<string, RegExp> = {
  'x-content-type-options': /^nosniff$/i,
  'referrer-policy': /^strict-origin-when-cross-origin$/i,
  'x-frame-options': /^DENY$/i,
  'content-security-policy': /frame-ancestors 'none'/,
};

function expectSitewideHeaders(response: APIResponse) {
  const headers = response.headers();
  // Guard the guard: a literal count, so an emptied table cannot pass.
  expect(Object.keys(SITEWIDE)).toHaveLength(4);
  for (const [name, pattern] of Object.entries(SITEWIDE)) {
    expect({ name, value: headers[name] ?? null }).toEqual({ name, value: expect.stringMatching(pattern) });
  }
}

test.describe('security headers on real responses', () => {
  test('the home page carries the sitewide headers', async ({ request }) => {
    const response = await request.get('/', { maxRedirects: 0 });
    expect(response.status()).toBe(200);
    expectSitewideHeaders(response);
  });

  /**
   * CRM-migration Step 5: the admin CMS, its `private, no-store` rule
   * (`next.config.ts`'s old `ADMIN_NO_STORE`) and the proxy that issued a
   * redirect for it (`src/proxy.ts`) are all deleted — there is no admin
   * surface left for a caching rule to leak off of, or onto. `/admin` itself
   * is covered by `e2e/home.spec.ts`'s "no longer exists" test; this file
   * stays scoped to headers on routes that still exist.
   */
  test('the sitewide headers apply uniformly — no admin-only caching rule remains to leak or to scope', async ({
    request,
  }) => {
    const response = await request.get('/', { maxRedirects: 0 });
    expect(response.status()).toBe(200);
    expect(response.headers()['cache-control'] ?? '').not.toMatch(/\bprivate\b/);
  });
});
