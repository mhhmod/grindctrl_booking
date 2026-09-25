import { test, expect } from '@playwright/test';

/* Real-user checks for the fixes made in this pass, as opposed to
   mobile-overflow.spec.ts's layout sweep. Each test targets the exact
   symptom the owner reported, not an implementation detail, so it stays
   meaningful even if the fix is later refactored. */

test.describe('theme defaults to light', () => {
  test('a fresh visitor with no theme preference gets light, not dark', async ({ page, context }) => {
    // No cookies, no localStorage — genuinely first-ever visit.
    await context.clearCookies();
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.classList.length > 0);
    const htmlClass = await page.evaluate(() => document.documentElement.className);
    expect(htmlClass).toContain('light');
    expect(htmlClass).not.toContain('dark');
  });
});

test.describe('try-on live demo — Arabic actually renders', () => {
  /* The v15 try-on page replaced the old hero badge and its #tryon-locale-toggle.
     The checks follow the same two symptoms on the new page: Arabic must
     really render (not English fallbacks), and the language control must
     offer English once the page is Arabic. */
  test('Arabic strings appear in the heading and the footer controls, not English fallbacks', async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'gc-locale', value: 'ar', url: baseURL! }]);
    await page.goto('/try-on');
    await page.evaluate(() => document.fonts.ready);

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { level: 1, name: 'شاهدها عليك قبل الشراء.' })).toBeVisible();

    /* Regression: ThemeToggle once rendered with no locale prop on this page,
       so its aria-label was always English regardless of site locale. */
    const themeToggle = page.getByRole('button', { name: /التبديل إلى/ });
    await expect(themeToggle.first()).toBeAttached();
    const englishThemeToggle = page.getByRole('button', { name: /^Switch to (light|dark) mode$/ });
    await expect(englishThemeToggle).toHaveCount(0);
  });

  test('the language switch offers "English", not a leftover Arabic label, once already in Arabic', async ({
    page,
    context,
    baseURL,
  }) => {
    await context.addCookies([{ name: 'gc-locale', value: 'ar', url: baseURL! }]);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/try-on');
    const toggle = page.getByRole('banner').getByRole('button', { name: 'Switch to English' });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveText('English');
    await expect(toggle).toHaveAttribute('lang', 'en');
  });
});

test.describe('sign-in — no blank flash', () => {
  test('the form pane reserves its height immediately, before Clerk finishes loading', async ({ page }) => {
    await page.goto('/sign-in');

    // Checked right after the DOM is parsed, deliberately not waiting for
    // Clerk's JS bundle — the whole point is the space is reserved before
    // Clerk mounts, not after.
    const missingEnvAlert = page.getByText('Clerk environment variables are missing');
    if (await missingEnvAlert.isVisible().catch(() => false)) {
      test.skip(true, 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY not configured in this environment');
    }

    const formPane = page.locator('.gc-auth-form-pane > div > div').nth(1);
    const box = await formPane.boundingBox();
    expect(box, 'form pane should have a bounding box at all').not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(400);
  });

  test('something visible occupies the form pane immediately (skeleton or the real form), never empty', async ({
    page,
  }) => {
    await page.goto('/sign-in');

    const missingEnvAlert = page.getByText('Clerk environment variables are missing');
    if (await missingEnvAlert.isVisible().catch(() => false)) {
      test.skip(true, 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY not configured in this environment');
    }

    const formPane = page.locator('.gc-auth-form-pane > div > div').nth(1);
    // A truthy childElementCount right away means either the skeleton or
    // Clerk's real form mounted — not an empty div waiting on JS.
    await expect
      .poll(() => formPane.evaluate((el) => el.childElementCount), { timeout: 1000 })
      .toBeGreaterThan(0);
  });
});
