import { test, expect, SEL, waitForShoelace, openDrawer } from './fixtures';

test.describe('Mobile Drawer', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('hamburger visible, opens drawer with all links + CTA', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await waitForShoelace(page);

    await expect(page.locator(SEL.hamburger)).toBeVisible();

    await openDrawer(page);
    const drawer = page.locator(SEL.drawer);
    await expect(drawer).toHaveAttribute('open', '');

    const links = drawer.locator('.drawer-link[data-nav]');
    expect(await links.count()).toBe(4);

    await expect(drawer.locator('[data-i18n="drawer_start_trial"]')).toBeVisible();
    await expect(drawer.locator('.drawer-link[data-nav="home"]')).toHaveClass(/text-on-surface/);
  });

  test('drawer link navigates and closes, Escape closes', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await waitForShoelace(page);

    await openDrawer(page);
    const drawer = page.locator(SEL.drawer);
    await drawer.locator(SEL.drawerLink('solutions')).click();
    await page.waitForTimeout(500);

    await expect(drawer).not.toHaveAttribute('open', '');
    await expect(page.locator('#page-solutions')).toHaveClass(/active/);

    // Open again, press Escape
    await openDrawer(page);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await expect(drawer).not.toHaveAttribute('open', '');
  });
});
