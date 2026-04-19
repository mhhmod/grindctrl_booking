import { test, expect, SEL, waitForShoelace } from './fixtures';

test.describe('Home Page', () => {
  test('exception desk workspace renders with key elements', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await waitForShoelace(page);

    // Home section active
    await expect(page.locator('#page-home')).toHaveClass(/active/);

    // Drop zone visible with title
    await expect(page.locator('#ed-drop-zone')).toBeVisible();
    await expect(page.locator('.ed-drop-title')).toBeVisible();

    // Demo button exists
    await expect(page.locator('#ed-demo-btn')).toBeEnabled();

    // Trust legend has 3 items
    expect(await page.locator('.ed-trust-legend-item').count()).toBe(3);

    // Progression bar has 4 steps, first is active
    const steps = page.locator('.ed-prog-step');
    expect(await steps.count()).toBe(4);
    await expect(steps.first()).toHaveClass(/active/);
  });
});
