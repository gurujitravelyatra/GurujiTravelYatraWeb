import { expect, test } from '@playwright/test';

/**
 * `/group-tours` — one of three primary nav items (Navbar, Footer AND the
 * mobile menu all link here) that 404'd until this route was built
 * (BLOCKERS.md Decision G2). The single most important thing this suite pins
 * is that the route renders a real page — reached by actually clicking the
 * nav link, not just `page.goto` — rather than the branded 404.
 *
 * Fixture data lives in `group-departures.fixture.ts`: 4 departures, exactly
 * one (`Kashi · Ayodhya · Prayagraj`) sold out, 2 carrying an unverified
 * duration (Do Dham Yatra, Spiti Valley Circuit).
 */

test.describe('/group-tours is a real page, not a 404', () => {
  test('direct navigation returns 200 and renders the real <h1>', async ({ page }) => {
    const response = await page.goto('/group-tours');

    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1, name: 'Group Tours' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Page not found.' })).toHaveCount(0);
  });

  test('reachable by actually clicking the desktop navbar link from Home', async ({ page }) => {
    // NavLinks only renders the desktop row at >=1180px (tech spec §4.2/§4.3).
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    await page.getByTestId('site-navbar').getByRole('link', { name: 'Group Tours', exact: true }).click();

    await expect(page).toHaveURL(/\/group-tours$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Group Tours' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Page not found.' })).toHaveCount(0);
  });

  test('renders full site chrome, not a bare document', async ({ page }) => {
    await page.goto('/group-tours');

    await expect(page.getByTestId('site-navbar')).toBeVisible();
    await expect(page.getByRole('contentinfo')).toBeVisible();
  });

  test('exposes no admin, login or CMS surface', async ({ page }) => {
    await page.goto('/group-tours');

    const hrefs = await page.locator('a').evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
    for (const href of hrefs) {
      expect(href).not.toMatch(/admin|login|sign-?in|dashboard|wp-|\/cms/i);
    }
  });
});

test.describe('/group-tours departures', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/group-tours');
  });

  test('renders all four fixture departures', async ({ page }) => {
    await expect(page.getByText('4 departures found')).toBeVisible();

    for (const name of [
      'Do Dham Yatra — Kedarnath & Badrinath',
      'Spiti Valley Circuit',
      'Chardham Special',
      'Kashi · Ayodhya · Prayagraj',
    ]) {
      await expect(page.getByRole('heading', { level: 3, name })).toBeVisible();
    }
  });

  test('the sold-out departure shows "This journey is currently full." and offers no Reserve control, while bookable departures do', async ({
    page,
  }) => {
    // Fixture: exactly 1 of 4 departures is sold out.
    await expect(page.getByRole('heading', { level: 3, name: 'Kashi · Ayodhya · Prayagraj' })).toBeVisible();
    await expect(page.getByText('This journey is currently full.')).toBeVisible();
    await expect(page.getByRole('link', { name: /Explore Other Group Tours/ })).toBeVisible();

    // The sold-out card drops "Reserve a Seat" entirely rather than rendering
    // it disabled — so exactly the 3 bookable departures offer one.
    await expect(page.getByRole('button', { name: 'Reserve a Seat' })).toHaveCount(3);
    // "Get Brochure" is not a seat reservation, so it stays on every card,
    // including the sold-out one.
    await expect(page.getByRole('button', { name: 'Get Brochure' })).toHaveCount(4);
  });

  test('clicking a month chip filters the list; "All Departures" restores all four', async ({ page }) => {
    await expect(page.getByText('4 departures found')).toBeVisible();

    await page.getByRole('button', { name: 'Jun 2026' }).click();

    await expect(page.getByRole('button', { name: 'Jun 2026' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('1 departure found')).toBeVisible();
    await expect(page.getByRole('heading', { level: 3, name: 'Chardham Special' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 3, name: 'Spiti Valley Circuit' })).toHaveCount(0);

    await page.getByRole('button', { name: 'All Departures' }).click();

    await expect(page.getByRole('button', { name: 'All Departures' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('4 departures found')).toBeVisible();
  });

  test('marks unconfirmed durations with the shared footnote', async ({ page }) => {
    // Do Dham Yatra and Spiti Valley Circuit both carry `durationUnverified`.
    await expect(
      page.getByText('*Duration for this departure is pending confirmation and is shown as reported.')
    ).toBeVisible();
  });
});
