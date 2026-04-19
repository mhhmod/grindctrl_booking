import { test, expect, SEL, waitForShoelace } from './fixtures';

test.describe('Install Widget Page', () => {
  test('code snippet, mockup, and plan tiers render correctly', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await waitForShoelace(page);

    await page.locator(SEL.navLink('install')).click();
    await page.waitForTimeout(500);
    await expect(page.locator('#page-install')).toHaveClass(/active/);

    // Hero visible
    await expect(page.locator('#page-install h1').first()).toBeVisible();

    // Code snippet with embed code
    const snippet = page.locator('#install-snippet');
    await expect(snippet).toBeVisible();
    expect(await snippet.textContent()).toContain('GrindctrlSupport.init');

    // Copy button exists and is clickable
    const copyBtn = page.locator('[onclick="copyInstallSnippet()"]');
    await expect(copyBtn).toBeEnabled();

    // Phone mockup with launcher
    await expect(page.locator('#mockup-phone-frame')).toBeVisible();
    await expect(page.locator('#mockup-launcher')).toBeVisible();

    // Plan tiers
    await page.locator('[data-i18n="install_pricing_title"]').scrollIntoViewIfNeeded();
    const planNames = ['plan_trial', 'plan_starter', 'plan_growth', 'plan_premium'];
    for (const key of planNames) {
      await expect(page.locator(`#page-install [data-i18n="${key}"]`)).toBeVisible();
    }

    // Popular badge on Growth tier
    await expect(page.locator('#page-install [data-i18n="popular_badge"]')).toBeVisible();
  });
});
