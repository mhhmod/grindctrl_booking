import { test, expect, SEL, waitForShoelace } from './fixtures';

test.describe('Header / Nav — desktop', () => {
  test('header renders with logo, nav links, action buttons', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await waitForShoelace(page);

    // Nav visible with logo
    const nav = page.locator(SEL.nav);
    await expect(nav).toBeVisible();
    await expect(page.locator(SEL.logoText)).toHaveText('GRINDCTRL');

    // 4 nav links visible at 1280px
    const navLinks = page.locator(SEL.navLinks);
    await expect(navLinks).toBeVisible();
    expect(await navLinks.locator('.nav-link').count()).toBe(4);

    // Hamburger hidden at 1280px
    await expect(page.locator(SEL.hamburger)).toBeHidden();

    // Theme + lang toggles visible
    await expect(page.locator(SEL.themeToggle)).toBeVisible();
    await expect(page.locator(SEL.langToggle)).toBeVisible();

    // Header is position fixed (stays at top)
    await expect(nav).toHaveCSS('position', 'fixed');
  });

  test('nav links activate correct pages', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await waitForShoelace(page);

    // Home active by default
    await expect(page.locator(SEL.navLink('home'))).toHaveClass(/active/);

    // Navigate to install
    await page.locator(SEL.navLink('install')).click();
    await page.waitForTimeout(500);

    await expect(page.locator('#page-install')).toHaveClass(/active/);
    await expect(page.locator(SEL.navLink('install'))).toHaveClass(/active/);
    await expect(page.locator(SEL.navLink('home'))).not.toHaveClass(/active/);
  });
});
