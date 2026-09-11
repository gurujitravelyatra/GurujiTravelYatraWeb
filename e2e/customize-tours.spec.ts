import { expect, test } from '@playwright/test';

/**
 * `/customize-tours` — one of three primary nav items (Navbar, Footer AND the
 * mobile menu all link here) that 404'd until this route was built
 * (BLOCKERS.md Decision G2). The single most important thing this suite pins
 * is that the route renders a real page — reached by actually clicking the
 * nav link, not just `page.goto` — rather than the branded 404.
 *
 * `TripSummaryCard`'s "Estimated Cost (Per Person)" row is the other
 * load-bearing guard here: the export computes that figure from per-night
 * rates (₹3200/5400/8600) that exist in no spec or price list, so showing a
 * number derived from them would be a fabricated price quote. It must always
 * read "On request" and never a ₹ amount.
 */

test.describe('/customize-tours is a real page, not a 404', () => {
  test('direct navigation returns 200 and renders the real <h1>', async ({ page }) => {
    const response = await page.goto('/customize-tours');

    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1, name: /Build Your\s+Own Yatra/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Page not found.' })).toHaveCount(0);
  });

  test('reachable by actually clicking the desktop navbar link from Home', async ({ page }) => {
    // NavLinks only renders the desktop row at >=1180px (tech spec §4.2/§4.3).
    // The label in the nav/footer/hero is "Customized Tours", not "Customize Tours".
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    await page.getByTestId('site-navbar').getByRole('link', { name: 'Customized Tours', exact: true }).click();

    await expect(page).toHaveURL(/\/customize-tours$/);
    await expect(page.getByRole('heading', { level: 1, name: /Build Your\s+Own Yatra/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Page not found.' })).toHaveCount(0);
  });

  test('renders full site chrome, not a bare document', async ({ page }) => {
    await page.goto('/customize-tours');

    await expect(page.getByTestId('site-navbar')).toBeVisible();
    await expect(page.getByRole('contentinfo')).toBeVisible();
  });

  test('exposes no admin, login or CMS surface', async ({ page }) => {
    await page.goto('/customize-tours');

    const hrefs = await page.locator('a').evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
    for (const href of hrefs) {
      expect(href).not.toMatch(/admin|login|sign-?in|dashboard|wp-|\/cms/i);
    }
  });
});

test.describe('trip builder', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/customize-tours');
  });

  test('adding a place adds it to Your Route at 2 nights; "+ night" increments; Remove and Clear All empty it back out', async ({
    page,
  }) => {
    await expect(page.getByText('No places added yet')).toBeVisible();

    await page.getByRole('button', { name: 'Add Rishikesh to your trip' }).click();

    await expect(page.getByText('No places added yet')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Rishikesh added to your trip' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(page.getByText('Uttarakhand · 2 nights')).toBeVisible();

    await page.getByRole('button', { name: 'Add one night to Rishikesh' }).click();
    await expect(page.getByText('Uttarakhand · 3 nights')).toBeVisible();

    await page.getByRole('button', { name: 'Remove Rishikesh from your trip' }).click();
    await expect(page.getByText('No places added yet')).toBeVisible();

    // Clear All empties a multi-place route the same way.
    await page.getByRole('button', { name: 'Add Rishikesh to your trip' }).click();
    await page.getByRole('button', { name: 'Add Manali to your trip' }).click();
    await expect(page.getByRole('button', { name: 'Clear All' })).toBeEnabled();

    await page.getByRole('button', { name: 'Clear All' }).click();
    await expect(page.getByText('No places added yet')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clear All' })).toBeDisabled();
  });

  /**
   * Guards against re-introducing the export's fabricated price quote
   * (`nights * (3200|5400|8600)`, no source anywhere) as a real ₹ figure.
   */
  test('estimated cost always reads "On request" and never shows a fabricated ₹ figure', async ({ page }) => {
    const summary = page.getByRole('group', { name: 'Your trip summary' });

    await expect(summary.getByText('Estimated Cost (Per Person)')).toBeVisible();
    await expect(summary).toContainText('On request');
    expect(await summary.innerText()).not.toMatch(/₹/);

    // Adding a place and extra nights must not turn "On request" into a computed price.
    await page.getByRole('button', { name: 'Add Rishikesh to your trip' }).click();
    await page.getByRole('button', { name: 'Add one night to Rishikesh' }).click();

    await expect(summary).toContainText('On request');
    expect(await summary.innerText()).not.toMatch(/₹/);
  });

  test('"Get My Custom Quote" opens the enquiry modal carrying the custom-trip context', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Rishikesh to your trip' }).click();

    await page.getByRole('button', { name: 'Get My Custom Quote' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Enquiring about')).toBeVisible();
    await expect(dialog.getByText('Rishikesh')).toBeVisible();
    await expect(dialog.getByText('pre-filled from this page')).toBeVisible();
  });
});
