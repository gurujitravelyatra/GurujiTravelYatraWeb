import { expect, test } from '@playwright/test';

/**
 * The Enquiry and Brochure modals collect name, mobile and email. Until this
 * round both policy links in the Footer's Support column 404'd — collecting
 * personal details behind dead legal links. These specs cover the real routes
 * end-to-end, and pin down which of the six Support links are still unbuilt
 * so nobody mistakes the remaining 404s for a regression.
 */

const LIVE_PAGES = [
  { label: 'Privacy Policy', path: '/legal/privacy-policy', heading: 'Privacy Policy' },
  { label: 'Terms & Conditions', path: '/legal/terms-and-conditions', heading: 'Terms & Conditions' },
] as const;

test.describe('/legal policy pages', () => {
  for (const { label, path, heading } of LIVE_PAGES) {
    test(`the footer's "${label}" link reaches a real page, not a 404`, async ({ page }) => {
      await page.goto('/');

      await page.getByRole('contentinfo').getByRole('link', { name: label, exact: true }).click();

      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Page not found.' })).toHaveCount(0);
    });

    test(`${path} is served with a 200 and stays marked as placeholder copy`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);

      const notice = page.getByTestId('legal-placeholder-notice');
      await expect(notice).toBeVisible();
      await expect(notice).toContainText('do not treat as final');

      // Site chrome, not a bare document.
      await expect(page.getByTestId('site-navbar')).toBeVisible();
      await expect(page.getByRole('contentinfo')).toBeVisible();
    });

    test(`${path} exposes no admin, login or CMS surface`, async ({ page }) => {
      await page.goto(path);

      const hrefs = await page.locator('a').evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
      for (const href of hrefs) {
        expect(href).not.toMatch(/admin|login|sign-?in|dashboard|wp-|\/cms/i);
      }
    });
  }

  test('the four unwritten Support pages still land on the branded 404 (Decision G)', async ({ page }) => {
    // Deliberate, not an oversight: FAQs, Travel Tips, Cancellation Policy and
    // Refund Policy have no reviewed content yet, and a page of invented
    // cancellation terms would be worse than a 404.
    for (const path of [
      '/legal/faqs',
      '/legal/travel-tips',
      '/legal/cancellation-policy',
      '/legal/refund-policy',
    ]) {
      const response = await page.goto(path);
      expect(response?.status(), `${path} should still 404`).toBe(404);
      await expect(page.getByRole('heading', { name: 'Page not found.' })).toBeVisible();
    }
  });
});
