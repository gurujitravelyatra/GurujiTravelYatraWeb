import {
  decideAdminRoute,
  isAdminPath,
  isLoginPath,
  safeReturnPath,
} from '../admin-route-policy';

/**
 * The routing rules `proxy.ts` enforces, tested directly.
 *
 * `proxy.ts` itself is a five-line translation of these decisions into a
 * `NextResponse`; the decisions are here, where they can be driven exhaustively
 * without booting Next. The end-to-end behaviour (a real browser actually being
 * redirected) is covered separately in `e2e/admin-auth.spec.ts` — these two
 * layers answer different questions and neither substitutes for the other.
 */

describe('isAdminPath', () => {
  it.each(['/admin', '/admin/', '/admin/login', '/admin/tours/new'])('matches %s', (path) => {
    expect(isAdminPath(path)).toBe(true);
  });

  it.each([
    '/',
    '/tour-packages',
    '/about-us',
    // The critical near-misses: a public route that merely STARTS with the same
    // letters must not be swept into the admin gate.
    '/administration',
    '/admin-guide',
    '/administrator',
  ])('does not match %s', (path) => {
    expect(isAdminPath(path)).toBe(false);
  });
});

describe('isLoginPath', () => {
  it('matches only the exact login route', () => {
    expect(isLoginPath('/admin/login')).toBe(true);
    expect(isLoginPath('/admin/login/extra')).toBe(false);
    expect(isLoginPath('/admin')).toBe(false);
  });
});

describe('safeReturnPath — open-redirect guard', () => {
  it('keeps a legitimate admin path, query included', () => {
    expect(safeReturnPath('/admin/tours?page=2')).toBe('/admin/tours?page=2');
    expect(safeReturnPath('/admin')).toBe('/admin');
  });

  it.each([
    // Absolute URLs to another origin — the basic attack.
    ['https://evil.example/harvest'],
    ['http://evil.example'],
    // Protocol-relative. Browsers treat `//host` as an absolute URL, and a naive
    // `startsWith('/')` check passes it. This is the single most common way this
    // guard gets defeated.
    ['//evil.example'],
    ['//evil.example/admin'],
    // Backslashes: some URL parsers normalise `\\` to `//`, reproducing the above.
    ['/\\evil.example'],
    ['\\\\evil.example'],
    // Outside /admin — not an off-site redirect, but not something this gate has
    // any business sending people to either.
    ['/tour-packages'],
    ['/'],
    // Would bounce in a loop.
    ['/admin/login'],
    ['/admin/login?next=/admin'],
    // Attempts to smuggle a target past the containment check in the query.
    ['/tour-packages?x=/admin'],
    // Empty and absent.
    [''],
    [null],
    [undefined],
  ])('rejects %p and falls back to /admin', (candidate) => {
    expect(safeReturnPath(candidate as string | null | undefined)).toBe('/admin');
  });

  it('never returns the untrusted value for any rejected input', () => {
    // Belt and braces on the whole family: whatever comes back must be a path we
    // chose, not a transformation of what the attacker sent.
    const hostile = 'https://evil.example/steal';
    expect(safeReturnPath(hostile)).not.toContain('evil.example');
  });
});

describe('decideAdminRoute', () => {
  describe('public routes', () => {
    it.each(['/', '/tour-packages', '/about-us', '/api/tours', '/administration'])(
      'never touches %s, signed in or not',
      (path) => {
        expect(decideAdminRoute(path, '', false)).toEqual({ type: 'allow' });
        expect(decideAdminRoute(path, '', true)).toEqual({ type: 'allow' });
      }
    );
  });

  describe('unauthenticated', () => {
    it('redirects a protected admin route to login', () => {
      expect(decideAdminRoute('/admin', '', false)).toEqual({
        type: 'redirect',
        to: '/admin/login?next=%2Fadmin',
      });
    });

    it('preserves the deep link, query and all, in `next`', () => {
      const decision = decideAdminRoute('/admin/tours', '?page=2&sort=name', false);
      expect(decision).toEqual({
        type: 'redirect',
        to: '/admin/login?next=%2Fadmin%2Ftours%3Fpage%3D2%26sort%3Dname',
      });

      // And the round trip actually works — this is the property that matters to
      // the user, not the exact encoding above.
      const next = new URLSearchParams(
        (decision as { to: string }).to.split('?')[1]
      ).get('next');
      expect(safeReturnPath(next)).toBe('/admin/tours?page=2&sort=name');
    });

    it('lets the login page itself through', () => {
      expect(decideAdminRoute('/admin/login', '', false)).toEqual({ type: 'allow' });
      expect(decideAdminRoute('/admin/login', '?next=%2Fadmin', false)).toEqual({ type: 'allow' });
    });
  });

  describe('authenticated', () => {
    it('lets protected routes through', () => {
      expect(decideAdminRoute('/admin', '', true)).toEqual({ type: 'allow' });
      expect(decideAdminRoute('/admin/tours/new', '?x=1', true)).toEqual({ type: 'allow' });
    });

    it('bounces a signed-in user off the login page to their destination', () => {
      expect(decideAdminRoute('/admin/login', '?next=%2Fadmin%2Ftours', true)).toEqual({
        type: 'redirect',
        to: '/admin/tours',
      });
    });

    it('bounces to the dashboard when there is no destination', () => {
      expect(decideAdminRoute('/admin/login', '', true)).toEqual({
        type: 'redirect',
        to: '/admin',
      });
    });

    it('does not honour a hostile `next` even for a signed-in user', () => {
      // The user is authenticated, so this is the moment an open redirect is worth
      // the most to an attacker: the victim has just proved their identity.
      expect(decideAdminRoute('/admin/login', '?next=https%3A%2F%2Fevil.example', true)).toEqual({
        type: 'redirect',
        to: '/admin',
      });
    });
  });
});
