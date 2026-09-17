import { expect, test, type Page } from '@playwright/test';

/**
 * The tour CMS (Phase B), end to end against the real standalone production
 * server.
 *
 * ## Two tiers, the same split as `admin-auth.spec.ts`
 *
 * Everything provable WITHOUT a credential runs unconditionally: that each new
 * route is genuinely session-gated, that the mutating actions reject an
 * anonymous POST, and that no draft content is served to the public. That is the
 * half which guards the security properties, and it is the half that matters
 * most here — a new admin route that forgot `requireAdminSession()` would be a
 * content-management surface open to the internet.
 *
 * The signed-in half needs a real account in a real database, so it reads
 * `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` and SKIPS when they are absent. No
 * credential is invented or defaulted — a test that passed because it made up a
 * password would be worse than one that says it did not run.
 *
 *   ADMIN_SEED_EMAIL="e2e@example.test" ADMIN_SEED_PASSWORD="<passphrase>" npm run db:seed:admin
 *   E2E_ADMIN_EMAIL="e2e@example.test" E2E_ADMIN_PASSWORD="<passphrase>" npx playwright test admin-tours
 */

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;
const HAS_CREDENTIALS = Boolean(ADMIN_EMAIL && ADMIN_PASSWORD);

/** Unique per run, so a crashed run cannot collide with the next one. */
const RUN_ID = Date.now().toString(36);
const DRAFT_SLUG = `zz-e2e-draft-${RUN_ID}`;
const DRAFT_NAME = `ZZ E2E Draft ${RUN_ID}`;

const NEW_ROUTES = ['/admin/tours', '/admin/tours/new', '/admin/tours/spiti-valley-circuit/edit'];

test.describe('the tour CMS routes are session-gated', () => {
  for (const route of NEW_ROUTES) {
    test(`${route} redirects an anonymous visitor to the login page`, async ({ page }) => {
      await page.goto(route);

      await expect(page).toHaveURL(/\/admin\/login/);
      await expect(page.getByRole('heading', { name: /staff sign-in/i })).toBeVisible();
    });
  }

  test('no tour management markup is streamed to an anonymous visitor', async ({ page }) => {
    // A gate that redirects AFTER streaming the page has already leaked it. The
    // assertion is on the RESPONSE BODY rather than on what renders, because a
    // client-side redirect would still have put the content on the wire.
    const response = await page.goto('/admin/tours');
    const body = (await response?.text()) ?? '';

    expect(body).not.toContain('+ New Tour');
    expect(body).not.toContain('Last updated');
  });
});

test.describe('the mutating actions reject anonymous callers', () => {
  /**
   * Server actions are POST endpoints with stable IDs, reachable without ever
   * loading the page that renders their form — which is exactly why
   * `requireAdminSession()` is called inside each action rather than relying on
   * `proxy.ts` or the layout.
   *
   * A bare POST cannot carry a valid action ID, so this cannot assert "the
   * publish action ran and was refused". What it CAN assert is the property that
   * matters: no anonymous POST to these paths ever succeeds, and none of them
   * returns tour-management content.
   */
  for (const route of ['/admin/tours', '/admin/tours/new']) {
    test(`POST ${route} does not succeed anonymously`, async ({ request }) => {
      const response = await request.post(route, {
        form: { slug: 'spiti-valley-circuit', publish: 'true' },
        maxRedirects: 0,
      });

      expect(response.status()).not.toBe(200);
      expect(await response.text()).not.toContain('Unpublish');
    });
  }
});

test.describe('the public site is unaffected by the CMS', () => {
  test('the tour catalogue still renders its published tours', async ({ page }) => {
    // The draft gate is new, and the failure mode worth guarding against is not
    // "a draft leaked" but its mirror image: the gate over-applying and emptying
    // the live catalogue. A migration that left every tour DRAFT would do
    // exactly that, silently.
    await page.goto('/tour-packages');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const cards = page.locator('a[href^="/tour-packages/"]');
    expect(await cards.count()).toBeGreaterThan(0);
  });

  test('the tours API returns a non-empty published catalogue and no status field', async ({ request }) => {
    const response = await request.get('/api/tours');
    expect(response.status()).toBe(200);

    const body = (await response.json()) as { data: Record<string, unknown>[] };
    expect(body.data.length).toBeGreaterThan(0);

    // Every tour on this endpoint is PUBLISHED by construction, so a `status`
    // key would be a constant implying a distinction the endpoint never exposes
    // — the same reasoning that keeps `pricingUnverified` off the wire.
    for (const tour of body.data) {
      expect(tour).not.toHaveProperty('status');
      expect(tour).not.toHaveProperty('archivedAt');
    }
  });

  test('a slug that does not exist 404s on both the page and the API', async ({ page, request }) => {
    const response = await request.get(`/api/tours/${DRAFT_SLUG}`);
    expect(response.status()).toBe(404);

    const pageResponse = await page.goto(`/tour-packages/${DRAFT_SLUG}`);
    expect(pageResponse?.status()).toBe(404);
  });
});

