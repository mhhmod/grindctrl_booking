import { test, expect, setupPage, waitForShoelace } from './fixtures';

test.describe('Loading and empty states', () => {
  test('home page shows Exception Desk ghost skeleton before interaction', async ({ page }) => {
    await setupPage(page);

    // Resolution panel starts in empty/ghost state
    const emptyState = page.locator('#ed-resolution-empty');
    await expect(emptyState).toBeVisible();

    // Ghost labels are visible
    const ghostLabels = page.locator('.ed-ghost-label');
    expect(await ghostLabels.count()).toBeGreaterThanOrEqual(3);
  });

  test('drop zone shows upload/paste/demo options', async ({ page }) => {
    await setupPage(page);

    const dropZone = page.locator('#ed-drop-zone');
    await expect(dropZone).toBeVisible();

    // Three action buttons
    await expect(page.locator('#ed-paste-btn')).toBeVisible();
    await expect(page.locator('#ed-upload-btn')).toBeVisible();
    await expect(page.locator('#ed-demo-btn')).toBeVisible();

    // Drop subtitle describes accepted formats
    const subtitle = page.locator('.ed-drop-subtitle');
    await expect(subtitle).toBeVisible();
  });

  test('home page active section displays immediately (no FOUC)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500); // shorter wait — check early state

    // Home section should already be active (not flickering with other pages)
    const homeSection = page.locator('#page-home');
    await expect(homeSection).toHaveClass(/active/);

    // Other sections should be hidden
    const solutionsSection = page.locator('#page-solutions');
    await expect(solutionsSection).not.toHaveClass(/active/);
  });

  test('page transitions show correct active section', async ({ page }) => {
    await setupPage(page);

    // Home active
    await expect(page.locator('#page-home')).toHaveClass(/active/);
    await expect(page.locator('#page-book')).not.toHaveClass(/active/);

    // Navigate to book
    await page.locator('.nav-link[data-nav="book"]').click();
    await page.waitForTimeout(500);

    // Book active, home hidden
    await expect(page.locator('#page-book')).toHaveClass(/active/);
    await expect(page.locator('#page-home')).not.toHaveClass(/active/);
  });

  test('install page mockup panel shows greeting on open', async ({ page }) => {
    await setupPage(page);

    // Navigate to install
    await page.locator('.nav-link[data-nav="install"]').click();
    await page.waitForTimeout(500);

    // Open mockup panel
    const launcher = page.locator('#mockup-launcher');
    await launcher.click();
    await page.waitForTimeout(600);

    // Panel is visible
    const panel = page.locator('#mockup-panel');
    await expect(panel).toHaveCSS('opacity', '1');

    // Greeting message visible
    const greeting = page.locator('#mockup-greeting');
    await expect(greeting).toBeVisible();

    // Intent buttons visible
    const intents = page.locator('#mockup-intents');
    await expect(intents).toBeVisible();
    const intentBtns = intents.locator('button');
    expect(await intentBtns.count()).toBe(3);
  });
});
