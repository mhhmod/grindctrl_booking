import { test, expect, SEL, waitForShoelace } from './fixtures';

test.describe('Keyboard Accessibility — Header', () => {
  test('Tab cycles through header controls, Enter activates', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await waitForShoelace(page);

    // Tab to brand link
    await page.keyboard.press('Tab');
    await expect(page.locator(SEL.nav + ' a').first()).toBeFocused();

    // Tab to home nav link
    await page.keyboard.press('Tab');
    await expect(page.locator(SEL.navLink('home'))).toBeFocused();

    // Continue tabbing to install link
    await page.keyboard.press('Tab'); // solutions
    await page.keyboard.press('Tab'); // install
    await expect(page.locator(SEL.navLink('install'))).toBeFocused();

    // Enter navigates
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await expect(page.locator('#page-install')).toHaveClass(/active/);
  });
});
