import { expect, test } from '@playwright/test';

/**
 * `/about-us` — one of three primary nav items (Navbar, Footer AND the mobile
 * menu all link here) that 404'd until this route was built (BLOCKERS.md
 * Decision G2). The single most important thing this suite pins is that the
 * route renders a real page — reached by actually clicking the real link,
 * not just `page.goto` — rather than the branded 404.
 *
 * Unlike the desktop Navbar (Home / Tour Packages / Group Tours / Customized
 * Tours only — see `home.spec.ts`), About Us is reachable from the Footer's
 * Quick Links, not the desktop nav bar (`NavLinks.tsx` has no About Us entry;
 * `Footer.tsx`'s `QUICK_LINKS` does).
 *
 * The brand story and milestone timeline are both explicitly-marked
 * placeholders (BLOCKERS.md Decision H — never fabricate content for a real
 * travel brand), so this suite also pins that those disclosures stay visible
 * rather than being quietly replaced by invented prose.
 */

test.describe('/about-us is a real page, not a 404', () => {
  test('direct navigation returns 200 and renders the real <h1>', async ({ page }) => {
    const response = await page.goto('/about-us');

    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole('heading', { level: 1, name: /we don.t plan trips[\s\S]*we create lifetime[\s\S]*memories/i })
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Page not found.' })).toHaveCount(0);
  });

  test('reachable by actually clicking the footer\'s Quick Links "About Us" link from Home', async ({ page }) => {
    await page.goto('/');

    // Not in the desktop Navbar — the footer's Quick Links column is the real path.
    await expect(page.getByTestId('site-navbar').getByRole('link', { name: 'About Us', exact: true })).toHaveCount(0);

    await page.getByRole('contentinfo').getByRole('link', { name: 'About Us', exact: true }).click();

    await expect(page).toHaveURL(/\/about-us$/);
    await expect(
      page.getByRole('heading', { level: 1, name: /we don.t plan trips[\s\S]*we create lifetime[\s\S]*memories/i })
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Page not found.' })).toHaveCount(0);
  });

  test('renders full site chrome, not a bare document', async ({ page }) => {
    await page.goto('/about-us');

    await expect(page.getByTestId('site-navbar')).toBeVisible();
    await expect(page.getByRole('contentinfo')).toBeVisible();
  });

  test('exposes no admin, login or CMS surface', async ({ page }) => {
    await page.goto('/about-us');

    const hrefs = await page.locator('a').evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
    for (const href of hrefs) {
      expect(href).not.toMatch(/admin|login|sign-?in|dashboard|wp-|\/cms/i);
    }
  });
});

test.describe('/about-us placeholder content stays visibly marked (Decision H)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/about-us');
  });

  test('discloses the missing brand story instead of inventing founder/company copy', async ({ page }) => {
    const notice = page.getByTestId('about-story-placeholder-notice');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('Placeholder — not final');
    await expect(notice).toContainText("brand story is not yet written");
  });

  test('marks every milestone in the "Our Journey" timeline as pending confirmation', async ({ page }) => {
    for (const year of ['2015', '2018', '2022', '2026']) {
      await expect(page.getByTestId(`about-timeline-placeholder-marker-${year}`)).toBeAttached();
    }

    const footnote = page.getByTestId('about-timeline-placeholder-note');
    await expect(footnote).toBeVisible();
    await expect(footnote).toContainText('pending confirmation');
  });
});
