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
  test('Arabic strings appear in the header and hero, not English fallbacks', async ({ page, context }) => {
    await context.addCookies([{ name: 'gc-locale', value: 'ar', url: 'http://localhost:3100' }]);
    await page.goto('/try-on');
    await page.evaluate(() => document.fonts.ready);

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    /* The hero badge pill — was correctly Arabic already; confirms the page
       is really in Arabic mode before checking the parts that weren't. The
       same string legitimately appears twice (BrandLogo's header subtitle
       and the hero pill both use t.heroBadge), so .first() rather than a
       strict single match. */
    await expect(page.getByText('مبيعات بصرية بالذكاء الاصطناعي').first()).toBeVisible();

    /* Regression: ThemeToggle rendered with no locale prop on this page, so
       its aria-label was always English regardless of site locale. */
    const themeToggle = page.getByRole('button', { name: /التبديل إلى/ });
    await expect(themeToggle).toBeVisible();
    const englishThemeToggle = page.getByRole('button', { name: /^Switch to (light|dark) mode$/ });
    await expect(englishThemeToggle).toHaveCount(0);
  });

  test('the language toggle offers "English", not a leftover Arabic label, once already in Arabic', async ({
    page,
    context,
  }) => {
    await context.addCookies([{ name: 'gc-locale', value: 'ar', url: 'http://localhost:3100' }]);
    /* The toggle's visible label is hidden below sm: (locale-toggle.tsx),
       and its accessible name comes from a fixed aria-label rather than
       that text, so this checks visible text content at a width where the
       label shows, not the accessible name. */
    await page.setViewportSize({ width: 800, height: 900 });
    await page.goto('/try-on');
    await expect(page.locator('#tryon-locale-toggle')).toContainText('English');
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
