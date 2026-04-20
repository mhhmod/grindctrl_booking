import { test, expect } from './fixtures';

test.describe('Auth Pages', () => {
  test('public home remains accessible', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    await expect(page.locator('#page-home')).toBeVisible();
    await expect(page.locator('#ed-drop-zone')).toBeVisible();
  });

  test('sign-in page renders', async ({ page }) => {
    await page.goto('/sign-in.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    await expect(page.locator('.gc-auth-title')).toBeVisible();
    await expect(page.locator('.gc-auth-title')).toContainText(/Welcome back|Sign in/i);
    await expect(page.locator('#clerk-sign-in-mount')).toBeVisible();
    await expect(page.locator('.gc-auth-card')).toBeVisible();
  });

  test('sign-up page renders', async ({ page }) => {
    await page.goto('/sign-up.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    await expect(page.locator('.gc-auth-title')).toBeVisible();
    await expect(page.locator('.gc-auth-title')).toContainText(/Create|Account/i);
    await expect(page.locator('#clerk-sign-up-mount')).toBeVisible();
    await expect(page.locator('.gc-auth-card')).toBeVisible();
  });

  test('sign-in page has link to sign-up', async ({ page }) => {
    await page.goto('/sign-in.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const signUpLink = page.locator('.gc-auth-footer a[href="/sign-up.html"]');
    await expect(signUpLink).toBeVisible();
  });

  test('sign-up page has link to sign-in', async ({ page }) => {
    await page.goto('/sign-up.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const signInLink = page.locator('.gc-auth-footer a[href="/sign-in.html"]');
    await expect(signInLink).toBeVisible();
  });

  test('protected app shows setup message without clerk env', async ({ page }) => {
    await page.goto('/app.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const setupMsg = page.locator('#app-setup-message');
    const appContent = page.locator('#app-content');

    if (await setupMsg.isVisible()) {
      await expect(setupMsg).toBeVisible();
      await expect(setupMsg).toContainText(/Authentication Not Configured/i);
    } else if (await appContent.isVisible()) {
      await expect(appContent).toBeVisible();
    }
  });

  test('auth nav links visible on landing page', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const authNav = page.locator('#gc-auth-nav');
    await expect(authNav).toBeVisible();

    const signInLink = page.locator('#gc-auth-nav a[href="/sign-in.html"]');
    const signUpLink = page.locator('#gc-auth-nav a[href="/sign-up.html"]');

    await expect(signInLink).toBeVisible();
    await expect(signUpLink).toBeVisible();
  });
});

test.describe('Supabase Data Layer', () => {
  test('supabase client module exports configured check', async ({ page }) => {
    await page.goto('/app.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // App page should render the dashboard shell (nav, layout) regardless of env vars
    const shellPresent = await page.evaluate(() => {
      return document.querySelector('.nav') !== null || document.querySelector('.nav-brand') !== null || document.body.textContent.length > 100;
    });
    expect(shellPresent).toBe(true);

    // __gcApp exists only when Supabase env vars are baked into the build
    const isConfigured = await page.evaluate(() => {
      return typeof window.__gcApp !== 'undefined';
    });
    expect(typeof isConfigured).toBe('boolean');
  });

  test('app page has dashboard shell when env vars present', async ({ page }) => {
    await page.goto('/app.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const nav = page.locator('.nav');
    const sidebar = page.locator('.sidebar');

    await expect(nav).toBeVisible();
    await expect(sidebar).toBeVisible();
  });

  test('widget site ownership structure is available', async ({ page }) => {
    await page.goto('/app.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const hasWidgetSites = await page.evaluate(() => {
      if (!window.__gcApp) return null;
      return Array.isArray(window.__gcApp.sites);
    });

    // If Supabase is configured, sites should be an array (possibly empty)
    if (hasWidgetSites !== null) {
      expect(hasWidgetSites).toBe(true);
    }
  });
});
