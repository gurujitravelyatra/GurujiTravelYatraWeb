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

/**
 * EXACT value, not "contains no-store". Next already sends
 * `private, no-cache, no-store, max-age=0, must-revalidate` on dynamic pages by
 * itself, so a substring check on `/admin/login` would pass with the config
 * rule deleted — measured, not assumed: that string is what `/tour-packages`
 * returns. `private, no-store` is only ever OUR value, so this proves the
 * config reached the response.
 */
function expectNoStore(response: APIResponse) {
  expect(response.headers()['cache-control']).toBe('private, no-store');
}

test.describe('security headers on real responses', () => {
  test('the home page carries the sitewide headers', async ({ request }) => {
    const response = await request.get('/', { maxRedirects: 0 });
    expect(response.status()).toBe(200);
    expectSitewideHeaders(response);
  });

  test('the admin rule does not leak onto the public site', async ({ request }) => {
    // `private, no-store` on the whole site would defeat every CDN and the
    // static prerender — the admin rule must stay scoped to admin paths.
    const response = await request.get('/', { maxRedirects: 0 });
    expect(response.status()).toBe(200);
    expect(response.headers()['cache-control'] ?? '').not.toMatch(/\bprivate\b/);
  });

  test('the /admin redirect issued by the proxy carries them too, and is not cacheable', async ({ request }) => {
    // Anonymous → `src/proxy.ts` answers with a redirect to the login page
    // before any page renders. The response most likely to miss a config header.
    const response = await request.get('/admin', { maxRedirects: 0 });
    expect([302, 303, 307, 308]).toContain(response.status());
    expect(response.headers()['location'] ?? '').toMatch(/\/admin\/login/);

    expectSitewideHeaders(response);
    expectNoStore(response);
  });

  test('the admin login page carries them, and is not cacheable', async ({ request }) => {
    const response = await request.get('/admin/login', { maxRedirects: 0 });
    expect(response.status()).toBe(200);

    expectSitewideHeaders(response);
    expectNoStore(response);
  });

  test('the admin upload API carries them on its 401, and is not cacheable', async ({ request }) => {
    const response = await request.post('/api/admin/uploads', {
      multipart: { kind: 'cover' },
      maxRedirects: 0,
      failOnStatusCode: false,
    });
    // 401 JSON, not a redirect — the route gates itself with `getAdminSession()`.
    expect(response.status()).toBe(401);

    expectSitewideHeaders(response);
    expectNoStore(response);
  });
});
