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
    await expect(drawer.locator('.drawer-link[data-nav="home"]')).toHaveClass(/drawer-link/);
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

  test('drawer links use semantic CSS classes', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await waitForShoelace(page);

    await openDrawer(page);
    const drawer = page.locator(SEL.drawer);

    const allLinks = drawer.locator('.drawer-link');
    expect(await allLinks.count()).toBeGreaterThanOrEqual(1);

    const firstLink = allLinks.first();
    await expect(firstLink).toHaveClass(/drawer-link/);

    const computedStyle = await firstLink.evaluate(el => {
      const s = getComputedStyle(el);
      return {
        display: s.display,
        borderRadius: s.borderRadius,
        fontSize: s.fontSize,
      };
    });
    expect(computedStyle.display).not.toBe('inline');
    expect(computedStyle.borderRadius).not.toBe('0px');
  });

  test('drawer CTA uses gc-auth-drawer-cta class', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await waitForShoelace(page);

    await openDrawer(page);
    const drawer = page.locator(SEL.drawer);

    const cta = drawer.locator('.gc-auth-drawer-cta');
    if (await cta.isVisible()) {
      const ctaStyle = await cta.evaluate(el => {
        const s = getComputedStyle(el);
        return { borderRadius: s.borderRadius, fontWeight: s.fontWeight };
      });
      expect(ctaStyle.borderRadius).not.toBe('0px');
    }
  });
});
