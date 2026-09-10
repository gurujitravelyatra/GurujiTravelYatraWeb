import { expect, test } from '@playwright/test';

/**
 * Tour Packages golden path — tech spec §4.4, BLOCKERS.md Decisions C and D.
 *
 * The chip row is DERIVED from the 20 fixture packages (`getCategoryChips`),
 * so these expectations double as a regression guard on Decision C: any chip
 * with no matching data cannot appear.
 */

/** First-appearance order across rails-then-items, per getCategoryChips(). */
const EXPECTED_CHIPS = ['All', 'Adventure', 'Spiritual', 'Family', 'International', 'Cultural', 'Beach'];

const chipGroup = 'role=group[name="Filter by travel category"]';

test.describe('/tour-packages', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tour-packages');
  });

  test('renders exactly the data-derived category chips', async ({ page }) => {
    const chips = page.locator(`${chipGroup} >> role=button`);
    await expect(chips).toHaveText(EXPECTED_CHIPS);
  });

  test('does NOT offer Honeymoon or Wildlife chips (Decision C — no matching data)', async ({ page }) => {
    // These two were removed because zero of the 20 packages carry those
    // categories. Asserting their absence explicitly so a future hardcoded
    // chip list can't quietly reintroduce a filter that always yields 0.
    await expect(page.getByRole('button', { name: 'Honeymoon', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Wildlife', exact: true })).toHaveCount(0);
  });

  test('starts on All, showing every one of the 20 packages across 4 rails', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'All', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('20 journeys found')).toBeVisible();

    for (const title of [
      'Trending Tour Packages',
      'International Tour Packages',
      'North India Tour Packages',
      'South India Tour Packages',
    ]) {
      await expect(page.getByRole('heading', { name: title })).toBeVisible();
    }
  });

  test('filtering to International narrows the count and empties the other three rails', async ({ page }) => {
    await page.getByRole('button', { name: 'International', exact: true }).click();

    await expect(page.getByRole('button', { name: 'International', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(page.getByText('5 journeys found')).toBeVisible();

    // All 5 International packages live in one rail, so the other 3 rails
    // keep their heading and show the per-rail empty state.
    await expect(page.getByText('No journeys match this filter yet.')).toHaveCount(3);
  });

  test('N=1: filtering to Beach yields a single journey, in the singular, with 3 empty rails', async ({ page }) => {
    await page.getByRole('button', { name: 'Beach', exact: true }).click();

    // Exactly one package (Goa Beach Holiday) carries the Beach category, so
    // the live-region copy must read "journey", not "journeys".
    await expect(page.getByText('1 journey found')).toBeVisible();
    await expect(page.getByText('journeys found')).toHaveCount(0);

    await expect(page.getByRole('link', { name: /Goa Beach Holiday/ })).toBeVisible();
    await expect(page.getByText('No journeys match this filter yet.')).toHaveCount(3);
  });

  test('Clear returns to the unfiltered All view', async ({ page }) => {
    await page.getByRole('button', { name: 'Beach', exact: true }).click();
    await expect(page.getByText('1 journey found')).toBeVisible();

    await page.getByRole('button', { name: /^Clear/ }).click();

    await expect(page.getByRole('button', { name: 'All', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('20 journeys found')).toBeVisible();
  });

  test('a package card navigates to its detail page (Decision D)', async ({ page }) => {
    await page.getByRole('link', { name: /Spiti Valley Circuit/ }).first().click();

    await expect(page).toHaveURL(/\/tour-packages\/spiti-valley-circuit$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Spiti Valley Circuit' })).toBeVisible();

    // Only fields that genuinely exist on the fixture are rendered.
    await expect(page.getByText('9 Days 8 Nights')).toBeVisible();
    await expect(page.getByText('Shimla - Kaza - Chandratal')).toBeVisible();
    await expect(page.getByText('₹42,500')).toBeVisible();
    await expect(page.getByText('Save ₹5,200')).toBeVisible();
  });

  test('the detail page invents no itinerary, inclusions, hotel or review content', async ({ page }) => {
    await page.goto('/tour-packages/spiti-valley-circuit');

    // The export's detail screen renders these from PACKS[0] regardless of
    // which card was clicked, i.e. it is not real per-tour data — so none of
    // it may be transcribed here.
    //
    // Scoped to <main>: the site-wide BottomContactStrip legitimately offers
    // "Get Itinerary & Quotes" as a contact benefit, which is chrome, not
    // fabricated per-tour detail.
    const main = page.getByRole('main');
    for (const forbidden of [/Day 1/i, /Inclusions/i, /Exclusions/i, /Hotels?\b/i, /Itinerary/i]) {
      await expect(main.getByText(forbidden)).toHaveCount(0);
    }
  });

  test('the detail breadcrumb navigates back to the catalogue', async ({ page }) => {
    await page.goto('/tour-packages/spiti-valley-circuit');

    await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Tour Packages' }).click();

    await expect(page).toHaveURL(/\/tour-packages$/);
    await expect(page.getByText('20 journeys found')).toBeVisible();
  });

  test('an unknown package slug renders the branded 404, not a crash', async ({ page }) => {
    const response = await page.goto('/tour-packages/this-package-does-not-exist');

    expect(response?.status()).toBe(404);
  });
});
