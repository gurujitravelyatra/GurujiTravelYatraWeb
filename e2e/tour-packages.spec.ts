import { expect, test } from '@playwright/test';

/**
 * Tour Packages golden path — tech spec §4.4, BLOCKERS.md Decisions C and D.
 *
 * The chip row is DERIVED from the packages the catalogue actually lists
 * (`getCategoryChips`), so these expectations double as a regression guard on
 * Decision C: any chip with no matching data cannot appear.
 *
 * 17, not 20: the three `pricingUnverified` tours ("Do Dham Yatra", "Kashmir
 * Family Escape", "Kashi Darshan") are withheld from every public listing
 * until real figures are confirmed, because they were rendering fabricated
 * "was ₹X / Save ₹Y" discount badges off unconfirmed prices.
 */
const LISTED_COUNT = 17;

/**
 * First-appearance order across rails-then-items, per getCategoryChips().
 * Withholding the three tours changed this order: the Trending rail used to
 * contribute Spiritual and Family before the International rail was reached.
 */
const EXPECTED_CHIPS = ['All', 'Adventure', 'International', 'Family', 'Spiritual', 'Cultural', 'Beach'];

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

  test('starts on All, showing every publicly-listed package across 4 rails', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'All', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText(`${LISTED_COUNT} journeys found`)).toBeVisible();

    for (const title of [
      'Trending Tour Packages',
      'International Tour Packages',
      'North India Tour Packages',
      'South India Tour Packages',
    ]) {
      await expect(page.getByRole('heading', { name: title })).toBeVisible();
    }
  });

  /**
   * F6 — filtering collapses the four rails into ONE results section.
   *
   * These two tests used to assert 3 per-rail empty-state boxes, i.e. they
   * pinned the defect: the rails filtered independently, so a filter that
   * worked perfectly rendered its matches beside three "No journeys match this
   * filter yet." boxes and read as a broken page.
   */
  test('filtering to International shows one consolidated section, not three empty rails', async ({ page }) => {
    await page.getByRole('button', { name: 'International', exact: true }).click();

    await expect(page.getByRole('button', { name: 'International', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(page.getByText('5 journeys found')).toBeVisible();

    await expect(page.getByTestId('packages-filtered-results')).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'International journeys' })).toBeVisible();
    await expect(page.getByText('No journeys match this filter yet.')).toHaveCount(0);
  });

  test('N=1: filtering to Beach yields a single journey, in the singular, with no empty rails', async ({ page }) => {
    await page.getByRole('button', { name: 'Beach', exact: true }).click();

    // Exactly one package (Goa Beach Holiday) carries the Beach category, so
    // the live-region copy must read "journey", not "journeys".
    await expect(page.getByText('1 journey found')).toBeVisible();
    await expect(page.getByText('journeys found')).toHaveCount(0);

    await expect(page.getByRole('link', { name: /Goa Beach Holiday/ })).toBeVisible();
    await expect(page.getByTestId('packages-filtered-results')).toHaveCount(1);
    await expect(page.getByText('No journeys match this filter yet.')).toHaveCount(0);
  });

  /**
   * F4 — the arrow is gated on MEASURED overflow, which only a real browser can
   * actually decide. The jsdom unit test can simulate `scrollWidth`; this is
   * the one that proves the real layout agrees.
   */
  test('offers no scroll arrow on a rail whose cards already fit', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/tour-packages');

    // Trending keeps 2 of its 5 tours (three are pricingUnverified), so at this
    // width there is nothing to scroll to — the arrow used to show regardless.
    await expect(page.getByRole('button', { name: 'Scroll Trending Tour Packages' })).toHaveCount(0);

    // Every arrow that IS on the page belongs to a row that genuinely overflows.
    const arrows = page.getByRole('button', { name: /^Scroll / });
    for (let index = 0; index < (await arrows.count()); index += 1) {
      const row = arrows.nth(index).locator('xpath=preceding-sibling::div[1]');
      const overflow = await row.evaluate((node) => node.scrollWidth - node.clientWidth);
      expect(overflow).toBeGreaterThan(1);
    }
  });

  test('Clear returns to the unfiltered All view', async ({ page }) => {
    await page.getByRole('button', { name: 'Beach', exact: true }).click();
    await expect(page.getByText('1 journey found')).toBeVisible();

    await page.getByRole('button', { name: /^Clear/ }).click();

    await expect(page.getByRole('button', { name: 'All', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText(`${LISTED_COUNT} journeys found`)).toBeVisible();
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
    await expect(page.getByText(`${LISTED_COUNT} journeys found`)).toBeVisible();
  });

  test('an unknown package slug renders the branded 404, not a crash', async ({ page }) => {
    const response = await page.goto('/tour-packages/this-package-does-not-exist');

    expect(response?.status()).toBe(404);
  });
});

