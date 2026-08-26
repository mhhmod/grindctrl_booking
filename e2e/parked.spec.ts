import { test, expect } from '@playwright/test';

/**
 * The legacy GitHub Pages landing is parked: it exists only to redirect
 * humans to grindctrl.cloud and point crawlers at the canonical domain.
 * These tests lock in exactly that much behavior — nothing more.
 */
test.describe('Parked legacy landing', () => {
  test('points visitors and crawlers at grindctrl.cloud', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveTitle(/GRINDCTRL/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://grindctrl.cloud/',
    );
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');

    const cta = page.locator('a[href="https://grindctrl.cloud/"]').first();
    await expect(cta).toBeVisible();
  });

  test('greets visitors in English and Arabic without console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    await page.goto('/', { waitUntil: 'load' });

    const body = await page.locator('body').innerText();
    expect(body).toContain("We've moved");
    expect(body).toContain('الموقع الرئيسي');
    expect(consoleErrors).toEqual([]);
  });

  test('stays usable at a narrow phone width (no horizontal overflow)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'load' });

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
