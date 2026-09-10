import { expect, test } from '@playwright/test';

/** The real GTY number from the design export — the one genuinely actionable route this sprint. */
const PHONE_DISPLAY = '+91 90999 57658';

test.describe('/ (Home)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders the hero, the four desktop nav links and the footer', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Start Your Journey/ }).first()).toBeVisible();

    // The desktop header carries FOUR links, not five: the design export's
    // `.hdrnav` (GTY Wireframe Prototype.dc.html lines 123-128) has Home /
    // Tour Packages / Group Tours / Customized Tours and deliberately no
    // "About Us" — that one appears only in the mobile menu and the footer's
    // Quick Links. Asserted here so a well-meaning "consistency" fix can't
    // silently add a fifth chip the design never had.
    const header = page.getByTestId('site-navbar');
    for (const label of ['Home', 'Tour Packages', 'Group Tours', 'Customized Tours']) {
      await expect(header.getByRole('link', { name: label, exact: true })).toBeVisible();
    }
    await expect(header.getByRole('link', { name: 'About Us', exact: true })).toHaveCount(0);
    // ...but it is reachable from the footer.
    await expect(page.getByRole('contentinfo').getByRole('link', { name: 'About Us', exact: true })).toBeVisible();

    await expect(page.getByText(/© 2026 Guruji Travel Yatra/)).toBeVisible();
  });

  test('navigates to Tour Packages from the navbar', async ({ page }) => {
    await page.getByTestId('site-navbar').getByRole('link', { name: 'Tour Packages', exact: true }).click();

    await expect(page).toHaveURL(/\/tour-packages$/);
    await expect(page.getByText('20 journeys found')).toBeVisible();
  });

  test('"Watch Our Story" scrolls to the journey video block rather than navigating away', async ({ page }) => {
    await page.getByRole('link', { name: /Watch Our Story/ }).click();

    await expect(page).toHaveURL(/#journey-video$/);
    await expect(page.locator('#journey-video')).toBeInViewport();
  });

  test('testimonials ship as visibly-marked placeholders, never as fabricated reviews (Decision H)', async ({
    page,
  }) => {
    // No real customer quotes/names exist anywhere in the source material, so
    // the section must read as unfinished rather than inventing social proof.
    await expect(page.getByText('Testimonial copy pending — do not ship without real customer quotes.').first()).toBeVisible();
    await expect(page.getByText('[Traveller name pending]').first()).toBeVisible();
    await expect(page.getByText('Placeholder').first()).toBeVisible();
  });
});

test.describe('Enquiry modal (stubbed ERP submit)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('opens from the hero CTA with the page context pre-filled', async ({ page }) => {
    await page.getByRole('button', { name: /Start Your Journey/ }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Enquiring about')).toBeVisible();
    // Context comes from the page, and is never re-asked of the visitor.
    await expect(dialog.getByText('pre-filled from this page')).toBeVisible();
  });

  test('blocks submit until Name and Mobile are supplied', async ({ page }) => {
    await page.getByRole('button', { name: /Start Your Journey/ }).first().click();
    const dialog = page.getByRole('dialog');

    await dialog.getByRole('button', { name: /Start Your Journey/ }).click();

    await expect(dialog.getByText('Please enter your full name.')).toBeVisible();
    await expect(dialog.getByText('Please enter your mobile number.')).toBeVisible();
  });

  test('submitting reports the not-yet-connected stub and NEVER a fake success', async ({ page }) => {
    // The single most important assertion in this suite: the ERP lead API is
    // not built (BLOCKERS.md §1a / Decision A). A visitor must be told to
    // call, and must never see a "we received your enquiry" confirmation that
    // would be a lie — nothing is stored anywhere.
    const requests: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST') requests.push(request.url());
    });

    await page.getByRole('button', { name: /Start Your Journey/ }).first().click();
    const dialog = page.getByRole('dialog');

    await dialog.getByLabel('Name *').fill('Asha Patel');
    await dialog.getByLabel('Mobile Number *').fill('9876543210');
    await dialog.getByRole('button', { name: /Start Your Journey/ }).click();

    const alert = dialog.getByRole('alert');
    await expect(alert).toBeVisible({ timeout: 15_000 });
    await expect(alert).toContainText("Online enquiry submission isn't connected yet");
    await expect(alert).toContainText(PHONE_DISPLAY);

    // No success step. Matched on the done-step heading rather than the bare
    // words "Your journey": Playwright's string matcher is a case-insensitive
    // substring, so it would also match the "Start Your Journey" CTA.
    await expect(dialog.getByRole('heading', { name: /starts here/i })).toHaveCount(0);
    await expect(dialog.getByText(/GTY has your details/)).toHaveCount(0);
    // The form is still on screen, ready for a retry.
    await expect(dialog.getByLabel('Name *')).toBeVisible();

    // And no lead was POSTed anywhere — the adapter makes no network call.
    expect(requests).toEqual([]);
  });

  test('the error path preserves everything the visitor typed', async ({ page }) => {
    await page.getByRole('button', { name: /Start Your Journey/ }).first().click();
    const dialog = page.getByRole('dialog');

    await dialog.getByLabel('Name *').fill('Asha Patel');
    await dialog.getByLabel('Mobile Number *').fill('9876543210');
    await dialog.getByLabel('City').fill('Ahmedabad');
    await dialog.getByRole('button', { name: /Start Your Journey/ }).click();

    await expect(dialog.getByRole('alert')).toBeVisible({ timeout: 15_000 });

    // Re-entering a form after a failure is the fastest way to lose a lead.
    await expect(dialog.getByLabel('Name *')).toHaveValue('Asha Patel');
    await expect(dialog.getByLabel('Mobile Number *')).toHaveValue('9876543210');
    await expect(dialog.getByLabel('City')).toHaveValue('Ahmedabad');
    await expect(dialog.getByRole('button', { name: 'Try Again' })).toBeVisible();
  });

  test('closes on Escape', async ({ page }) => {
    await page.getByRole('button', { name: /Start Your Journey/ }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

test.describe('Brochure modal (stubbed ERP submit)', () => {
  test('reports the stub rather than handing over a brochure that does not exist', async ({ page }) => {
    await page.goto('/tour-packages/spiti-valley-circuit');

    await page.getByRole('button', { name: /Download Brochure/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Brochure for')).toBeVisible();

    await dialog.getByLabel('Name *').fill('Asha Patel');
    await dialog.getByLabel('Mobile Number *').fill('9876543210');
    await dialog.getByRole('button', { name: /Get My Brochure/ }).click();

    const alert = dialog.getByRole('alert');
    await expect(alert).toBeVisible({ timeout: 15_000 });
    await expect(alert).toContainText(PHONE_DISPLAY);

    // No PDF/file host is confirmed, so the unlock buttons must never appear.
    await expect(dialog.getByRole('button', { name: /View Brochure/ })).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: /^Download Brochure/ })).toHaveCount(0);
  });
});

test.describe('architecture constraints', () => {
  for (const path of ['/', '/tour-packages', '/tour-packages/spiti-valley-circuit']) {
    test(`${path} exposes no admin, login or CMS surface`, async ({ page }) => {
      await page.goto(path);

      const hrefs = await page.locator('a').evaluateAll((links) =>
        links.map((link) => link.getAttribute('href') ?? '')
      );
      for (const href of hrefs) {
        expect(href).not.toMatch(/admin|login|sign-?in|dashboard|wp-|\/cms/i);
      }
    });
  }

  test('/admin is not routable', async ({ page }) => {
    const response = await page.goto('/admin');
    expect(response?.status()).toBe(404);
  });
});
