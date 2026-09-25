import { test, expect, type Page } from '@playwright/test';

/* The public try-on page against a stubbed try-on API. CI builds with no
   secrets, so every /api/try-on/* route answers 503 there; these stubs
   follow the real contracts (see docs/handoff/site-v15/05-backend.md): a
   public-demo session, an attempt, then generate and job polling. Out of
   credits is HTTP 200 with ok: false and code TRYON_UNAVAILABLE. A real
   look from a real provider can only be checked by hand with
   TRYON_MODE=live and the owner's keys. */

/* A 2x2 PNG, small enough to pass the 8 MB and type checks. */
const PHOTO = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVQI12P4z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==',
  'base64',
);

type Mode = 'ok' | 'credits';

async function stubTryOnApi(page: Page, mode: Mode) {
  const calls = { generate: 0, polls: 0 };
  await page.route('**/api/try-on/session', (route) =>
    route.fulfill({
      json: {
        ok: true,
        data: { sessionId: 'sess-1', productId: 'demo', shop: null, variantId: null, garmentUrl: null, nonce: 'n', createdAt: '', expiresAt: '' },
      },
    }),
  );
  await page.route('**/api/try-on/attempt', (route) => route.fulfill({ json: { ok: true, data: { attemptId: 'att-1', expiresAt: '' } } }));
  await page.route('**/api/try-on/generate', (route) => {
    calls.generate += 1;
    if (mode === 'credits') return route.fulfill({ json: { ok: false, code: 'TRYON_UNAVAILABLE', message: 'Out of credits' } });
    return route.fulfill({
      json: { ok: true, jobId: 'job-1', status: 'processing', productId: 'demo', meta: { runtime: 'mock', provider: 'mock', costEstimate: 0 } },
    });
  });
  await page.route('**/api/try-on/jobs/*', (route) => {
    calls.polls += 1;
    return route.fulfill({
      json:
        calls.polls < 2
          ? { ok: true, jobId: 'job-1', status: 'processing' }
          : { ok: true, jobId: 'job-1', status: 'completed', resultImageUrl: '/try-on/mock-result.png', productId: 'demo', meta: { runtime: 'mock', provider: 'mock', costEstimate: 0 } },
    });
  });
  return calls;
}

async function open(page: Page, width = 1280) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/try-on');
  await page.evaluate(() => document.fonts.ready);
}

const lookCard = (page: Page) => page.locator('[data-lookcard]');

test.describe('try-on page', () => {
  test('a sample photo shows its stored look at once, with no generation call', async ({ page }) => {
    const calls = await stubTryOnApi(page, 'ok');
    await open(page);
    await page.getByRole('button', { name: /Use a sample photo/ }).first().click();
    await page.getByRole('button', { name: 'Create my look' }).click();
    await expect(lookCard(page).getByText('A sample look made by the try-on engine.', { exact: false })).toBeVisible();
    await expect(lookCard(page).locator('img').first()).toBeVisible();
    expect(calls.generate).toBe(0);
  });

  test('an uploaded photo goes through the try-on API and shows the result', async ({ page }) => {
    const calls = await stubTryOnApi(page, 'ok');
    await open(page);
    await page.locator('input[type="file"]').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: PHOTO });
    await page.getByRole('button', { name: 'Create my look' }).click();
    await expect(lookCard(page).locator('img[src*="mock-result"]').first()).toBeVisible({ timeout: 30_000 });
    expect(calls.generate).toBe(1);
    expect(calls.polls).toBeGreaterThanOrEqual(2);
  });

  test('out of credits lands in the failure state with its ways forward, and leaks nothing', async ({ page }) => {
    await stubTryOnApi(page, 'credits');
    await open(page);
    await page.locator('input[type="file"]').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: PHOTO });
    await page.getByRole('button', { name: 'Create my look' }).click();
    const card = lookCard(page);
    await expect(card.getByRole('alert')).toHaveText('Try-on is unavailable right now. Please try again later. Nothing was charged to you.');
    await expect(card.getByRole('button', { name: 'Try again' })).toBeEnabled();
    await expect(card.getByRole('button', { name: 'Use a sample photo' })).toBeVisible();
    await expect(card.getByRole('link', { name: /Open the demo store/ })).toHaveAttribute('href', 'https://grindctrl.myshopify.com');
    await expect(page.locator('main')).not.toContainText('Out of credits');
  });

  test('the piece picker traps focus and returns it to its button', async ({ page }) => {
    await stubTryOnApi(page, 'ok');
    await open(page);
    const opener = page.getByRole('button', { name: 'Change piece' });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Try another piece' });
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test('the compare dialog traps focus and returns it to its button', async ({ page }) => {
    await stubTryOnApi(page, 'ok');
    await open(page);
    /* Two sample looks, so there is something to compare. */
    await page.getByRole('button', { name: /Use a sample photo/ }).first().click();
    await page.getByRole('button', { name: 'Create my look' }).click();
    await page.getByRole('button', { name: 'Change piece' }).click();
    /* With a sample photo, the new piece's stored look shows at once. */
    await page.getByRole('dialog', { name: 'Try another piece' }).getByRole('button', { name: /Sage linen shirt/ }).click();
    const opener = page.getByRole('button', { name: 'Compare looks' });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Your looks side by side' });
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });
});
