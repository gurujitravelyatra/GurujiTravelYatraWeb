import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { encode } from '@auth/core/jwt';
import { expect, test, type APIRequest, type APIRequestContext } from '@playwright/test';

import { E2E_AUTH_SECRET, E2E_SERVER_SECRETS } from '../playwright.config';

/**
 * CSRF ON ADMIN MUTATIONS — verified against the running server, Phase D.
 *
 * Phase A verified NextAuth's own CSRF protection on `/api/auth/*`, i.e. on the
 * LOGIN post. That says nothing about the tour create/edit/publish/archive path,
 * which is a Next.js Server Action and does not go through NextAuth at all. This
 * file is that verification, and it is deliberately empirical: every claim below
 * was measured against a real server before it was written down.
 *
 * ## The problem this file had to solve first
 *
 * The obvious test — fire a cross-origin POST at an admin route and watch it fail
 * — proves nothing, because it fails for the WRONG reason. `src/proxy.ts`
 * bounces any unauthenticated request to `/admin/*` with a 307 to the login page
 * before Next's action handler ever sees it, so an anonymous forged request and
 * an anonymous honest one are indistinguishable (both 307). Measured; that is
 * exactly what happens.
 *
 * So the request has to be AUTHENTICATED for the CSRF layer to be observable at
 * all. That is what {@link sessionCookie} is for: this app's sessions are
 * stateless JWTs verified with no database lookup, so a token signed with the
 * test server's `AUTH_SECRET` is a real session. No seeded account, no
 * credential, no skipped suite.
 *
 * ## The shape of the proof: an A/B on one header
 *
 * Every test here sends the SAME authenticated POST twice and changes only the
 * `Origin` header. If the cross-origin one is refused and the same-origin one
 * succeeds, the origin check is doing real work — which a single failing request
 * can never establish.
 *
 * The action used is `logoutAction`, and not because logging out matters. It is
 * the one server action that needs no database, renders on every admin page, and
 * has an unambiguous success signal (a `Set-Cookie` that clears the session). A
 * tour mutation would need a seeded tour and a live database to show the same
 * thing about a mechanism that is not per-action. `admin-mutation-guards.test.ts`
 * carries the other half: that every tour mutation IS a server action behind
 * `requireAdminSession()`, and so is covered by the mechanism proved here.
 *
 * ## Measured results, recorded so a future change to them is visible
 *
 *   Origin: https://evil.example.com  → 500, session NOT cleared (action never ran)
 *   Origin: <the server's own>        → 303 to /admin/login, session cleared
 *   no Origin header at all           → 303 to /admin/login, session cleared
 *
 * That third row is a REAL GAP in Next's protection and is asserted here rather
 * than hidden: Next logs a warning and proceeds when `Origin` is absent, on the
 * reasoning that a handcrafted request carries no credentials the sender did not
 * already have. It is survivable here for a specific reason, which the cookie
 * test further down this file pins: the session cookie is `SameSite=Lax`, so
 * a browser mounting a genuine cross-site attack sends no cookie and the request
 * arrives anonymous — and a browser cannot omit `Origin` on a cross-origin POST
 * anyway. The layer that does not depend on any of that is the cookie.
 *
 * The honest summary, which the docs repeat rather than overclaim: **Next's
 * origin check is not what stops CSRF here.** It has two documented holes (no
 * `Origin`, and a spoofed `X-Forwarded-Host` matching a spoofed `Origin`),
 * neither reachable from a browser. What stops CSRF is `SameSite=Lax` plus
 * `requireAdminSession()` on every action; the origin check is defence in depth.
 *
 * ## The rest of this file
 *
 * Three more describes ride on the same minted-session machinery: the upload
 * route's own gate, the session-cookie policy the paragraph above leans on, and
 * a secret-leak check over page HTML, RSC payloads and the JavaScript chunks a
 * browser actually downloads. Each carries its own header.
 */

const EVIL_ORIGIN = 'https://evil.example.com';

/** Non-secure transport in the test server, so the cookie carries no `__Secure-` prefix. */
const SESSION_COOKIE = 'authjs.session-token';

/**
 * A valid admin session, minted rather than logged into. See the header.
 *
 * `sub` and `email` are the only two claims `getAdminSession()` reads, and it
 * requires both — a token with either missing is not a session.
 */
