import { test, expect, SEL, setupPage } from './fixtures';

test.describe('Tablet viewport (768px)', () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test('desktop nav links are visible at 768px', async ({ page }) => {
    await setupPage(page);

    // Nav links container should be visible at 768px (breakpoint is min-width: 768px)
    const navLinks = page.locator(SEL.navLinks);
    await expect(navLinks).toBeVisible();

    // All 4 links present
    const count = await navLinks.locator('.nav-link').count();
    expect(count).toBe(4);
  });

  test('hamburger is hidden at 768px', async ({ page }) => {
    await setupPage(page);

    const hamburger = page.locator(SEL.hamburger);
    await expect(hamburger).toBeHidden();
  });

  test('header fits without wrapping at 768px', async ({ page }) => {
    await setupPage(page);

    const inner = page.locator('.gc-site-nav__inner');
    const box = await inner.boundingBox();
    expect(box).not.toBeNull();

    // Inner should not overflow the viewport
    expect(box!.width).toBeLessThanOrEqual(768);
  });

  test('footer grid has 4 columns at 768px', async ({ page }) => {
    await setupPage(page);

    const footerGrid = page.locator('footer .grid').first();
    const gridCols = await footerGrid.evaluate(el =>
      getComputedStyle(el).gridTemplateColumns
    );
    // md:grid-cols-4 at 768px should give 4 columns
    const colCount = gridCols.split(' ').length;
    expect(colCount).toBe(4);
  });

  test('How It Works cards are 3-column at 768px', async ({ page }) => {
    await setupPage(page);

    // Navigate to solutions
    await page.locator(SEL.navLink('solutions')).click();
    await page.waitForTimeout(500);

    // 3-step cards: md:grid-cols-3
    const cardsGrid = page.locator('#page-solutions .grid.grid-cols-1.md\\:grid-cols-3');
    const gridCols = await cardsGrid.evaluate(el =>
      getComputedStyle(el).gridTemplateColumns
    );
    const colCount = gridCols.split(' ').length;
    expect(colCount).toBe(3);
  });

  test('What It Catch cards are 2-column at 768px', async ({ page }) => {
    await setupPage(page);

    await page.locator(SEL.navLink('solutions')).click();
    await page.waitForTimeout(500);

    // "What It Catches" grid: sm:grid-cols-2 at 640px+, so 2 cols at 768px
    const catchGrid = page.locator('#page-solutions .grid.sm\\:grid-cols-2');
    await catchGrid.scrollIntoViewIfNeeded();
    const gridCols = await catchGrid.evaluate(el =>
      getComputedStyle(el).gridTemplateColumns
    );
    const colCount = gridCols.split(' ').length;
    expect(colCount).toBe(2);
  });
});
