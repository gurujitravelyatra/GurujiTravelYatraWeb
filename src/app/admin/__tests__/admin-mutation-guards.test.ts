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

function actionFiles(directory: string, collected: string[] = []): string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) actionFiles(path, collected);
    else if (entry.name === 'actions.ts' || entry.name === 'actions.tsx') collected.push(path);
  }
  return collected;
}

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
    const names = files.map((path) => relative(ADMIN_APP_ROOT, path).split(sep).join('/'));
    expect(names).toEqual(expect.arrayContaining(['actions.ts', 'tours/actions.ts', 'login/actions.ts']));
  });

  it.each(
    actionFiles(ADMIN_APP_ROOT).map(
      (path) => [relative(ADMIN_APP_ROOT, path).split(sep).join('/'), path] as const
    )
  )('%s calls requireAdminSession in every exported action', (name, path) => {
    const source = readFileSync(path, 'utf8');
    const actions = exportedActions(source);

    expect(actions.length).toBeGreaterThan(0);

    for (const action of actions) {
      if (UNGATED_ACTIONS.has(`${name}#${action}`)) continue;

      // The body from this action's signature to the next export (or EOF).
      const start = source.indexOf(`export async function ${action}`);
      const rest = source.slice(start + 1);
      const nextExport = rest.indexOf('\nexport ');
      const body = nextExport === -1 ? rest : rest.slice(0, nextExport);

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
    const source = readFileSync(join(ADMIN_APP_ROOT, 'tours', 'actions.ts'), 'utf8');

    for (const action of exportedActions(source)) {
      const start = source.indexOf(`export async function ${action}`);
      const body = source.slice(start);

      const sessionAt = body.indexOf('requireAdminSession()');
      const formDataAt = body.indexOf('formData.get');

      expect(sessionAt).toBeGreaterThan(-1);
      if (formDataAt > -1) expect(sessionAt).toBeLessThan(formDataAt);
    }
  });
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