async function sessionCookie(): Promise<string> {
  const token = await encode({
    token: { sub: 'e2e-csrf-probe', email: 'csrf-probe@example.test' },
    secret: E2E_AUTH_SECRET,
    salt: SESSION_COOKIE,
    maxAge: 60 * 60,
  });

  return `${SESSION_COOKIE}=${token}`;
}

/** Reads a server action's ID out of the rendered page that hosts its form. */
function actionIdFrom(html: string): string | null {
  return html.match(/\$ACTION_ID_([0-9a-f]+)/)?.[1] ?? null;
}

/**
 * Posts the given server action, varying only `Origin`.
 *
 * `multipart` and not `form`: Next 16 does not support URL-encoded server
 * actions at all (it bails out of the action handler for them), so a urlencoded
 * body would be a test of nothing. That refusal is itself asserted below.
 */
async function postAction(
  request: APIRequestContext,
  { path, actionId, cookie, origin }: { path: string; actionId: string; cookie: string; origin?: string }
) {
  return request.post(path, {
    headers: { cookie, ...(origin ? { origin } : {}) },
    multipart: { [`$ACTION_ID_${actionId}`]: '' },
    maxRedirects: 0,
    failOnStatusCode: false,
  });
}

/** Did the response clear the session cookie? The success signal for `logoutAction`. */
function clearedTheSession(headers: { name: string; value: string }[]): boolean {
  return headers
    .filter((header) => header.name.toLowerCase() === 'set-cookie')
    .some(
      (header) =>
        header.value.includes(SESSION_COOKIE) &&
        (/Max-Age=0/i.test(header.value) || /Expires=Thu, 01 Jan 1970/i.test(header.value))
    );
}

test.describe('Server Action CSRF', () => {
  let cookie: string;
  let actionId: string;

  test.beforeEach(async ({ request }) => {
    cookie = await sessionCookie();

    const page = await request.get('/admin', { headers: { cookie }, failOnStatusCode: false });

    // A clear failure rather than a confusing one: if the minted token did not
    // authenticate, the server is running on a different AUTH_SECRET and every
    // assertion below would fail for that reason instead of a security one.
    expect(
      page.status(),
      `/admin did not accept a minted session. The server under test must run with AUTH_SECRET=${E2E_AUTH_SECRET} (playwright.config.ts sets it; a manually started server may not).`
    ).toBe(200);

    const id = actionIdFrom(await page.text());
    expect(id, 'no server action ID found on /admin — the logout form should render one').not.toBeNull();
    actionId = id!;
  });

  test('a forged cross-origin POST is refused and the action never runs', async ({ request }) => {
    const response = await postAction(request, { path: '/admin', actionId, cookie, origin: EVIL_ORIGIN });

    // Next aborts with "Invalid Server Actions request." before decoding the
    // action, which surfaces as a 500 for a non-fetch (MPA) submission.
    expect(response.status()).toBe(500);

    // The assertion that actually matters. A status code says the response was
    // an error; this says the SIDE EFFECT did not happen.
    expect(clearedTheSession(response.headersArray())).toBe(false);
  });

  test('the identical POST from our own origin succeeds — so the refusal was about the origin', async ({
    request,
  }, testInfo) => {
    const origin = new URL(testInfo.project.use.baseURL!).origin;
    const response = await postAction(request, { path: '/admin', actionId, cookie, origin });

    expect(response.status()).toBe(303);
    expect(response.headers()['location']).toContain('/admin/login');
    expect(clearedTheSession(response.headersArray())).toBe(true);
  });

  /**
   * DOCUMENTING A KNOWN GAP, not endorsing it.
   *
   * Next lets a request with no `Origin` header through with a logged warning.
   * Asserting the real behaviour means a future Next release that closes the gap
   * fails this test and gets the note updated, instead of the note quietly
   * describing a version nobody runs any more.
   *
   * Why it is not exploitable from a browser: a cross-origin POST always carries
   * `Origin` (the sender cannot suppress it), and a same-origin POST is not a
   * CSRF. A non-browser client can omit it, but it must then supply the session
   * cookie itself — at which point it already has the session and CSRF is not
   * the relevant threat.
   */
  test('an Origin-less POST is let through by Next — covered by SameSite, not by this check', async ({
    request,
  }) => {
    const response = await postAction(request, { path: '/admin', actionId, cookie });

    expect(response.status()).toBe(303);
    expect(clearedTheSession(response.headersArray())).toBe(true);
  });

  /**
   * The classic CSRF vehicle is `<form method="POST">` on an attacker's page,
   * which sends `application/x-www-form-urlencoded` and cannot set headers. Next
   * 16 refuses to treat a urlencoded POST as a server action at all, so that
   * vehicle cannot reach an action regardless of origin. Asserted because it is
   * load-bearing and undocumented in the app.
   */
  test('a urlencoded cross-origin form POST cannot invoke an action at all', async ({ request }) => {
    const response = await request.post('/admin', {
      headers: { cookie, origin: EVIL_ORIGIN },
      form: { [`$ACTION_ID_${actionId}`]: '', slug: 'spiti-valley-circuit', publish: 'true' },
      maxRedirects: 0,
      failOnStatusCode: false,
    });

    expect(clearedTheSession(response.headersArray())).toBe(false);
  });
});