/**
 * C1 — the three tours whose prices the design export transcribed twice, with
 * disagreeing figures. They were rendering full "was ₹X / Save ₹Y" badges off
 * numbers nobody had confirmed.
 */
test.describe('tours with unconfirmed pricing are withheld everywhere', () => {
  const WITHHELD = [
    { name: 'Do Dham Yatra', slug: 'do-dham-yatra' },
    { name: 'Kashmir Family Escape', slug: 'kashmir-family-escape' },
    { name: 'Kashi Darshan', slug: 'kashi-darshan' },
  ];

  for (const { name, slug } of WITHHELD) {
    test(`"${name}" appears in no listing on Home or the catalogue`, async ({ page }) => {
      for (const path of ['/', '/tour-packages']) {
        await page.goto(path);
        await expect(page.getByRole('link', { name: new RegExp(name) })).toHaveCount(0);
      }
    });

    test(`/tour-packages/${slug} 404s rather than quoting an unconfirmed price`, async ({ page }) => {
      const response = await page.goto(`/tour-packages/${slug}`);

      expect(response?.status()).toBe(404);
      await expect(page.getByRole('heading', { name: 'Page not found.' })).toBeVisible();
    });
  }

  test('every "Save ₹…" badge still on the page belongs to a confirmed tour', async ({ page }) => {
    await page.goto('/tour-packages');

    // The badges that remain are real; the withheld ones took their badges
    // with them rather than being shown without a discount.
    await expect(page.getByText(/Save ₹/).first()).toBeVisible();
    for (const { name } of WITHHELD) {
      await expect(page.getByText(new RegExp(name))).toHaveCount(0);
    }
  });
});

/** H1/M6 — copy and controls must match what the page can actually do. */
test.describe('catalogue copy and controls are honest', () => {
  test('promises no real-time availability, because none exists', async ({ page }) => {
    await page.goto('/tour-packages');

    const main = page.getByRole('main');
    await expect(main.getByText(/real[\s-]?time/i)).toHaveCount(0);
    await expect(main.getByText(/availab(le|ility)/i)).toHaveCount(0);
    await expect(main.getByText('Find your perfect trip with easy filters.')).toBeVisible();
  });

  test('shows the real price bounds of the listed journeys, not a hardcoded band', async ({ page }) => {
    await page.goto('/tour-packages');

    await expect(page.getByTestId('filter-price-range')).toContainText('₹12,800 — ₹78,500');
    await expect(page.getByText('₹15,000 — ₹75,000')).toHaveCount(0);
  });

  test('marks the unwired travel-month field instead of presenting it as functional', async ({ page }) => {
    await page.goto('/tour-packages');

    const field = page.getByTestId('filter-travel-month');
    await expect(field).toHaveAttribute('aria-disabled', 'true');
    await expect(field).toContainText(/coming soon/i);
  });
});

