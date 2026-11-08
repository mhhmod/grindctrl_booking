import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Deliberately offline: every navigation, script and API request is fulfilled
// locally. This certifies the reused host UI, not Shopify or Cloudflare services.
const engine = readFileSync('public/widget/v1/tryon-engine.js', 'utf8');
const adapters = readFileSync('public/widget/v1/tryon-paste.js', 'utf8');

for (const locale of ['en', 'ar']) {
  for (const theme of ['light', 'dark']) {
    test(`paste sheet responsive ${locale} ${theme}`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.route('**/*', async (route) => {
        const url = new URL(route.request().url());
        if (url.pathname === '/api/try-on/paste-context') {
          await route.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ context: { expiresAt: new Date(Date.now() + 120000).toISOString() },
              embedUrl: 'https://embed.example.test/embed/try-on?product=42&sheet=1' }) });
        } else if (url.pathname === '/embed/try-on') {
          await route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body>Offline embed fixture</body></html>' });
        } else {
          await route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="${locale}" dir="${locale === 'ar' ? 'rtl' : 'ltr'}" class="${theme}"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:16px;background:${theme === 'dark' ? '#222' : '#fff'}"><main><div data-grindctrl-tryon data-product-id="42" data-title="Dress" data-image="https://images.example.test/dress.jpg"></div></main></body></html>` });
        }
      });
      await page.goto('https://store.example.test/products/dress');
      await page.addScriptTag({ content: adapters });
      await page.addScriptTag({ content: engine });
      await page.evaluate(async ({ locale }) => {
        const runtime = window as unknown as {
          GRINDCTRL_TRYON_PASTE: { create: (options: unknown) => { prepare: () => Promise<boolean> } };
          GRINDCTRL_TRYON_ENGINE: { mount: (adapter: unknown) => void };
        };
        const script = document.createElement('script');
        Object.assign(script.dataset, { key: 'key', gcPlatform: 'website' });
        const adapter = runtime.GRINDCTRL_TRYON_PASTE.create({ script, appOrigin: 'https://embed.example.test', locale, visitorId: 'offline-visitor-123456' });
        await adapter.prepare();
        runtime.GRINDCTRL_TRYON_ENGINE.mount(adapter);
      }, { locale });
      for (const width of [320, 343, 375, 390, 480, 640, 768, 1024]) {
        await page.setViewportSize({ width, height: 850 });
        const button = page.locator('.gc-tryon-btn');
        await button.click();
        await expect(page.locator('.gc-tryon-sheet')).toBeVisible();
        await expect(page.locator('.gc-tryon-loading')).toBeHidden();
        const panel = await page.locator('.gc-tryon-sheet__panel').boundingBox();
        expect(panel!.x).toBeGreaterThanOrEqual(0);
        expect(panel!.x + panel!.width).toBeLessThanOrEqual(width + 1);
        const close = page.locator('.gc-tryon-sheet__close');
        const target = await close.boundingBox();
        expect(target!.width).toBeCloseTo(44, 3);
        expect(target!.height).toBeCloseTo(44, 3);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        expect(await page.locator('.gc-tryon-sheet').getAttribute('dir')).toBe(locale === 'ar' ? 'rtl' : 'ltr');
        if (width === 390) await page.screenshot({ path: `output/playwright/paste-${locale}-${theme}.png` });
        await close.click();
        await expect(page.locator('.gc-tryon-sheet')).toBeHidden();
        await expect(button).toBeFocused();
      }
      expect(errors).toEqual([]);
    });
  }
}