test.describe('the upload route answers for itself', () => {
  /**
   * Phase C's report claimed both properties; this re-verifies them against the
   * running server rather than trusting the report. `src/proxy.ts` matches
   * `/admin` and `/admin/:path*` only, so nothing upstream is protecting this
   * path — the route's own checks are the whole gate.
   */
  test('refuses an upload with no session, as JSON rather than a redirect', async ({ request }) => {
    const response = await request.post('/api/admin/uploads', {
      multipart: { kind: 'cover' },
      maxRedirects: 0,
      failOnStatusCode: false,
    });

    expect(response.status()).toBe(401);
    // A 307 to an HTML login page would arrive at a `fetch()` expecting JSON and
    // surface to the admin as a parse error instead of "sign in again".
    expect(response.headers()['content-type']).toContain('application/json');
    expect(await response.json()).toMatchObject({ error: expect.stringMatching(/session/i) });
  });

  test('refuses a cross-site upload even WITH a valid session', async ({ request }) => {
    const response = await request.post('/api/admin/uploads', {
      headers: { cookie: await sessionCookie(), origin: EVIL_ORIGIN, 'sec-fetch-site': 'cross-site' },
      multipart: { kind: 'cover' },
      maxRedirects: 0,
      failOnStatusCode: false,
    });

    expect(response.status()).toBe(403);
    // Message reworded by M3 (2026-09-19): the refusal now covers more than
    // `cross-site`, so it no longer names that one value.
    expect(await response.json()).toMatchObject({ error: expect.stringMatching(/admin interface on this site/i) });
  });

  /**
   * M3 of the 2026-09-19 review, against the real server. The route used to
   * refuse ONLY `sec-fetch-site: cross-site`, and called `same-site` fine — but
   * a sibling subdomain is `same-site`, and `SameSite=Lax` sends it the cookie.
   */
  for (const [label, headers] of [
    ['a same-site (sibling subdomain) request', { 'sec-fetch-site': 'same-site' }],
    ['a sibling subdomain named in Origin', { origin: 'https://staging.127.0.0.1.nip.io' }],
    ['a same-origin claim contradicted by a foreign Origin', { 'sec-fetch-site': 'same-origin', origin: EVIL_ORIGIN }],
  ] as const) {
    test(`refuses ${label} even WITH a valid session`, async ({ request }) => {
      const response = await request.post('/api/admin/uploads', {
        headers: { cookie: await sessionCookie(), ...headers },
        multipart: { kind: 'cover' },
        maxRedirects: 0,
        failOnStatusCode: false,
      });

      expect(response.status()).toBe(403);
    });
  }

  test('does NOT refuse a same-origin request with a valid session on origin grounds', async ({ request }) => {
    // Guard the guard: the three refusals above pass just as well if the route
    // 403s everything. With a valid session and a same-origin claim the request
    // must get PAST the origin policy — here it then fails on the missing file
    // (400) or the unconfigured Cloudinary account (503), never 403.
    const response = await request.post('/api/admin/uploads', {
      headers: { cookie: await sessionCookie(), 'sec-fetch-site': 'same-origin' },
      multipart: { kind: 'cover' },
      maxRedirects: 0,
      failOnStatusCode: false,
    });

    expect([400, 503]).toContain(response.status());
  });
});

