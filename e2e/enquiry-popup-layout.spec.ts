import { expect, test, type Page } from '@playwright/test';

/**
 * New brief (2026-11-15, "horizontal card"): the popup must fit entirely
 * within 92vh at the listed desktop viewports with NO scrollbar anywhere —
 * not a `max-height` + `overflow-auto` trick, the content itself has to be
 * short enough (see `LeadModal.tsx`'s own header on the `clamp()`/`vh`
 * sizing this pins). This is a real, re-runnable test rather than a one-off
 * screenshot check for exactly that reason: a future change that pushes the
 * card's content back over budget should fail CI, not just look wrong in a
 * screenshot nobody re-opens.
 *
 * Submitting the form needs the REAL Cloudflare Turnstile widget to solve a
 * challenge (`e2e/support/leads.ts`'s own comment on that gap), so this
 * spec only ever opens the dialog and reads its layout — it never submits.
 * The brief's separate screenshot deliverable (which DOES need the
 * error/success states) is covered by `scratch/capture-popup-wide.mjs`
 * instead, against a locally-faked Turnstile script — see that script's own
 * header for why.
 */

/** 92vh budget viewports the brief names explicitly. */
const DESKTOP_VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 700 },
  { width: 1366, height: 640 },
  { width: 1280, height: 600 },
];

async function openPopup(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Enquire/i }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  // Let the enter transition finish.
  await page.waitForTimeout(250);
}

test.describe('Enquiry popup — horizontal card layout (no scrollbar at desktop)', () => {
  for (const viewport of DESKTOP_VIEWPORTS) {
    test(`fits within 92vh with no overflow at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await openPopup(page);

      const dialog = page.getByRole('dialog');
      const box = await dialog.boundingBox();
      expect(box, 'dialog should have a measurable bounding box').not.toBeNull();
      expect(box!.height).toBeLessThanOrEqual(viewport.height * 0.92);

      // The dialog's own scroll container must not be scrolled — its
      // content fits, it did not just get clipped.
      const dialogOverflow = await dialog.evaluate((el) => ({
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
      }));
      expect(dialogOverflow.scrollHeight).toBeLessThanOrEqual(dialogOverflow.clientHeight + 1);

      // No element inside the dialog computes to a scrolling overflow —
      // excluding native form controls, whose own internal scroll
      // mechanics (e.g. a <textarea> or <select>) are the browser's,
      // never a CSS class this component sets.
      const scrollingElements = await dialog.evaluate((el) => {
        const offenders: string[] = [];
        el.querySelectorAll('*').forEach((node) => {
          const tag = node.tagName.toLowerCase();
          if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
          const style = window.getComputedStyle(node);
          if (['auto', 'scroll'].includes(style.overflow) || ['auto', 'scroll'].includes(style.overflowY) || ['auto', 'scroll'].includes(style.overflowX)) {
            offenders.push(`${tag}.${Array.from(node.classList).join('.')}`);
          }
        });
        return offenders;
      });
      expect(scrollingElements).toEqual([]);
    });
  }

  test('the card is the reference width budget (min(1120px, 100vw-64px)) at 1920x1080, not a narrow column', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await openPopup(page);

    const box = await page.getByRole('dialog').boundingBox();
    expect(box!.width).toBeCloseTo(1120, 0);

    // The two-column grid (intro | cream box) — proof this is the
    // horizontal card, not the old single stacked column. (Curly
    // apostrophes throughout — `&rsquo;`, not a straight `'`, matching
    // what `LeadModal.tsx` actually renders.)
    await expect(page.getByText('The first step')).toBeVisible();
    await expect(page.getByText('Let’s make it personal.')).toBeVisible();
  });

  test('phone field is visible without clicking anything, as one bordered box the Name field\'s own height', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openPopup(page);

    const dialog = page.getByRole('dialog');
    const phoneInput = dialog.getByLabel('Mobile Number *');
    await expect(phoneInput).toBeVisible();
    // A native <select>'s current option text is not a separately queryable
    // DOM text node — assert on the select's own value instead.
    await expect(dialog.getByLabel('Country code')).toHaveValue('+91');

    // Same bordered box, same height, as the Name field right above it.
    const phoneBox = await phoneInput.evaluate((el) => el.closest('div')!.getBoundingClientRect().height);
    const nameBox = await dialog.getByLabel('Name *').evaluate((el) => el.getBoundingClientRect().height);
    // Within 2px — a 1px border on one side and not the other can show up
    // as a fraction of a pixel of real sub-pixel rounding here.
    expect(Math.abs(phoneBox - nameBox)).toBeLessThanOrEqual(2);
  });
});

test.describe('Enquiry popup — mobile (scroll allowed, scrollbar hidden)', () => {
  for (const viewport of [
    { width: 768, height: 1024 },
    { width: 375, height: 800 },
  ]) {
    test(`stacks to a single column with an 18px margin at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await openPopup(page);

      const dialog = page.getByRole('dialog');
      const box = await dialog.boundingBox();
      // 18px margin each side.
      expect(box!.width).toBeLessThanOrEqual(viewport.width - 35);
      expect(box!.width).toBeGreaterThanOrEqual(viewport.width - 40);

      // The proof pill is dropped at this width — "intro compact". It is
      // CSS-hidden (`hidden md:flex`-style), not conditionally rendered,
      // so it is still present in the DOM — assert on visibility, not
      // DOM presence. Scoped to the dialog: the home page behind it has
      // its own, unrelated "happy travellers" stat bands (Hero/
      // WhyGtyBand) that legitimately stay in the DOM while the modal is
      // open.
      const proofPill = dialog.getByText('happy travellers');
      if (await proofPill.count()) {
        await expect(proofPill.first()).not.toBeVisible();
      }

      // Scrolling is ALLOWED here, but its scrollbar must be hidden.
      const scrollbarWidth = await dialog.evaluate((el) => window.getComputedStyle(el).scrollbarWidth);
      expect(scrollbarWidth).toBe('none');
    });
  }
});
