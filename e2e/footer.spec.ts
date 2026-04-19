import { test, expect, SEL, setupPage } from './fixtures';

const pageFooter = 'footer.bg-surface-container-lowest';

test.describe('Footer', () => {
  test('footer renders with 4 columns: brand, product, access, newsletter', async ({ page }) => {
    await setupPage(page);

    const footer = page.locator(pageFooter);
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toBeVisible();

    await expect(footer.locator('[data-i18n="footer_desc"]')).toBeVisible();
    await expect(footer.locator('[data-i18n="footer_product_label"]')).toBeVisible();
    await expect(footer.locator('[data-i18n="footer_company"]')).toBeVisible();
    await expect(footer.locator('[data-i18n="footer_newsletter"]')).toBeVisible();
  });

  test('footer product links navigate to correct pages', async ({ page }) => {
    await setupPage(page);

    const footer = page.locator(pageFooter);
    await footer.scrollIntoViewIfNeeded();

    const howLink = footer.locator('a[href="#solutions"]');
    await howLink.click();
    await page.waitForTimeout(500);
    await expect(page.locator('#page-solutions')).toHaveClass(/active/);

    const bookLink = footer.locator('a[href="#book"]');
    await bookLink.click();
    await page.waitForTimeout(500);
    await expect(page.locator('#page-book')).toHaveClass(/active/);
  });

  test('footer has newsletter email input and submit button', async ({ page }) => {
    await setupPage(page);

    const footer = page.locator(pageFooter);
    await footer.scrollIntoViewIfNeeded();

    const emailInput = footer.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();

    const submitBtn = footer.locator('[data-i18n="footer_join"]');
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toBeEnabled();
  });

  test('footer bottom bar shows copyright and status', async ({ page }) => {
    await setupPage(page);

    const footer = page.locator(pageFooter);
    await footer.scrollIntoViewIfNeeded();

    await expect(footer.locator('[data-i18n="footer_copyright"]')).toBeVisible();
    await expect(footer.locator('[data-i18n="footer_status"]')).toBeVisible();
    await expect(footer.locator('text=Dubai · Riyadh · Global')).toBeVisible();
  });

  test('footer 4-column grid at desktop, 2-column at mobile', async ({ page }) => {
    await setupPage(page);

    const footerGrid = page.locator(pageFooter + ' .grid').first();
    await footerGrid.scrollIntoViewIfNeeded();

    const gridCols = await footerGrid.evaluate(el =>
      getComputedStyle(el).gridTemplateColumns
    );
    expect(gridCols.split(' ').length).toBe(4);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);

    const mobileGridCols = await footerGrid.evaluate(el =>
      getComputedStyle(el).gridTemplateColumns
    );
    expect(mobileGridCols.split(' ').length).toBe(2);
  });
});