/** H4/M2 — the primary CTAs were inert, and every link led to one unfiltered page. */
test.describe('filters, deep links and CTAs do real work', () => {
  test('?category= opens the catalogue pre-filtered', async ({ page }) => {
    await page.goto('/tour-packages?category=International');

    await expect(page.getByRole('button', { name: 'International', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(page.getByText('5 journeys found')).toBeVisible();
  });

  test('?destination= opens the catalogue pre-filtered', async ({ page }) => {
    await page.goto('/tour-packages?destination=goa');

    await expect(page.getByText('1 journey found')).toBeVisible();
    await expect(page.getByRole('link', { name: /Goa Beach Holiday/ })).toBeVisible();
  });

  /** F6 — a single-destination deep link is the worst case for the rail split. */
  test('a single-destination deep link renders one results section and no empty-rail boxes', async ({ page }) => {
    await page.goto('/tour-packages?destination=goa');

    await expect(page.getByTestId('packages-filtered-results')).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Journeys in Goa' })).toBeVisible();
    await expect(page.getByText('No journeys match this filter yet.')).toHaveCount(0);

    // The four rail headings belong to the unfiltered browsing view only.
    for (const title of ['Trending Tour Packages', 'North India Tour Packages', 'South India Tour Packages']) {
      await expect(page.getByRole('heading', { name: title })).toHaveCount(0);
    }
  });

  /** F3 — every filtered variant of this route declares the plain route canonical. */
  test('every filtered URL declares /tour-packages as its canonical', async ({ page }) => {
    for (const url of ['/tour-packages', '/tour-packages?category=International', '/tour-packages?destination=goa']) {
      await page.goto(url);

      const canonical = page.locator('link[rel="canonical"]');
      await expect(canonical).toHaveCount(1);
      await expect(canonical).toHaveAttribute('href', /\/tour-packages$/);
    }
  });

  test('an unknown query value falls back to the full list rather than an empty page', async ({ page }) => {
    await page.goto('/tour-packages?category=Honeymoon&destination=atlantis');

    await expect(page.getByText(`${LISTED_COUNT} journeys found`)).toBeVisible();
  });

  test('the destination select filters for real', async ({ page }) => {
    await page.goto('/tour-packages');

    await page.getByLabel('Destination').selectOption('maldives');

    await expect(page.getByText('1 journey found')).toBeVisible();
    await expect(page.getByRole('link', { name: /Maldives Escape/ })).toBeVisible();
  });

  test('"Search Tours" is not inert', async ({ page }) => {
    await page.goto('/tour-packages?category=Beach');

    await page.getByRole('button', { name: /Search Tours/ }).click();

    // Still filtered, and the results are now in view rather than nothing
    // having happened at all.
    await expect(page.getByText('1 journey found')).toBeVisible();
    await expect(page.getByTestId('packages-results')).toBeInViewport();
  });

  test('"View All Packages" clears the active filter instead of doing nothing', async ({ page }) => {
    await page.goto('/tour-packages?category=Beach');
    await expect(page.getByText('1 journey found')).toBeVisible();

    await page.getByRole('button', { name: /View All Packages/ }).first().click();

    await expect(page.getByText(`${LISTED_COUNT} journeys found`)).toBeVisible();
    await expect(page.getByRole('button', { name: 'All', exact: true })).toHaveAttribute('aria-pressed', 'true');
  });

  test('a Home destination card lands on matching results, not the whole catalogue', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: 'Dubai', exact: true }).click();

    await expect(page).toHaveURL(/destination=dubai/);
    await expect(page.getByText('1 journey found')).toBeVisible();
    await expect(page.getByRole('link', { name: /Dubai City Break/ })).toBeVisible();
  });

  test('"View All International Tours" lands on the International category', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: /View All International Tours/ }).click();

    await expect(page).toHaveURL(/category=International/);
    await expect(page.getByText('5 journeys found')).toBeVisible();
  });

  test('every footer Top Destinations link resolves to at least one journey', async ({ page }) => {
    await page.goto('/');

    const hrefs = await page
      .getByRole('contentinfo')
      .locator('a[href*="destination="]')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));

    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      await page.goto(href);
      await expect(page.getByText('0 journeys found')).toHaveCount(0);
    }
  });
});