test.describe('session cookie policy', () => {
  /**
   * The layer everything above leans on, asserted on the REAL `Set-Cookie` this
   * deployment emits rather than on the config that is supposed to produce it.
   *
   * `/api/auth/csrf` is used because it needs no credential and is served by the
   * same Auth.js cookie machinery as the session token — the attributes come
   * from one `defaultCookies()` call, so what is true here is true of the
   * session cookie. (`admin-auth.spec.ts` asserts `httpOnly` on a real session
   * cookie in its credential-gated half.)
   *
   * `SameSite=None` is the specific regression this guards: it is what someone
   * reaches for when an embed or a third-party iframe does not work, and it
   * silently turns every admin server action into a CSRF target.
   */
  test('Auth.js cookies are SameSite=Lax and HttpOnly on the wire', async ({ request }) => {
    const response = await request.get('/api/auth/csrf');
    expect(response.status()).toBe(200);

    const cookies = response
      .headersArray()
      .filter((header) => header.name.toLowerCase() === 'set-cookie')
      .map((header) => header.value);

    expect(cookies.length).toBeGreaterThan(0);
    for (const cookie of cookies) {
      expect(cookie).toMatch(/SameSite=Lax/i);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).not.toMatch(/SameSite=None/i);
    }
  });
});

/**
 * NOTHING SENSITIVE REACHES THE CLIENT — Phase D.
 *
 * ## The failure this section is built to avoid
 *
 * Its first version read `process.env` inside the test and asserted that nothing
 * in it appeared in a response. It was green, and it proved NOTHING: the
 * Playwright runner is a separate process that loads no `.env`, so the list came
 * back empty and the loop ran zero comparisons. Everything below is shaped by
 * that: each assertion is either (a) unconditional — a pattern that needs no
 * list — or (b) over a value the suite can show is really present, and there is
 * an explicit gate that fails if the list is short or the server is not the one
 * this config describes.
 *
 * ## What "present" means here, precisely
 *
 * `E2E_SERVER_SECRETS` in `playwright.config.ts` is spread into the server's
 * environment and imported by this file, so the same literal is on both sides by
 * construction. `AUTH_SECRET` is additionally PROVEN present at runtime: a
 * session token minted with it is accepted by `/admin` only if the server is
 * verifying against those exact bytes. That handshake runs first, and every test
 * in this section depends on it.
 *
 * ## What is scanned
 *
 * Page HTML is the obvious surface and the least likely one. The two that
 * actually catch real mistakes are included alongside it:
 *
 *  - **The RSC payload** embedded in each admin page — where a `session()`
 *    callback that spread the whole JWT would deposit a password hash.
 *  - **The JavaScript chunks**, fetched and scanned for real. This is the leak
 *    mode Next.js actually has: a value read into a Client Component, or renamed
 *    to `NEXT_PUBLIC_*` "so it works in the browser", is INLINED into a static
 *    chunk at build time. It never appears in any HTML, no page renders it, and
 *    it is served to every visitor from the CDN forever.
 */
