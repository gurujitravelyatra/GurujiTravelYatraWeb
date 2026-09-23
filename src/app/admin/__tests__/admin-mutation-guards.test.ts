/**
 * @jest-environment node
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { authBaseConfig } from '@/server/auth/auth-base-config';

/**
 * CSRF and authorization on ADMIN MUTATIONS — Phase D.
 *
 * Phase A verified NextAuth's own CSRF protection on `/api/auth/*` (the login
 * POST). That says nothing about the tour create/edit/publish/archive path,
 * which does not go through NextAuth at all. This file, plus the
 * `admin-csrf.spec.ts` end-to-end suite, is that verification.
 *
 * ## What actually protects a tour mutation, in order
 *
 * Every tour mutation is a Next.js SERVER ACTION. Three independent things have
 * to fail before a forged cross-site request can change a tour:
 *
 *  1. **The session cookie is `SameSite=Lax`.** A cross-site POST therefore
 *     carries no cookie at all, arrives unauthenticated, and
 *     `requireAdminSession()` redirects it to the login page before the action
 *     reads a single field. This is the layer that does not depend on any header
 *     an attacker might influence, and it is asserted here (by pinning the
 *     config) and again on the real `Set-Cookie` in the E2E suite.
 *
 *  2. **Next compares `Origin` against `Host`** in its action handler and aborts
 *     with "Invalid Server Actions request." before decoding the action. Verified
 *     against a running server in `e2e/admin-csrf.spec.ts`, not assumed — the
 *     protection is real but it has a documented hole worth knowing about: a
 *     request with NO `Origin` header is let through with only a warning. That
 *     is survivable precisely because of layer 1, and because browsers always
 *     attach `Origin` to a cross-origin POST.
 *
 *  3. **The action ID.** A server action is addressed by an ID the caller must
 *     supply; a cross-origin attacker cannot read it off an admin page they
 *     cannot load. This is the weakest of the three — IDs are stable for a build
 *     — so it is listed last and relied on least.
 *
 * ## What this file asserts, and why it is a SOURCE scan
 *
 * The property that matters is universal: *every* admin mutation checks the
 * session FIRST. A behavioural test can only assert that of the actions someone
 * remembered to write a test for, and the failure mode being guarded against is
 * exactly a NEW action that nobody wrote a test for. So the check is exhaustive
 * over the files instead.
 */

const ADMIN_APP_ROOT = join(__dirname, '..');

/**
 * The exemptions, keyed `<file>#<action>` and each carrying its reason.
 *
 * Deliberately per-ACTION rather than per-file: exempting `admin/actions.ts`
 * wholesale would mean the next action added beside `logoutAction` inherited the
 * exemption in silence, which is the failure this whole file exists to prevent.
 *
 * Both entries are session-FREE by design, and neither is a content mutation —
 * the worst a forged request achieves against either is a nuisance:
 *
 *  - `loginAction` is how a session is obtained; requiring one would be circular.
 *    It has its own protection (NextAuth's CSRF token, plus the per-email and
 *    per-IP rate limiting `admin-auth.spec.ts` exercises).
 *  - `logoutAction` clears the CALLER'S OWN cookie and nothing else. Forcing it
 *    cross-site signs an admin out, which is annoying and reversible; requiring a
 *    session to END a session is how someone gets stuck with a cookie they cannot
 *    clear. The reasoning is recorded at the action itself.
 */
const UNGATED_ACTIONS = new Set(['login/actions.ts#loginAction', 'actions.ts#logoutAction']);

const ADMIN_API_ROOT = join(__dirname, '..', '..', 'api', 'admin');

/** A `'use server'` DIRECTIVE — a statement on its own line, not a mention in prose. */
const USE_SERVER_DIRECTIVE = /^\s*(?:'use server'|"use server");?\s*$/m;

function walk(directory: string, keep: (path: string, name: string) => boolean, collected: string[] = []): string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      // Test files quote directives and handlers as fixtures; they are not endpoints.
      if (entry.name !== '__tests__' && entry.name !== 'node_modules') walk(path, keep, collected);
    } else if (/\.(ts|tsx)$/.test(entry.name) && keep(path, entry.name)) {
      collected.push(path);
    }
  }
  return collected;
}

