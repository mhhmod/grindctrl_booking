import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/* The auth form's surroundings at phone to desktop widths, in English and
   Arabic, drawn by the dev-only preview (app/dev/auth-check) so no Clerk key
   or session is needed. Clerk's own form is not drawn there and is not
   verified here: these checks cover the placeholder that stands in for it,
   the slow state that replaces the placeholder, the language and theme
   controls, the session-ended prompt and the claim mismatch notice.

   Set AUTH_SHOTS_DIR to also save screenshots. */

const WIDTHS = [320, 390, 768, 1280] as const;
const LOCALES = ['en', 'ar'] as const;
const SHOTS_DIR = process.env.AUTH_SHOTS_DIR;

async function open(page: Page, query: string, locale: 'en' | 'ar', theme: 'light' | 'dark' = 'light') {
  await page.context().addCookies([{ name: 'gc-locale', value: locale, url: page.url().startsWith('http') ? page.url() : 'http://localhost:3100' }]);
  await page.addInitScript((value) => {
    try {
      window.localStorage.setItem('theme', value);
    } catch {}
  }, theme);
  const response = await page.goto(`/dev/auth-check?${query}`);
  // The preview does not exist in a production build (CI's Docker candidate).
  test.skip(response?.status() === 404, 'dev-only preview is not served by this build');
}

async function noHorizontalOverflow(page: Page) {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(scroll).toBeLessThanOrEqual(client);
}

for (const locale of LOCALES) {
  for (const width of WIDTHS) {
    test(`placeholder, then the slow state, hold their place at ${width}px (${locale})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await open(page, 'state=sign-in&slow_ms=2500', locale);

      const placeholder = page.locator('[data-auth-form-state="loading"]');
      await expect(placeholder).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
      const footer = page.getByRole('link', { name: locale === 'ar' ? 'أنشئ حسابًا' : 'Create one' });
      const before = await footer.boundingBox();
      const placeholderBox = await placeholder.boundingBox();
      await noHorizontalOverflow(page);

      // Language and theme controls: visible, unclipped, 44px touch targets.
      for (const control of [
        page.getByRole('button', { name: locale === 'ar' ? 'Switch to English' : 'التبديل إلى العربية' }),
        page.getByRole('button', { name: locale === 'ar' ? /التبديل إلى الوضع/ : /Switch to (dark|light) mode/ }),
      ]) {
        await expect(control).toBeVisible();
        const box = await control.boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(44);
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      }

      const slow = page.locator('[data-auth-form-state="slow"]');
      await expect(slow).toBeVisible({ timeout: 10_000 });
      await expect(slow).toContainText(locale === 'ar' ? 'يستغرق هذا وقتًا أطول من المعتاد' : 'This is taking longer than usual');
      const slowBox = await slow.boundingBox();
      const after = await footer.boundingBox();
      // Nothing under the form moves when the slow state replaces the placeholder.
      expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(slowBox!.height - placeholderBox!.height)).toBeLessThanOrEqual(1);
      await expect(page.getByRole('button', { name: locale === 'ar' ? 'أعد المحاولة' : 'Try again' })).toBeVisible();
      await expect(page.getByRole('link', { name: locale === 'ar' ? 'تواصل مع الدعم' : 'Contact support' })).toHaveAttribute('href', 'mailto:grindctrlnow@gmail.com');
      await noHorizontalOverflow(page);
    });
  }

  test(`session-ended prompt and claim mismatch fit at 320px (${locale})`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await open(page, 'state=session-ended', locale);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('link', { name: locale === 'ar' ? 'سجّل الدخول مرة أخرى' : 'Sign in again' })).toBeVisible();
    await noHorizontalOverflow(page);

    await open(page, 'state=claim-mismatch', locale);
    await expect(page.getByRole('button', { name: locale === 'ar' ? 'استخدم حسابًا آخر' : 'Use a different account' })).toBeVisible();
    await noHorizontalOverflow(page);
  });
}

const SHOTS = [
  ['sign-in', 'state=sign-in&slow_ms=600000'],
  ['signed-out-sign-in', 'state=signed-out&slow_ms=600000'],
  ['sign-up', 'state=sign-up&slow_ms=600000'],
  ['loading-placeholder', 'state=sign-in&slow_ms=600000'],
  ['timeout-state', 'state=slow'],
  ['session-ended', 'state=session-ended'],
  ['claim-mismatch', 'state=claim-mismatch'],
] as const;

const SHOT_SETUPS = [
  { name: '390x844-en-dark', width: 390, height: 844, locale: 'en', theme: 'dark' },
  { name: '320x568-ar-light', width: 320, height: 568, locale: 'ar', theme: 'light' },
] as const;

for (const setup of SHOT_SETUPS) {
  test(`screenshots ${setup.name}`, async ({ page }) => {
    test.skip(!SHOTS_DIR, 'set AUTH_SHOTS_DIR to save screenshots');
    await page.setViewportSize({ width: setup.width, height: setup.height });
    for (const [name, query] of SHOTS) {
      await open(page, query, setup.locale, setup.theme);
      await expect(page.locator('html')).toHaveClass(setup.theme === 'dark' ? /dark/ : /^(?!.*dark)/);
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(SHOTS_DIR!, `${name}-${setup.name}.png`), fullPage: name !== 'session-ended' });
    }
  });
}