test.describe('nothing sensitive reaches the client', () => {
  /**
   * Every literal that must not appear anywhere a client can see.
   *
   * Two sources, for two different reasons:
   *
   *  1. `E2E_SERVER_SECRETS` — planted, so the list can never be empty and each
   *     value stands for a class of secret (session key, third-party credential,
   *     outbound API key). See that object's header.
   *  2. `.env` on disk, when present — the REAL values this checkout holds,
   *     which on a developer machine is the live database connection string.
   *     Best-effort by nature (a cold checkout has no `.env`), which is exactly
   *     why it is additive to (1) rather than the basis of the check.
   *
   * Parsed by hand rather than by adding `dotenv`: this needs `KEY=value` and
   * nothing else, and a dependency to read one line would be the larger change.
   */
  const SECRETS: string[] = [
    ...Object.values(E2E_SERVER_SECRETS),
    ...(() => {
      let contents = '';
      try {
        contents = readFileSync(join(__dirname, '..', '.env'), 'utf8');
      } catch {
        return [] as string[];
      }

      return contents
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith('#') && line.includes('='))
        .map((line) =>
          line
            .slice(line.indexOf('=') + 1)
            .trim()
            .replace(/^["']|["']$/g, '')
        )
        .filter((value) => value.length > 12);
    })(),
  ];

  /**
   * Patterns that need no list and so cannot go vacuous — the shape of a secret
   * rather than a particular one. These are what would still be checking
   * something if `E2E_SERVER_SECRETS` were emptied by a bad merge.
   */
  const SHAPES: { name: string; pattern: RegExp }[] = [
    // bcrypt's two format prefixes, which is what `AdminUser.passwordHash` is.
    { name: 'a bcrypt hash', pattern: /\$2[aby]\$\d{2}\$/ },
    // The column name itself: it reaches a response only by being selected into
    // something that got serialised.
    { name: 'the passwordHash field name', pattern: /passwordHash/i },
    // A connection string carrying credentials.
    { name: 'a credentialed postgres URL', pattern: /postgres(ql)?:\/\/[^\s"'`]*:[^\s"'`]*@/i },
    // The env var name appearing in shipped output means the value was read
    // somewhere a bundler could inline it.
    { name: 'an inlined AUTH_SECRET reference', pattern: /AUTH_SECRET["'\s]*[:=]/ },
  ];

  /**
   * Reported as a BOOLEAN, never by passing the secret to `expect().not.toContain()`.
   *
   * The difference matters on the day this fails: `toContain` prints both the
   * needle and the haystack, so the run that DISCOVERED the database password
   * was leaking would write that password into the test report, the CI log and
   * the artifact bundle. This form prints the surface and `leaked: true`, which
   * is everything anyone needs to act, and nothing they need to rotate.
   */
  function scan(surface: string, body: string) {
    for (const [index, secret] of SECRETS.entries()) {
      expect({ surface, secretIndex: index, leaked: body.includes(secret) }).toEqual({
        surface,
        secretIndex: index,
        leaked: false,
      });
    }

    for (const { name, pattern } of SHAPES) {
      expect({ surface, looksLike: name, found: pattern.test(body) }).toEqual({
        surface,
        looksLike: name,
        found: false,
      });
    }
  }

  /**
   * A REQUEST CONTEXT WITH NO COOKIE JAR, one per call.
   *
   * This is not fastidiousness; without it this section silently tested the
   * wrong page, and the bug is worth recording because nothing about it is
   * visible in a passing run:
   *
   * Playwright's `request` fixture keeps a cookie jar. Auth.js re-issues the
   * session cookie on every authenticated request (7-day SLIDING sessions), so
   * the `Set-Cookie` from the handshake below lands in that jar and every later
   * request in the same test is authenticated — including the ones meant to be
   * anonymous. `/admin/login` then 307s to `/admin` (`decideAdminRoute` sends a
   * signed-in admin away from the login page), `request.get` follows it, and the
   * body scanned under the name "/admin/login" is actually the dashboard.
   *
   * It was caught by a deliberate leak on `/admin/login` that the test did not
   * see, which is the only way this class of bug ever surfaces. Hence also the
   * `maxRedirects: 0` + status-200 assertion in the scans: they prove the body
   * that was read is the URL that was named.
   */
  function anonymous(playwright: APIRequest, baseURL: string) {
    return playwright.newContext({ baseURL });
  }

  /**
   * THE GATE. Proves the server under test is the one this config describes,
   * before anything below claims its secrets do not leak.
   *
   * Without it, a server started on a different `AUTH_SECRET` (or with no
   * sentinels at all) would sail through every assertion below — none of those
   * strings would be in its environment, so of course none of them appears in
   * its output. That is the vacuum this whole section was rewritten to close, so
   * it is asserted rather than assumed.
   *
   * Runs in its own throwaway context for the reason in {@link anonymous}: this
   * is the request that mints the polluting cookie.
   */
  async function expectServerHoldsTheSentinels(
    playwright: APIRequest,
    baseURL: string
  ) {
    const context = await anonymous(playwright, baseURL);
    try {
      const response = await context.get('/admin', {
        headers: { cookie: await sessionCookie() },
        failOnStatusCode: false,
      });

      expect(
        response.status(),
        'The server under test is NOT running on E2E_SERVER_SECRETS, so every leak assertion in this file would be vacuous. Restart it with the environment documented in playwright.config.ts.'
      ).toBe(200);
    } finally {
      await context.dispose();
    }
  }

  test('the sentinel list is real, and the server really holds it', async ({ playwright, baseURL }) => {
    // Guards the guard, three times over: a list that is at least as long as the
    // planted set (an empty one would make every loop below run zero times), no
    // trivially-short entry that could match by accident, and a server that
    // demonstrably holds the highest-value entry.
    expect(SECRETS.length).toBeGreaterThanOrEqual(Object.keys(E2E_SERVER_SECRETS).length);
    expect(Object.keys(E2E_SERVER_SECRETS).length).toBeGreaterThan(0);
    expect(SECRETS.every((secret) => secret.length > 12)).toBe(true);

    await expectServerHoldsTheSentinels(playwright.request, baseURL!);
  });

  for (const path of ['/', '/tour-packages', '/admin/login', '/api/tours']) {
    test(`${path} leaks no secret and no password hash`, async ({ playwright, baseURL }) => {
      await expectServerHoldsTheSentinels(playwright.request, baseURL!);

      const context = await anonymous(playwright.request, baseURL!);
      const response = await context.get(path, { maxRedirects: 0, failOnStatusCode: false });

      // Proves the body below is this URL's, not a redirect target's. See
      // `anonymous()` for the bug this catches.
      expect({ path, status: response.status() }).toEqual({ path, status: 200 });

      const body = await response.text();
      expect(body.length).toBeGreaterThan(0);

      scan(path, body);
      await context.dispose();
    });
  }

  test('an authenticated admin page leaks nothing either, RSC payload included', async ({
    playwright,
    baseURL,
  }) => {
    await expectServerHoldsTheSentinels(playwright.request, baseURL!);

    const context = await anonymous(playwright.request, baseURL!);
    const cookie = await sessionCookie();
    const response = await context.get('/admin', {
      headers: { cookie },
      maxRedirects: 0,
      failOnStatusCode: false,
    });
    expect(response.status()).toBe(200);

    const body = await response.text();
    scan('/admin', body);

    // The session is serialised into this page's RSC payload, so a `session()`
    // callback that spread the whole token lands right here — and the flight
    // data is in this same string, which is why scanning the raw text rather
    // than the DOM is the point.
    expect(body).toContain('self.__next_f');

    // The session token itself is HttpOnly and must never be echoed into the
    // document where script could read it back.
    expect(body).not.toContain(cookie.slice(SESSION_COOKIE.length + 1));

    await context.dispose();
  });

  /**
   * THE SURFACE THAT ACTUALLY CATCHES THINGS.
   *
   * A server-side secret does not leak by being printed on a page — someone has
   * to do that deliberately. It leaks by being read in a module that ends up in
   * the client graph, or by being renamed `NEXT_PUBLIC_*` to make an import
   * work, at which point the bundler INLINES the literal into a static chunk.
   * No page shows it, no HTML contains it, and it is served to every visitor
   * from the CDN with a one-year cache header.
   *
   * So the chunks are fetched and read. Discovered from the rendered pages
   * rather than from `.next/` on disk, because what is referenced by a page is
   * what a browser downloads — and because reading the build directory would
   * make this a test of the filesystem instead of a test of the deployment.
   */
  test('the JavaScript bundles served to a browser contain no secret', async ({ playwright, baseURL }) => {
    await expectServerHoldsTheSentinels(playwright.request, baseURL!);

    const cookie = await sessionCookie();
    const context = await anonymous(playwright.request, baseURL!);

    const pages: string[] = [];
    for (const [path, headers] of [
      ['/', {}],
      ['/tour-packages', {}],
      ['/admin/login', {}],
      // The only one that needs the session — and it goes last, in its own
      // request, with the cookie passed explicitly rather than left in a jar.
      ['/admin', { cookie }],
    ] as const) {
      const response = await context.get(path, { headers, maxRedirects: 0, failOnStatusCode: false });
      expect({ path, status: response.status() }).toEqual({ path, status: 200 });
      pages.push(await response.text());
    }

    const chunks = new Set<string>();
    for (const html of pages) {
      for (const match of html.matchAll(/\/_next\/static\/[^"'\s)\\]+?\.js/g)) {
        chunks.add(match[0]);
      }
    }

    // Guards the guard: a regex that stopped matching would turn this into a
    // test that fetches nothing and passes. The admin area alone ships more
    // than this.
    expect(chunks.size).toBeGreaterThan(5);

    for (const chunk of chunks) {
      const response = await context.get(chunk, { failOnStatusCode: false });
      expect({ chunk, status: response.status() }).toEqual({ chunk, status: 200 });
      scan(chunk, await response.text());
    }

    await context.dispose();
  });
});