/**
 * EVERY file under `src/app/admin/**` that defines server actions — M9 of the
 * 2026-09-19 review.
 *
 * This used to walk only files literally NAMED `actions.ts(x)`. A server action
 * is defined by the `'use server'` directive, not by a filename, so an action
 * added to `tours/bulk.ts`, or declared inline inside a page component, was
 * invisible to the one test that exists to catch an unguarded action. The
 * filename is now irrelevant: any `.ts`/`.tsx` with the directive is scanned.
 */
function actionFiles(directory: string = ADMIN_APP_ROOT): string[] {
  return walk(
    directory,
    (path, name) =>
      name === 'actions.ts' || name === 'actions.tsx' || USE_SERVER_DIRECTIVE.test(readFileSync(path, 'utf8'))
  );
}

/** Comments stripped — so a directive or a guard mentioned in prose counts for nothing. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** True when the module's FIRST statement is the directive, i.e. every export is an action. */
function isFileLevelActionModule(source: string): boolean {
  return /^(?:'use server'|"use server")/.test(codeOnly(source).trimStart());
}

/** Every Route Handler under `src/app/api/admin/**`. Also M9. */
function adminRouteFiles(): string[] {
  return walk(ADMIN_API_ROOT, (_path, name) => name === 'route.ts' || name === 'route.tsx');
}

/** The exported HTTP-method handlers of a route module. */
function exportedHandlers(source: string): string[] {
  return Array.from(
    source.matchAll(/export\s+(?:async\s+function\s+|const\s+)(GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)\b/g)
  ).map((match) => match[1]);
}

/** The text of one exported function, from its signature to the next top-level export (or EOF). */
function bodyOf(source: string, signature: string): string {
  const start = source.indexOf(signature);
  const rest = source.slice(start + 1);
  const nextExport = rest.indexOf('\nexport ');
  return nextExport === -1 ? rest : rest.slice(0, nextExport);
}

/**
 * The first place a handler touches the request BODY. The session check must
 * come before it: an unauthenticated request must not cost a buffered upload.
 */
