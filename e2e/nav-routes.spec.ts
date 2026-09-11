import { expect, test } from '@playwright/test';

/**
 * BLOCKERS.md Decision G reversed by G2: `/about-us`, `/group-tours` and
 * `/customize-tours` were built because they are primary nav items (Navbar,
 * Footer AND the mobile menu all link to them) and a 404 behind a primary nav
 * item reads as broken, not "coming soon" — see `about-us.spec.ts`,
 * `group-tours.spec.ts`, `customize-tours.spec.ts`.
 *
 * These four remain deliberately unbuilt: Decision G2 only reversed the three
 * primary nav routes above, not the wider catalogue of screens the product
 * spec describes but no nav item links to yet. Mirrors the equivalent guard
 * in `legal.spec.ts` for the unwritten policy pages, so the remaining 404s
 * here are not mistaken for a regression either.
 */
test.describe('routes NOT reversed by Decision G2 still 404', () => {
  for (const path of ['/destinations', '/our-services', '/travel-guide', '/contact-us']) {
    test(`${path} still renders the branded 404`, async ({ page }) => {
      const response = await page.goto(path);

      expect(response?.status(), `${path} should still 404`).toBe(404);
      await expect(page.getByRole('heading', { name: 'Page not found.' })).toBeVisible();
    });
  }
});
