import { expect, test } from '@playwright/test';

import {
  captureLeadRequests,
  expectSubmissionConfirmed,
  failLeadRequests,
  fillContactDetails,
  onlyLead,
  stubLeadResponse,
} from './support/leads';

/** The real GTY number from the design export — the fallback every lead-failure message offers. */
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

    // Year is computed at render time (Footer.tsx CopyrightBar), so this
    // assertion tracks the clock instead of pinning a year that goes stale.
    await expect(page.getByText(new RegExp(`© ${new Date().getFullYear()} Guruji Travel Yatra`))).toBeVisible();
  });

  test('Trip Finder tabs swap the hint without promising features that do not exist', async ({ page }) => {
    const bar = page.getByTestId('section-3-trip-finder');

    await bar.getByRole('button', { name: 'Custom Trip' }).click();
    await expect(bar.getByRole('button', { name: 'Custom Trip' })).toHaveAttribute('aria-pressed', 'true');

    // The Custom Trip hint used to advertise "the trip builder — nine short
    // questions". No such flow exists.
    await expect(bar).not.toContainText(/trip builder/i);
    await expect(bar).not.toContainText(/seats? (still )?open|departures/i);

    // "Custom Trip" maps onto no catalogue category, so its CTA stays the
    // plain catalogue rather than pointing at a chip that does not exist.
    await expect(bar.getByTestId('trip-finder-cta')).toHaveAttribute('href', '/tour-packages');
  });

  /** F5 — the CTA used to be one static link while the hints promised a filter. */
  test('the Trip Finder CTA deep-links to the active tab\'s category', async ({ page }) => {
    const bar = page.getByTestId('section-3-trip-finder');

    await bar.getByRole('button', { name: 'Spiritual Yatra' }).click();
    await expect(bar.getByTestId('trip-finder-cta')).toHaveAttribute('href', '/tour-packages?category=Spiritual');

    await bar.getByTestId('trip-finder-cta').click();

    // The hint says "filter by Spiritual on Tour Packages" — so the button has
    // to land there, not on the unfiltered catalogue.
    await expect(page).toHaveURL(/category=Spiritual/);
    await expect(page.getByRole('button', { name: 'Spiritual', exact: true })).toHaveAttribute('aria-pressed', 'true');
  });

  test('navigates to Tour Packages from the navbar', async ({ page }) => {
    await page.getByTestId('site-navbar').getByRole('link', { name: 'Tour Packages', exact: true }).click();

    await expect(page).toHaveURL(/\/tour-packages$/);
    await expect(page.getByText('17 journeys found')).toBeVisible();
  });

  test('"Watch Our Story" scrolls to the journey video block rather than navigating away', async ({ page }) => {
    await page.getByRole('link', { name: /Watch Our Story/ }).click();

    await expect(page).toHaveURL(/#journey-video$/);
    await expect(page.locator('#journey-video')).toBeInViewport();
  });

  /** C2 — the strip showed `@guruji_travel_yatra`, a handle nobody confirmed. */
  test('shows the confirmed Instagram handle, linked to the real profile', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '@gurujitravelyatra' })).toBeVisible();
    await expect(page.getByText('@guruji_travel_yatra')).toHaveCount(0);

    const follow = page.getByRole('link', { name: /Follow Our Journey/ });
    await expect(follow).toHaveAttribute('href', 'https://www.instagram.com/gurujitravelyatra/');
  });

  /** H2/H3 — one source for the figures, and every unconfirmed figure marked. */
  test('states its statistics once, and marks them as pending confirmation', async ({ page }) => {
    await expect(page.getByTestId('stats-placeholder-note')).toContainText(/pending confirmation/i);
    await expect(page.getByTestId('hero-stats-placeholder-note')).toContainText(/pending confirmation/i);

    // The hero used to hardcode "8+ Years / Of Trust & Service" alongside the
    // stats bar's own "8+ / Years of Experience" — same number, two sources.
    await expect(page.getByText('Of Trust & Service')).toHaveCount(0);
    await expect(page.getByTestId('hero-stats').getByText('10,000+')).toBeVisible();
    await expect(page.getByTestId('section-11-stats').getByText('10,000+')).toBeVisible();
  });

  /** M4 — the desktop card invited a WhatsApp chat but offered no way to start one. */
  test('offers a real WhatsApp link in the desktop contact strip', async ({ page }) => {
    const link = page.getByRole('link', { name: 'Chat with Guruji Travel Yatra on WhatsApp' });

    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', 'https://wa.me/919099957658');
  });

  /** M7 — a play button on a page with no video asset. */
  test('promises no video playback, since no video exists', async ({ page }) => {
    const block = page.getByTestId('section-5-8-journey-video');

    await expect(block.getByText(/Watch Full Video/i)).toHaveCount(0);
    await expect(block.getByText(/Trip films coming soon/i)).toBeVisible();
    await expect(block.getByRole('button', { name: /watch/i })).toHaveCount(0);
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

test.describe('Enquiry modal (POSTs to /api/leads)', () => {
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

  /**
   * The lead actually leaves the browser now, and the REAL route answers it —
   * `captureLeadRequests` observes and continues rather than stubbing, so a
   * payload the server would reject fails this test instead of passing against
   * an assertion of what the author hoped the contract was.
   */
  test('submitting POSTs a formType:"enquiry" lead and confirms only after the route accepts it', async ({ page }) => {
    const captured = await captureLeadRequests(page);

    await page.getByRole('button', { name: /Start Your Journey/ }).first().click();
    const dialog = page.getByRole('dialog');

    await fillContactDetails(page);
    await dialog.getByLabel('City').fill('Ahmedabad');
    await dialog.getByRole('button', { name: /Start Your Journey/ }).click();

    await expectSubmissionConfirmed(page);

    const lead = onlyLead(captured);
    expect(lead).toMatchObject({
      formType: 'enquiry',
      name: 'Asha Patel',
      mobile: '9876543210',
      city: 'Ahmedabad',
      pageName: 'Home',
      interestedIn: 'Home',
    });
    // Server-owned: a public endpoint must not let a caller pick its own CRM
    // routing key, or stamp its own clock.
    expect(lead).not.toHaveProperty('source');
    expect(lead).not.toHaveProperty('timestamp');
    expect(lead.sourcePageUrl).toMatch(/^http/);
  });

  test('a 400 from the route is shown on the field it names, not as one generic banner', async ({ page }) => {
    // The route cannot be made to reject a valid submission on demand, so this
    // one outcome is stubbed. The SHAPE is the route's own (`ApiFailure`).
    await stubLeadResponse(page, 400, {
      error: 'Some details need fixing before we can send this.',
      fields: { mobile: ['Please enter a valid mobile number.'] },
    });

    await page.getByRole('button', { name: /Start Your Journey/ }).first().click();
    const dialog = page.getByRole('dialog');

    await fillContactDetails(page);
    await dialog.getByRole('button', { name: /Start Your Journey/ }).click();

    // Inline, on the input itself — the same slot client-side validation uses.
    await expect(dialog.getByText('Please enter a valid mobile number.')).toBeVisible({ timeout: 15_000 });
    await expect(dialog.getByLabel('Mobile Number *')).toHaveAttribute('aria-invalid', 'true');
    await expect(dialog.getByTestId('lead-form-error')).toContainText('Some details need fixing');

    // And never a confirmation.
    await expect(dialog.getByRole('heading', { name: /starts here/i })).toHaveCount(0);
  });

  test('the error path preserves everything the visitor typed', async ({ page }) => {
    // An unreachable endpoint — the one failure mode the visitor is most
    // likely to actually hit, and the fastest way to lose a lead if the form
    // resets.
    await failLeadRequests(page);

    await page.getByRole('button', { name: /Start Your Journey/ }).first().click();
    const dialog = page.getByRole('dialog');

    await fillContactDetails(page);
    await dialog.getByLabel('City').fill('Ahmedabad');
    await dialog.getByRole('button', { name: /Start Your Journey/ }).click();

    const banner = dialog.getByTestId('lead-form-error');
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await expect(banner).toContainText(PHONE_DISPLAY);

    // Re-entering a form after a failure is the fastest way to lose a lead.
    await expect(dialog.getByLabel('Name *')).toHaveValue('Asha Patel');
    await expect(dialog.getByLabel('Mobile Number *')).toHaveValue('9876543210');
    await expect(dialog.getByLabel('City')).toHaveValue('Ahmedabad');
    await expect(dialog.getByRole('button', { name: 'Try Again' })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: /starts here/i })).toHaveCount(0);
  });

  test('closes on Escape', async ({ page }) => {
    await page.getByRole('button', { name: /Start Your Journey/ }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

test.describe('Brochure modal (POSTs to /api/leads)', () => {
  test('submits a formType:"brochure" lead carrying the package name', async ({ page }) => {
    await page.goto('/tour-packages/spiti-valley-circuit');
    const captured = await captureLeadRequests(page);

    await page.getByRole('button', { name: /Download Brochure/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Brochure for')).toBeVisible();

    await fillContactDetails(page);
    await dialog.getByRole('button', { name: /Get My Brochure/ }).click();

    await expect(dialog.getByRole('heading', { name: /starts here/i })).toBeVisible({ timeout: 15_000 });

    expect(onlyLead(captured)).toMatchObject({
      formType: 'brochure',
      packageName: 'Spiti Valley Circuit',
      name: 'Asha Patel',
      mobile: '9876543210',
    });
  });

  /**
   * Unchanged by the wiring, and must stay that way: a lead being accepted says
   * nothing about a PDF existing. No file host is confirmed (BLOCKERS.md Open
   * Question 3), so the done step's unlock buttons remain inert stubs — but
   * they must never appear as a consequence of the submission succeeding.
   */
  test('a confirmed brochure lead still hands over no brochure that does not exist', async ({ page }) => {
    await page.goto('/tour-packages/spiti-valley-circuit');

    await page.getByRole('button', { name: /Download Brochure/ }).click();
    const dialog = page.getByRole('dialog');

    await fillContactDetails(page);
    await dialog.getByRole('button', { name: /Get My Brochure/ }).click();

    await expect(dialog.getByRole('heading', { name: /starts here/i })).toBeVisible({ timeout: 15_000 });
    // The done step's stubs are deliberately non-functional: they must not link
    // out to, or fetch, a PDF that has never been uploaded.
    const unlockHrefs = await dialog
      .locator('a')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
    for (const href of unlockHrefs) {
      expect(href).not.toMatch(/\.pdf($|\?)/i);
    }
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

  /**
   * SUPERSEDED 2026-09-17. This test used to assert `/admin` returned 404, as the
   * "Hard Architecture Boundary" of the original spec (§9, acceptance criterion
   * 9). The user PERMANENTLY REVERSED that rule — see
   * `memory/project_gty_admin_reversal.md` — and `/admin` is now a real,
   * session-gated route.
   *
   * The test is rewritten rather than deleted, because the property worth
   * guarding did not disappear, it changed: `/admin` must never be reachable by
   * an anonymous visitor. A 404 proved that by the route not existing; a redirect
   * to the login page proves it now. Deleting the test would have left the
   * strongest assertion about the admin boundary as a gap.
   *
   * Full coverage of the auth behaviour lives in `e2e/admin-auth.spec.ts`.
   */
  test('/admin is not reachable without signing in', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});