async function signIn(page: Page): Promise<void> {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(ADMIN_EMAIL!);
  await page.getByLabel('Password').fill(ADMIN_PASSWORD!);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/admin(?!\/login)/);
}

test.describe('the draft → publish → archive lifecycle', () => {
  test.skip(!HAS_CREDENTIALS, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run the signed-in tier.');

  // Serial: these steps build on each other's state in a shared database.
  test.describe.configure({ mode: 'serial' });

  test('creates a tour as a draft, and the public site never sees it', async ({ page, request }) => {
    await signIn(page);

    await page.goto('/admin/tours/new');
    await page.getByLabel('Tour name').fill(DRAFT_NAME);
    await page.getByLabel('Slug').fill(DRAFT_SLUG);
    await page.getByLabel('Destination').selectOption({ index: 1 });
    await page.getByLabel('Duration').fill('3 Days 2 Nights');
    await page.getByLabel('Short description').fill('Created by the E2E suite.');
    await page.getByLabel('Price', { exact: true }).fill('₹12,345');

    await page.getByRole('button', { name: 'Save as Draft' }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/tours/${DRAFT_SLUG}/edit`));
    await expect(page.getByText(/not visible on the public site/i)).toBeVisible();

    // THE assertion. The tour exists, the admin can see it, the public cannot.
    expect((await request.get(`/api/tours/${DRAFT_SLUG}`)).status()).toBe(404);
    expect((await page.goto(`/tour-packages/${DRAFT_SLUG}`))?.status()).toBe(404);

    const listBody = await (await request.get('/api/tours')).text();
    expect(listBody).not.toContain(DRAFT_SLUG);
    expect(listBody).not.toContain(DRAFT_NAME);
  });

  test('shows the draft in the admin list under the Draft filter', async ({ page }) => {
    await signIn(page);
    await page.goto('/admin/tours?status=DRAFT');
    await expect(page.getByText(DRAFT_NAME)).toBeVisible();
  });

  test('publishing makes it public; unpublishing hides it again', async ({ page, request }) => {
    await signIn(page);
    await page.goto(`/admin/tours/${DRAFT_SLUG}/edit`);

    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page).toHaveURL(/saved=publish/);

    expect((await request.get(`/api/tours/${DRAFT_SLUG}`)).status()).toBe(200);

    await page.getByRole('button', { name: 'Save as Draft' }).click();
    await expect(page).toHaveURL(/saved=draft/);
    expect((await request.get(`/api/tours/${DRAFT_SLUG}`)).status()).toBe(404);
  });

  test('archiving hides it from the public site and the default admin list, but keeps it findable', async ({
    page,
    request,
  }) => {
    await signIn(page);

    // Publish first, so archiving is the only thing that can hide it.
    await page.goto(`/admin/tours/${DRAFT_SLUG}/edit`);
    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page).toHaveURL(/saved=publish/);
    expect((await request.get(`/api/tours/${DRAFT_SLUG}`)).status()).toBe(200);

    await page.goto('/admin/tours?status=PUBLISHED');
    const row = page.locator('tr', { hasText: DRAFT_NAME });
    await row.getByRole('button', { name: 'Archive' }).click();

    // Gone from the public site...
    expect((await request.get(`/api/tours/${DRAFT_SLUG}`)).status()).toBe(404);

    // ...gone from the default admin view...
    await page.goto('/admin/tours');
    await expect(page.getByText(DRAFT_NAME)).toHaveCount(0);

    // ...but still there, and still findable. This is the difference between
    // archiving and deleting, and it is the whole reason archiving exists.
    await page.goto('/admin/tours?status=ARCHIVED');
    await expect(page.getByText(DRAFT_NAME)).toBeVisible();
  });

  test('a slug collision is refused rather than silently suffixed', async ({ page }) => {
    await signIn(page);

    await page.goto('/admin/tours/new');
    await page.getByLabel('Tour name').fill('Collision Attempt');
    await page.getByLabel('Slug').fill(DRAFT_SLUG);
    await page.getByLabel('Destination').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Save as Draft' }).click();

    // Named, and the message says the conflict is with an archived tour — which
    // the admin could not otherwise find, since archived tours are hidden from
    // the default list.
    await expect(page.getByText(/already used by an ARCHIVED tour/i)).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/tours\/new/);
  });
});
