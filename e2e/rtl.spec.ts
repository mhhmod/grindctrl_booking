import { test, expect, SEL, setupPage } from './fixtures';

test.describe('RTL / Arabic toggle', () => {
  test('toggling to Arabic sets dir=rtl and swaps text', async ({ page }) => {
    await setupPage(page);

    // Default: ltr, English
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator(SEL.navLink('home'))).toHaveText(/Live Demo/);

    // Toggle to Arabic
    await page.locator(SEL.langToggle).click();
    await page.waitForTimeout(500);

    // dir=rtl
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    // Nav link text swapped to Arabic (not English)
    const homeText = await page.locator(SEL.navLink('home')).textContent();
    expect(homeText).not.toContain('Live Demo');

    // Toggle button shows "EN" to switch back
    await expect(page.locator(SEL.langToggle + ' span')).toHaveText('EN');
  });

  test('toggling back to English restores ltr', async ({ page }) => {
    await setupPage(page);

    // Switch to Arabic
    await page.locator(SEL.langToggle).click();
    await page.waitForTimeout(500);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    // Switch back to English
    await page.locator(SEL.langToggle).click();
    await page.waitForTimeout(500);

    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator(SEL.navLink('home'))).toHaveText(/Live Demo/);
    await expect(page.locator(SEL.langToggle + ' span')).toHaveText('عر');
  });

  test('RTL swaps body and headline font families', async ({ page }) => {
    await setupPage(page);

    const bodyFontBefore = await page.evaluate(() =>
      getComputedStyle(document.body).fontFamily
    );

    // Switch to Arabic
    await page.locator(SEL.langToggle).click();
    await page.waitForTimeout(500);

    const bodyFontAfter = await page.evaluate(() =>
      getComputedStyle(document.body).fontFamily
    );

    // Font family should change to Arabic font
    expect(bodyFontAfter).not.toBe(bodyFontBefore);
    expect(bodyFontAfter).toContain('IBM Plex Sans Arabic');
  });

  test('RTL drawer links have border accent on right side', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setupPage(page);

    // Switch to Arabic
    await page.locator(SEL.langToggle).click();
    await page.waitForTimeout(500);

    // Open drawer
    await page.locator(SEL.hamburger).click();
    await page.locator(SEL.drawer).evaluate((el: any) => el.show());
    await page.waitForTimeout(400);

    // Active link should have right border, not left
    const activeLink = page.locator('.drawer-link[data-nav="home"]');
    const borderRight = await activeLink.evaluate(el =>
      getComputedStyle(el).borderRightWidth
    );
    expect(borderRight).not.toBe('0px');
  });

  test('RTL language preference persists after reload', async ({ page }) => {
    await setupPage(page);

    await page.locator(SEL.langToggle).click();
    await page.waitForTimeout(500);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    const homeText = await page.locator(SEL.navLink('home')).textContent();
    expect(homeText).not.toContain('Live Demo');
  });
});
