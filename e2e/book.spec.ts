import { test, expect, SEL, waitForShoelace } from './fixtures';

test.describe('Book a Call Page', () => {
  test('scheduling section renders with calendar, slots, CTA', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await waitForShoelace(page);

    await page.locator(SEL.navLink('book')).click();
    await page.waitForTimeout(500);
    await expect(page.locator('#page-book')).toHaveClass(/active/);

    // Hero headline visible
    await expect(page.locator('#page-book h1').first()).toBeVisible();

    // Calendar: 7-column grid with day headers
    const calendarHeader = page.locator('.grid.grid-cols-7').first();
    await expect(calendarHeader).toBeVisible();
    expect(await calendarHeader.locator('div').count()).toBe(7);

    // Time slots: 3-col grid
    const slots = page.locator('.grid.grid-cols-3');
    await expect(slots).toBeVisible();
    expect(await slots.locator('div').count()).toBe(3);

    // Schedule CTA
    await expect(page.locator('[data-i18n="book_confirm"]')).toBeEnabled();

    // Social proof avatars
    expect(await page.locator('.w-10.h-10.rounded-xl').count()).toBeGreaterThanOrEqual(3);
  });
});