const BODY_READ = /request\.(formData|json|text|arrayBuffer|blob|body)\b|readBodyWithinCap\(/;

/**
 * The exported async functions of a `'use server'` module — i.e. its server
 * actions. Every one of them is a POST endpoint with a stable, publicly
 * addressable ID, whether or not any form currently renders it.
 */
function exportedActions(source: string): string[] {
  return Array.from(source.matchAll(/export\s+async\s+function\s+(\w+)/g)).map((match) => match[1]);
}

describe('every admin server action is session-gated', () => {
  const files = actionFiles(ADMIN_APP_ROOT);

  it('finds the action modules at all', () => {
    // Guards the guard. A walk that found nothing would make the rest vacuous.
    // A LITERAL floor, not a comparison with anything that could also be zero.
    expect(files.length).toBeGreaterThanOrEqual(3);
    const names = files.map((path) => relative(ADMIN_APP_ROOT, path).split(sep).join('/'));
    expect(names).toEqual(expect.arrayContaining(['actions.ts', 'tours/actions.ts', 'login/actions.ts']));
    // `form-state.ts` MENTIONS 'use server' in a comment and exports a constant;
    // it must not be mistaken for an action module (the directive match is
    // line-anchored for exactly this reason).
    expect(names).not.toContain('tours/form-state.ts');
  });

  it('finds a server action by its DIRECTIVE, whatever the file is called (M9)', () => {
    // The walker's own contract, proven on the real directive regex: a file named
    // anything, carrying the directive, is an action module.
    expect(USE_SERVER_DIRECTIVE.test("'use server';\n\nexport async function bulkArchive() {}")).toBe(true);
    expect(USE_SERVER_DIRECTIVE.test('export async function Page() {\n  async function save() {\n    "use server"\n  }\n}')).toBe(true);
    expect(USE_SERVER_DIRECTIVE.test("// `actions.ts` carries `'use server'`, and ...")).toBe(false);
  });

  it('every INLINE server action (a directive inside a function body) is gated too', () => {
    // A file whose FIRST statement is not the directive declares its actions
    // inline, e.g. inside a Server Component. Each inline directive must be
    // followed by `requireAdminSession()` before the next directive or EOF.
    for (const path of files) {
      const source = readFileSync(path, 'utf8');
      const code = codeOnly(source);
      if (isFileLevelActionModule(source)) continue; // covered by the per-export check

      const segments = code.split(USE_SERVER_DIRECTIVE).slice(1);
      for (const segment of segments) {
        expect({ file: relative(ADMIN_APP_ROOT, path), gated: segment.includes('requireAdminSession()') }).toEqual({
          file: relative(ADMIN_APP_ROOT, path),
          gated: true,
        });
      }
    }
  });

  it.each(
    actionFiles(ADMIN_APP_ROOT).map(
      (path) => [relative(ADMIN_APP_ROOT, path).split(sep).join('/'), path] as const
    )
  )('%s calls requireAdminSession in every exported action', (name, path) => {
    // Comments stripped: a guard that exists only in a doc comment is not a guard.
    const source = codeOnly(readFileSync(path, 'utf8'));
    const actions = exportedActions(source);

    // A file-level `'use server'` module with no exported action is a scan that
    // matched nothing; an inline-only module is covered by the test above.
    if (isFileLevelActionModule(source)) expect(actions.length).toBeGreaterThan(0);

    for (const action of actions) {
      if (UNGATED_ACTIONS.has(`${name}#${action}`)) continue;

      // The body from this action's signature to the next export (or EOF).
      const body = bodyOf(source, `export async function ${action}`);

      expect({ action, gated: body.includes('requireAdminSession()') }).toEqual({
        action,
        gated: true,
      });
    }
  });

  it('has no stale exemptions', () => {
    // An exemption for an action that no longer exists is a silent licence for
    // whatever is written under that name next.
    const present = new Set(
      actionFiles(ADMIN_APP_ROOT).flatMap((path) => {
        const name = relative(ADMIN_APP_ROOT, path).split(sep).join('/');
        return exportedActions(readFileSync(path, 'utf8')).map((action) => `${name}#${action}`);
      })
    );

    expect([...UNGATED_ACTIONS].filter((entry) => !present.has(entry))).toEqual([]);
  });

  it('checks the session BEFORE reading anything from the request', () => {
    // Ordering, not just presence. An action that parsed the payload first and
    // checked the session afterwards would still be exploitable for anything
    // the parse itself does — and it is the shape a later edit produces by
    // accident when a guard is moved for readability.
    //
    // Widened in M9 from `tours/actions.ts` alone to every gated action in every
    // scanned module.
    let checked = 0;
    for (const path of files) {
      const name = relative(ADMIN_APP_ROOT, path).split(sep).join('/');
      const source = codeOnly(readFileSync(path, 'utf8'));

      for (const action of exportedActions(source)) {
        if (UNGATED_ACTIONS.has(`${name}#${action}`)) continue;
        const body = bodyOf(source, `export async function ${action}`);

        const sessionAt = body.indexOf('requireAdminSession()');
        const formDataAt = body.indexOf('formData.get');

        expect(sessionAt).toBeGreaterThan(-1);
        if (formDataAt > -1) expect(sessionAt).toBeLessThan(formDataAt);
        checked += 1;
      }
    }
    // saveTourAction, setTourPublishedAction, setTourArchivedAction at least.
    expect(checked).toBeGreaterThanOrEqual(3);
  });
});

/**
 * ADMIN ROUTE HANDLERS — M9 of the 2026-09-19 review.
 *
 * `/api/admin/uploads` spends money (Cloudinary) and accepts a file from the
 * network, and it was outside the scan above entirely: that scan looked only at
 * server actions under `src/app/admin`. A Route Handler under `src/app/api/admin`
 * that forgot its session check would have failed no test.
 *
 * Two gates are accepted, because both are real:
 *  - `requireAdminSession()` — redirects (right for a page-like response);
 *  - `getAdminSession()` followed by a 401 — what an XHR/`fetch` endpoint
 *    needs, since a 307 to an HTML login page surfaces to `fetch()` as a parse
 *    error. The upload route uses this, and records why.
 */
describe('every admin route handler is session-gated', () => {
  const routes = adminRouteFiles();

  it('finds the route handlers at all', () => {
    // A literal floor, so an empty walk (a moved directory, a typo in the root)
    // fails here instead of turning every check below into a loop over nothing.
    expect(routes.length).toBeGreaterThanOrEqual(1);
    const names = routes.map((path) => relative(ADMIN_API_ROOT, path).split(sep).join('/'));
    expect(names).toContain('uploads/route.ts');
  });

  it.each(adminRouteFiles().map((path) => [relative(ADMIN_API_ROOT, path).split(sep).join('/'), path] as const))(
    '%s checks the session in every handler, before touching the body',
    (_name, path) => {
      const source = codeOnly(readFileSync(path, 'utf8'));
      const handlers = exportedHandlers(source);
      expect(handlers.length).toBeGreaterThan(0);

      for (const handler of handlers) {
        const signature = source.includes(`export async function ${handler}`)
          ? `export async function ${handler}`
          : `export const ${handler}`;
        const body = bodyOf(source, signature);

        const requireAt = body.indexOf('requireAdminSession()');
        const getAt = body.indexOf('getAdminSession()');
        const gatedByGet = getAt > -1 && /apiFailure\(\s*401|status:\s*401/.test(body.slice(getAt));
        const gateAt = requireAt > -1 ? requireAt : gatedByGet ? getAt : -1;

        expect({ handler, gated: gateAt > -1 }).toEqual({ handler, gated: true });

        const bodyReadAt = body.search(BODY_READ);
        if (bodyReadAt > -1) expect({ handler, gateBeforeBody: gateAt < bodyReadAt }).toEqual({ handler, gateBeforeBody: true });
      }
    }
  );
});

describe('the session cookie policy that makes a cross-site POST harmless', () => {
  /**
   * `SameSite=Lax` is what stops a form on another origin from submitting WITH
   * the admin's cookie. Auth.js applies it by default, and this app deliberately
   * does not override the `cookies` block — so the assertion is on the absence
   * of an override, which is the thing a future edit would change.
   *
   * `sameSite: 'none'` is the specific mistake being guarded against. It is what
   * someone reaches for when an embed or a third-party iframe does not work, and
   * it silently converts every server action in the admin into a CSRF target.
   * The real header is asserted against the running server in
   * `e2e/admin-csrf.spec.ts`; this is the one that fails in `npm test`, in the
   * same commit as the mistake.
   */
  it('does not override Auth.js cookie defaults', () => {
    expect(authBaseConfig.cookies).toBeUndefined();
  });

  it('would still be Lax and httpOnly if an override were ever added', () => {
    // Written as a conditional rather than deleted, so that adding a `cookies`
    // block for an unrelated reason (a cookie name prefix, a domain) does not
    // quietly remove the SameSite check along with the assertion above.
    const sessionToken = authBaseConfig.cookies?.sessionToken;
    if (!sessionToken) return;

    expect(sessionToken.options?.sameSite).toBe('lax');
    expect(sessionToken.options?.httpOnly).toBe(true);
  });
});

describe('the session never carries anything sensitive to the client', () => {
  /**
   * `session()` shapes what every server component — and therefore every
   * rendered page — can see. A password hash reaching it would be serialised
   * into the RSC payload of every admin page.
   */
  it('copies only the id and email onto the session', async () => {
    const callback = authBaseConfig.callbacks?.session;
    expect(callback).toBeDefined();

    const shaped = await callback!({
      session: { user: { id: '', email: '', emailVerified: null }, expires: 'never' },
      token: {
        sub: 'user-1',
        email: 'admin@example.test',
        // Planted. If the callback spreads the token, these come with it.
        passwordHash: '$2b$12$aaaaaaaaaaaaaaaaaaaaaa',
        secret: 'do-not-leak',
      },
      // The callback's own signature is wider than the JWT strategy ever uses.
    } as never);

    expect(JSON.stringify(shaped)).not.toContain('$2b$');
    expect(JSON.stringify(shaped)).not.toContain('do-not-leak');
  });

  it('copies only the id and email onto the token at sign-in', async () => {
    const callback = authBaseConfig.callbacks?.jwt;
    expect(callback).toBeDefined();

    const token = await callback!({
      token: {},
      user: {
        id: 'user-1',
        email: 'admin@example.test',
        passwordHash: '$2b$12$bbbbbbbbbbbbbbbbbbbbbb',
      },
    } as never);

    expect(JSON.stringify(token)).not.toContain('$2b$');
  });
});
