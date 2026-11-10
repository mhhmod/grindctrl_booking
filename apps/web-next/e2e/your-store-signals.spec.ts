import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { getYourStoreCopy } from '../lib/dashboard/your-store-copy';

// Fixture facts only: browser calls to APIs and external services are blocked.
for (const locale of ['en', 'ar'] as const) for (const theme of ['light', 'dark'] as const) {
  test('Store check signals: ' + locale + ' ' + theme, async ({ page, context, baseURL }) => {
    const copy = getYourStoreCopy(locale);
    await context.addCookies([{ name: 'gc-locale', value: locale, url: baseURL! }]);
    await page.addInitScript((theme) => localStorage.setItem('theme', theme), theme);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== new URL(baseURL!).origin || url.pathname.startsWith('/api/')) return route.abort();
      return route.continue();
    });
    for (const state of ['health-broken', 'health-off', 'health-working', 'health-easyorders']) {
      await page.goto('/dev/your-store-check?state=' + state + '&locale=' + locale);
      const check = page.locator('section[aria-labelledby="your-store-check"]');
      await expect(check).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      if (state === 'health-broken') {
        await expect(check.getByText(copy.rows.floating, { exact: true })).toBeVisible();
        await expect(check.getByRole('link', { name: copy.rows.pickSpot })).toHaveAttribute('href', '/dashboard/try-on/setup');
        await expect(check.getByText(copy.rows.missingDetails, { exact: true })).toBeVisible();
      } else if (state === 'health-off') {
        await expect(check.getByRole('region', { name: copy.check.moreYouCanAdd })).toContainText(copy.rows.pillsOff);
        await expect(check.getByRole('region', { name: copy.pill.waiting })).toBeVisible();
      } else if (state === 'health-working') {
        await expect(check.getByText(copy.rows.inlinePages(12, 12), { exact: true })).toBeVisible();
        await expect(check.getByText(copy.rows.pillProducts(24), { exact: true })).toBeVisible();
      } else await expect(check.getByText(copy.rows.easyOrdersPills, { exact: true })).toBeVisible();
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 950 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth), state + ' overflow at ' + width).toBeLessThanOrEqual(width);
        for (const control of await check.locator('a:visible,button:visible').all()) {
          const box = await control.boundingBox();
          expect(box!.height).toBeGreaterThanOrEqual(44);
          expect(box!.width).toBeGreaterThanOrEqual(44);
          expect(box!.x).toBeGreaterThanOrEqual(0);
          expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
        }
        if (width === 390 && (state === 'health-broken' || state === 'health-off')) {
          await page.screenshot({ path: 'output/playwright/store-signals-' + state + '-' + locale + '-' + theme + '.png', fullPage: true });
          const axe = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
          expect(axe.violations).toEqual([]);
        }
      }
    }
  });
}
