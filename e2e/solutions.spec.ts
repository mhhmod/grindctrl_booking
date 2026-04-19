import { test, expect, SEL, setupPage } from './fixtures';

test.describe('How It Works page', () => {
  test('hero section with badge, title, description', async ({ page }) => {
    await setupPage(page);

    await page.locator(SEL.navLink('solutions')).click();
    await page.waitForTimeout(500);
    await expect(page.locator('#page-solutions')).toHaveClass(/active/);

    // Badge
    await expect(page.locator('[data-i18n="hiw_badge"]')).toBeVisible();

    // Hero title
    const h1 = page.locator('#page-solutions h1').first();
    await expect(h1).toBeVisible();

    // Description
    await expect(page.locator('[data-i18n="sol_hero_desc"]')).toBeVisible();
  });

  test('3-step cards: Embed, Configure, Support', async ({ page }) => {
    await setupPage(page);

    await page.locator(SEL.navLink('solutions')).click();
    await page.waitForTimeout(500);

    const cardsGrid = page.locator('#page-solutions .grid.grid-cols-1.md\\:grid-cols-3');
    await cardsGrid.scrollIntoViewIfNeeded();
    await expect(cardsGrid).toBeVisible();

    const cards = cardsGrid.locator('.ui-card');
    expect(await cards.count()).toBe(3);

    // Step labels
    await expect(page.locator('[data-i18n="hiw_step_1_label"]')).toBeVisible();
    await expect(page.locator('[data-i18n="hiw_step_2_label"]')).toBeVisible();
    await expect(page.locator('[data-i18n="hiw_step_3_label"]')).toBeVisible();
  });

  test('What It Catches grid has 4 exception cards', async ({ page }) => {
    await setupPage(page);

    await page.locator(SEL.navLink('solutions')).click();
    await page.waitForTimeout(500);

    const catchGrid = page.locator('#page-solutions .grid.sm\\:grid-cols-2');
    await catchGrid.scrollIntoViewIfNeeded();
    await expect(catchGrid).toBeVisible();

    // 4 cards
    const cards = catchGrid.locator('> div');
    expect(await cards.count()).toBe(4);

    // Each card has a trust state label
    const labels = catchGrid.locator('[data-i18n]');
    expect(await labels.count()).toBeGreaterThanOrEqual(4);
  });

  test('integration pills render and are visible', async ({ page }) => {
    await setupPage(page);

    await page.locator(SEL.navLink('solutions')).click();
    await page.waitForTimeout(500);

    const pillsContainer = page.locator('#page-solutions .flex.flex-wrap.gap-3');
    await pillsContainer.scrollIntoViewIfNeeded();
    await expect(pillsContainer).toBeVisible();

    // Multiple integration pills
    const pills = pillsContainer.locator('> div');
    const count = await pills.count();
    expect(count).toBeGreaterThanOrEqual(8);

    // First pill has icon + text
    const firstPill = pills.first();
    await expect(firstPill).toContainText('Outlook');
  });

  test('CTA section has Book a Demo and Ask a Question buttons', async ({ page }) => {
    await setupPage(page);

    await page.locator(SEL.navLink('solutions')).click();
    await page.waitForTimeout(500);

    const ctaSection = page.locator('[data-i18n="hiw_cta_title"]');
    await ctaSection.scrollIntoViewIfNeeded();
    await expect(ctaSection).toBeVisible();

    await expect(page.locator('[data-i18n="hiw_cta_book"]')).toBeVisible();
    await expect(page.locator('[data-i18n="hiw_cta_ask"]')).toBeVisible();
  });
});
