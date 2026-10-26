import { expect, type Page } from '@playwright/test';

/**
 * Helpers for the four lead flows now that they POST to a real
 * `/api/leads`.
 *
 * NOT a spec file — Playwright's default `testMatch` only collects
 * `**\/*.spec.ts`, so nothing here is picked up as a test.
 *
 * The house style is deliberate: `captureLeadRequests` observes and then
 * `route.continue()`s, so the REAL route still validates and answers. That
 * matters more than it sounds. A spec that stubs the response asserts only
 * that the client sends what the spec's author believed the server wants —
 * which is exactly the drift that produced BLOCKERS.md item 0 (a route with
 * four accepted `formType`s and a client that could produce two). Letting the
 * request through means a payload the server would reject fails the E2E run,
 * because the modal lands on its error banner instead of its done step.
 *
 * `stubLeadResponse` exists only for outcomes the real server cannot be made
 * to produce on demand (a 500, an offline device).
 */

export interface CapturedLead {
  formType?: string;
  [key: string]: unknown;
}

/**
 * Records every `/api/leads` body the page sends, and lets each one through to
 * the real handler.
 */
export async function captureLeadRequests(page: Page): Promise<CapturedLead[]> {
  const captured: CapturedLead[] = [];

  await page.route('**/api/leads', async (route) => {
    const body = route.request().postData();
    captured.push(body ? (JSON.parse(body) as CapturedLead) : {});
    await route.continue();
  });

  return captured;
}

/** Replaces the route's answer — for failure modes the real server will not produce. */
export async function stubLeadResponse(page: Page, status: number, body: unknown): Promise<void> {
  await page.route('**/api/leads', async (route) => {
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

/** Makes the request fail at the transport layer, as an offline device would. */
export async function failLeadRequests(page: Page): Promise<void> {
  await page.route('**/api/leads', async (route) => {
    await route.abort('failed');
  });
}

/**
 * Fills the required fields every lead form shares.
 *
 * CRM-migration Step 3 added a required consent checkbox, ticked here too —
 * omitting it would block every real submission on validation, the same as
 * an empty Name/Mobile always has. It does NOT handle `turnstileToken`:
 * that is set by the real Cloudflare Turnstile widget actually solving a
 * challenge in the browser, which needs `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
 * configured for the environment this suite runs against (Cloudflare
 * publishes a fixed always-passes test site key for exactly this use) —
 * see this migration's final report for that gap. Jest's own `LeadModal`
 * suite never has this problem because it mocks the widget outright; a real
 * browser E2E run cannot.
 */
export async function fillContactDetails(
  page: Page,
  { name = 'Asha Patel', mobile = '9876543210' }: { name?: string; mobile?: string } = {}
): Promise<void> {
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name *').fill(name);
  await dialog.getByLabel('Mobile Number *').fill(mobile);
  await dialog.getByLabel(/I agree to be contacted/).check();
}

/**
 * Waits for the done step. Asserted on the done-step heading rather than the
 * bare words "Your journey": Playwright's string matcher is a case-insensitive
 * substring, so it would also match the "Start Your Journey" CTA.
 */
export async function expectSubmissionConfirmed(page: Page): Promise<void> {
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: /starts here/i })).toBeVisible({ timeout: 15_000 });
  await expect(dialog.getByTestId('lead-form-error')).toHaveCount(0);
}

/** The single captured request, failing with the full list if there was not exactly one. */
export function onlyLead(captured: CapturedLead[]): CapturedLead {
  expect(captured, `expected exactly one /api/leads request, got ${JSON.stringify(captured, null, 2)}`).toHaveLength(1);
  return captured[0];
}
