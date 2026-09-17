import { expect, test } from '@playwright/test';

import { captureLeadRequests, expectSubmissionConfirmed, fillContactDetails, onlyLead } from './support/leads';

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

/**
 * BLOCKERS.md item 0. "Reserve a Seat" called
 * `openEnquiry({ value: departure.name })`: it sent the departure NAME and
 * never `dateRangeLabel`, so the batch date that
 * `Group Tour Reservation – [Batch Date]` is built from was transmitted by
 * nothing on the site — a time-sensitive seat request arrived indistinguishable
 * from a general enquiry about the same tour.
 *
 * The UX is unchanged: the card holds no contact details, so the modal still
 * opens to collect them. Only the payload it builds is different.
 */
test.describe('group-tour-reservation lead submission', () => {
  /** Chardham Special — the one bookable fixture departure with no unverified figures. */
  const DEPARTURE = 'Chardham Special';
  const DEPARTURE_SLUG = 'chardham-special';
  const BATCH_DATE = '02 — 13 Jun 2026';
  const SOLD_OUT_SLUG = 'kashi-ayodhya-prayagraj';

  test.beforeEach(async ({ page }) => {
    await page.goto('/group-tours');
  });

  /**
   * Scoped by the card's own test id. Every bookable departure renders an
   * identically-labelled CTA pair, and the headings sit many divs deep, so a
   * `filter({ has: heading })` locator matches every ancestor div up to the
   * list container — and then picks a different card's button.
   */
  function card(page: import('@playwright/test').Page, slug: string) {
    return page.getByTestId(`group-departure-${slug}`);
  }

  test('POSTs formType:"group-tour-reservation" carrying the batch date, not just the name', async ({ page }) => {
    const captured = await captureLeadRequests(page);

    await card(page, DEPARTURE_SLUG).getByRole('button', { name: 'Reserve a Seat' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // Unchanged UX: the departure is still shown as pre-filled page context.
    await expect(dialog.getByText('Enquiring about')).toBeVisible();
    await expect(dialog.getByText(DEPARTURE)).toBeVisible();

    await fillContactDetails(page);
    await dialog.getByRole('button', { name: /Start Your Journey/ }).click();

    await expectSubmissionConfirmed(page);

    expect(onlyLead(captured)).toMatchObject({
      formType: 'group-tour-reservation',
      departureName: DEPARTURE,
      batchDate: BATCH_DATE,
      interestedIn: DEPARTURE,
      name: 'Asha Patel',
      mobile: '9876543210',
    });
  });

  test('is no longer sent as a generic enquiry', async ({ page }) => {
    const captured = await captureLeadRequests(page);

    await card(page, DEPARTURE_SLUG).getByRole('button', { name: 'Reserve a Seat' }).click();
    await fillContactDetails(page);
    await page.getByRole('dialog').getByRole('button', { name: /Start Your Journey/ }).click();

    await expectSubmissionConfirmed(page);

    const lead = onlyLead(captured);
    expect(lead.formType).toBe('group-tour-reservation');
    expect(lead).not.toHaveProperty('pageName');
  });

  /** A brochure request is not a seat reservation — it stays a plain `brochure` lead. */
  test('"Get Brochure" on the same card still submits formType:"brochure"', async ({ page }) => {
    const captured = await captureLeadRequests(page);

    await card(page, DEPARTURE_SLUG).getByRole('button', { name: 'Get Brochure' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Brochure for')).toBeVisible();

    await fillContactDetails(page);
    await dialog.getByRole('button', { name: /Get My Brochure/ }).click();

    await expect(dialog.getByRole('heading', { name: /starts here/i })).toBeVisible({ timeout: 15_000 });

    const lead = onlyLead(captured);
    expect(lead).toMatchObject({ formType: 'brochure', packageName: DEPARTURE });
    expect(lead).not.toHaveProperty('batchDate');
  });

  test('the sold-out departure offers no way to reserve, so it can send no reservation', async ({ page }) => {
    const captured = await captureLeadRequests(page);

    await expect(page.getByText('This journey is currently full.')).toBeVisible();
    await expect(card(page, SOLD_OUT_SLUG).getByRole('button', { name: 'Reserve a Seat' })).toHaveCount(0);
    expect(captured).toHaveLength(0);
  });
});
