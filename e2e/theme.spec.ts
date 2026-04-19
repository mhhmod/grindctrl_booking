import { test, expect, SEL, waitForShoelace } from './fixtures';

test.describe('Theme Toggle', () => {
  test('toggles dark → light → dark with correct icons and logos', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await waitForShoelace(page);

    const html = page.locator('html');
    const themeBtn = page.locator(SEL.themeToggle);

    // Starts dark
    await expect(html).toHaveClass(/dark/);
    await expect(page.locator('.theme-icon-dark')).toBeVisible();
    await expect(page.locator('.theme-icon-light')).toBeHidden();

    // Toggle to light
    await themeBtn.click();
    await expect(html).not.toHaveClass(/dark/);
    await expect(page.locator('.theme-icon-light')).toBeVisible();
    await expect(page.locator('.logo-light').first()).toBeVisible();

    // Toggle back to dark
    await themeBtn.click();
    await expect(html).toHaveClass(/dark/);
    await expect(page.locator('.theme-icon-dark')).toBeVisible();
  });

  test('theme persists after reload', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await waitForShoelace(page);

    const themeBtn = page.locator(SEL.themeToggle);
    await themeBtn.click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);

    // Reload
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Still light
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });
});
