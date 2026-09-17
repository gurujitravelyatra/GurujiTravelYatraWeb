import { ADMIN_HOME_PATH, ADMIN_LOGIN_PATH } from './auth-base-config';

/**
 * The `/admin` gate, as a pure function.
 *
 * Extracted from `proxy.ts` so it can be unit-tested without booting Next's
 * request pipeline. `proxy.ts` is then a thin translation of this decision into a
 * `NextResponse`, which is the part there is nothing to get wrong. The routing
 * RULES — which paths are protected, where an unauthenticated user goes, what
 * happens to the return-to path — all live here, where the tests are.
 *
 * NOTE: no `server-only` import. This runs in the proxy, deliberately.
 */

export type AdminRouteDecision =
  | { type: 'allow' }
  | { type: 'redirect'; to: string };

/**
 * Whitelist of query params preserved across a login redirect. Everything else is
 * dropped — see {@link safeReturnPath}.
 */
export function isAdminPath(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

export function isLoginPath(pathname: string): boolean {
  return pathname === ADMIN_LOGIN_PATH;
}

/**
 * Sanitises the `next=` return-to value into something that can only ever be a
 * path on THIS site inside `/admin`.
 *
 * This is an open-redirect guard, and it is the reason `next=` is validated on
 * the way OUT (when the login page reads it) as well as on the way in. A
 * `next=` parameter is attacker-controlled by construction — anyone can send a
 * staff member a link to `/admin/login?next=https://evil.example/harvest` — and
 * the classic bug is to redirect there after a successful login, having proved
 * the user's identity to them on a page they do not control.
 *
 * The rules are deliberately strict rather than clever:
 * - must start with a single `/` (rejects `https://…`, and rejects `//evil.com`,
 *   which browsers treat as protocol-relative and is the usual way this check is
 *   defeated)
 * - must not contain `\` (Windows-style separators that some URL parsers
 *   normalise into `//`)
 * - must be inside `/admin`, since that is the only thing this gate protects
 * - must not be the login page itself, which would bounce in a loop
 *
 * Anything failing any of these falls back to {@link ADMIN_HOME_PATH}. It never
 * throws and never returns the untrusted value.
 */
export function safeReturnPath(candidate: string | null | undefined): string {
  if (!candidate) return ADMIN_HOME_PATH;
  if (!candidate.startsWith('/')) return ADMIN_HOME_PATH;
  if (candidate.startsWith('//')) return ADMIN_HOME_PATH;
  if (candidate.includes('\\')) return ADMIN_HOME_PATH;

  // Strip the query/hash before the containment check so that
  // `/admin/x?next=https://evil` cannot smuggle anything past it, then keep the
  // original (already-validated) string.
  const pathOnly = candidate.split(/[?#]/)[0];
  if (!isAdminPath(pathOnly)) return ADMIN_HOME_PATH;
  if (isLoginPath(pathOnly)) return ADMIN_HOME_PATH;

  return candidate;
}

/**
 * The decision itself.
 *
 * @param pathname   request path
 * @param search     request query string, including the leading `?` (or empty)
 * @param isAuthenticated  whether a VERIFIED session token was present
 */
export function decideAdminRoute(
  pathname: string,
  search: string,
  isAuthenticated: boolean
): AdminRouteDecision {
  // Everything outside /admin is public and untouched. The public site must not
  // change behaviour because an admin area exists.
  if (!isAdminPath(pathname)) return { type: 'allow' };

  if (isLoginPath(pathname)) {
    /**
     * An already-signed-in user landing on the login page is sent to wherever
     * they were headed, or to the dashboard. Showing them a login form they do
     * not need is the kind of thing that gets "fixed" by signing them out.
     */
    if (isAuthenticated) {
      const next = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get(
        'next'
      );
      return { type: 'redirect', to: safeReturnPath(next) };
    }
    return { type: 'allow' };
  }

  if (!isAuthenticated) {
    /**
     * `next` carries the path AND its query so that a deep link survives the
     * detour through login. It is built from `pathname + search` here — values
     * Next parsed from the actual request, not from user input — and is
     * re-validated by `safeReturnPath()` when the login page consumes it, because
     * by then it has been round-tripped through a URL the user could have edited.
     */
    const params = new URLSearchParams({ next: `${pathname}${search}` });
    return { type: 'redirect', to: `${ADMIN_LOGIN_PATH}?${params.toString()}` };
  }

  return { type: 'allow' };
}
