import robots from '../robots';

/**
 * `robots.txt` must keep the admin area and the JSON API out of search results.
 *
 * Asserted against the generator's output rather than a rendered string, because
 * that is where the rule actually lives — and because the failure this guards
 * against is someone adding an admin route in Phase B and not thinking about
 * crawlers at all.
 */

function ruleFor(userAgent: string) {
  const { rules } = robots();
  const all = Array.isArray(rules) ? rules : [rules];
  const rule = all.find((candidate) => candidate.userAgent === userAgent);
  if (!rule) throw new Error(`no robots rule for user-agent ${userAgent}`);
  return rule;
}

function disallowList(userAgent = '*'): string[] {
  const { disallow } = ruleFor(userAgent);
  if (!disallow) return [];
  return Array.isArray(disallow) ? disallow : [disallow];
}

describe('robots.txt', () => {
  it('applies to every crawler', () => {
    expect(ruleFor('*')).toBeDefined();
  });

  it('disallows /admin', () => {
    expect(disallowList()).toContain('/admin');
  });

  it('disallows /api', () => {
    expect(disallowList()).toContain('/api');
  });

  it('covers every admin subpath through the /admin prefix', () => {
    // `Disallow: /admin` is a PREFIX match in the robots.txt spec, so one rule
    // covers /admin/login and everything Phase B adds. This test states that
    // reliance explicitly, so that if someone later narrows the rule to
    // `/admin$` or `/admin/`, the assumption breaks loudly.
    const disallowed = disallowList();
    const covered = (path: string) => disallowed.some((rule) => path.startsWith(rule));

    for (const path of ['/admin', '/admin/login', '/admin/tours', '/admin/tours/new']) {
      expect(covered(path)).toBe(true);
    }
  });

  it('covers the auth endpoints through the /api prefix', () => {
    const disallowed = disallowList();
    const covered = (path: string) => disallowed.some((rule) => path.startsWith(rule));

    for (const path of ['/api/auth/session', '/api/auth/callback/credentials', '/api/tours']) {
      expect(covered(path)).toBe(true);
    }
  });

  it('still allows the public site', () => {
    expect(ruleFor('*').allow).toBe('/');

    const disallowed = disallowList();
    const covered = (path: string) => disallowed.some((rule) => path.startsWith(rule));

    // The rule must not accidentally swallow the public marketing routes — which
    // is the regression a careless `/a` or an over-broad pattern would cause.
    for (const path of [
      '/',
      '/tour-packages',
      '/tour-packages/spiti-valley-circuit',
      '/about-us',
      '/group-tours',
      '/customize-tours',
      '/legal/privacy-policy',
    ]) {
      expect(covered(path)).toBe(false);
    }
  });

  it('does not advertise a sitemap that does not exist', () => {
    // There is no `src/app/sitemap.ts`. Pointing crawlers at a 404 is worse than
    // saying nothing — and this test is what will prompt updating robots.ts on
    // the day a sitemap is actually added.
    expect(robots().sitemap).toBeUndefined();
  });
});
