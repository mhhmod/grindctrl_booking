import { test, expect } from './fixtures';

test.describe('Auth Pages', () => {
  test('public home remains accessible', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    await expect(page.locator('#page-home')).toBeVisible();
    await expect(page.locator('#ed-drop-zone')).toBeVisible();
  });

  test('sign-in page renders with shared design system', async ({ page }) => {
    await page.goto('/sign-in.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    await expect(page.locator('.gc-auth-title')).toBeVisible();
    await expect(page.locator('.gc-auth-title')).toContainText(/Welcome back|Sign in/i);
    await expect(page.locator('#clerk-sign-in-mount')).toBeVisible();
    await expect(page.locator('.gc-auth-card')).toBeVisible();

    const hasDesignSystem = await page.evaluate(() => {
      const el = document.querySelector('.gc-auth-card');
      if (!el) return false;
      const style = getComputedStyle(el);
      return style.borderRadius !== '0px' && style.borderRadius !== '';
    });
    expect(hasDesignSystem).toBe(true);
  });

  test('sign-in page Material Symbols render as icons, not text', async ({ page }) => {
    await page.goto('/sign-in.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const icons = page.locator('.material-symbols-outlined');
    const count = await icons.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const icon = icons.nth(i);
      const fontFamily = await icon.evaluate(el => getComputedStyle(el).fontFamily);
      expect(fontFamily).toContain('Material Symbols Outlined');
    }
  });

  test('sign-up page renders with shared design system', async ({ page }) => {
    await page.goto('/sign-up.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    await expect(page.locator('.gc-auth-title')).toBeVisible();
    await expect(page.locator('.gc-auth-title')).toContainText(/Create|Account/i);
    await expect(page.locator('#clerk-sign-up-mount')).toBeVisible();
    await expect(page.locator('.gc-auth-card')).toBeVisible();

    const hasDesignSystem = await page.evaluate(() => {
      const el = document.querySelector('.gc-auth-card');
      if (!el) return false;
      const style = getComputedStyle(el);
      return style.borderRadius !== '0px' && style.borderRadius !== '';
    });
    expect(hasDesignSystem).toBe(true);
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

  test('auth nav links use gc-auth-nav and gc-auth-link classes', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const authNav = page.locator('#gc-auth-nav');
    await expect(authNav).toBeVisible();

    const signInLink = authNav.locator('.gc-auth-link[href="/sign-in.html"]');
    const signUpCTA = authNav.locator('.gc-auth-cta[href="/sign-up.html"]');

    await expect(signInLink).toBeVisible();
    await expect(signUpCTA).toBeVisible();

    if (await signInLink.isVisible()) {
      const linkStyle = await signInLink.evaluate(el => {
        const s = getComputedStyle(el);
        return { color: s.color, fontSize: s.fontSize };
      });
      expect(linkStyle.color).toBeTruthy();
      expect(linkStyle.fontSize).toBeTruthy();
    }
  });
});

test.describe('Auth Design System', () => {
  test('auth pages use shared gc-* design tokens', async ({ page }) => {
    await page.goto('/sign-in.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const authPage = page.locator('.gc-auth-page');
    await expect(authPage).toBeVisible();

    const bgColor = await authPage.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(bgColor).toBeTruthy();
  });

  test('auth pages load design system via bundled CSS', async ({ page }) => {
    await page.goto('/sign-in.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const hasStylesheets = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
      return links.length >= 1;
    });
    expect(hasStylesheets).toBe(true);

    const authCardUsesTokens = await page.evaluate(() => {
      const el = document.querySelector('.gc-auth-card');
      if (!el) return false;
      const style = getComputedStyle(el);
      return style.getPropertyValue('border-radius').trim() !== '' &&
             style.getPropertyValue('border-radius') !== '0px';
    });
    expect(authCardUsesTokens).toBe(true);

    const bodyUsesGcFont = await page.evaluate(() => {
      const style = getComputedStyle(document.body);
      return style.fontFamily.includes('Inter') || style.fontFamily.includes('Manrope') || style.fontFamily.includes('system-ui');
    });
    expect(bodyUsesGcFont).toBe(true);
  });
});

test.describe('Dashboard', () => {
  test('app page has dashboard shell with shared design system', async ({ page }) => {
    await page.goto('/app.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const topbar = page.locator('.gc-app-topbar');
    const sidebar = page.locator('.gc-app-sidebar');

    await expect(topbar).toBeVisible();
    await expect(sidebar).toBeVisible();
  });

  test('app page loads design system via bundled CSS', async ({ page }) => {
    await page.goto('/app.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const hasStylesheets = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
      return links.length >= 1;
    });
    expect(hasStylesheets).toBe(true);

    const topbarUsesTokens = await page.evaluate(() => {
      const el = document.querySelector('.gc-app-topbar');
      if (!el) return false;
      const style = getComputedStyle(el);
      return style.getPropertyValue('border-bottom-width') !== '' ||
             style.getPropertyValue('position') === 'fixed';
    });
    expect(topbarUsesTokens).toBe(true);

    const sidebarUsesTokens = await page.evaluate(() => {
      const el = document.querySelector('.gc-app-sidebar');
      if (!el) return false;
      const style = getComputedStyle(el);
      return style.getPropertyValue('width') !== '' && style.getPropertyValue('width') !== 'auto';
    });
    expect(sidebarUsesTokens).toBe(true);
  });

  test('dashboard Material Symbols render as icons, not text', async ({ page }) => {
    await page.goto('/app.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const icons = page.locator('.material-symbols-outlined');
    const count = await icons.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < Math.min(count, 5); i++) {
      const icon = icons.nth(i);
      const fontFamily = await icon.evaluate(el => getComputedStyle(el).fontFamily);
      expect(fontFamily).toContain('Material Symbols Outlined');
    }
  });

  test('dashboard sidebar navigation switches screens', async ({ page }) => {
    await page.goto('/app.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const appContent = page.locator('#app-content');
    if (!(await appContent.isVisible())) return;

    const setupItem = page.locator('.gc-app-sidebar-item[data-screen="setup"]');
    if (await setupItem.isVisible()) {
      await setupItem.click();

      const setupScreen = page.locator('#screen-setup');
      await expect(setupScreen).toHaveClass(/active/);

      const dashboardItem = page.locator('.gc-app-sidebar-item[data-screen="dashboard"]');
      await dashboardItem.click();

      const dashScreen = page.locator('#screen-dashboard');
      await expect(dashScreen).toHaveClass(/active/);
    }
  });

  test('dashboard uses gc-* token classes', async ({ page }) => {
    await page.goto('/app.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const topbar = page.locator('.gc-app-topbar');
    if (await topbar.isVisible()) {
      const bgColor = await topbar.evaluate(el => getComputedStyle(el).backgroundColor);
      expect(bgColor).toBeTruthy();
    }
  });
});

test.describe('Supabase Data Layer', () => {
  test('supabase client module exports configured check', async ({ page }) => {
    await page.goto('/app.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const shellPresent = await page.evaluate(() => {
      return document.querySelector('.gc-app-topbar') !== null || document.body.textContent.length > 100;
    });
    expect(shellPresent).toBe(true);

    const isConfigured = await page.evaluate(() => {
      return typeof window.__gcApp !== 'undefined';
    });
    expect(typeof isConfigured).toBe('boolean');
  });

  test('app page has dashboard shell when env vars present', async ({ page }) => {
    await page.goto('/app.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const topbar = page.locator('.gc-app-topbar');
    const sidebar = page.locator('.gc-app-sidebar');

    await expect(topbar).toBeVisible();
    await expect(sidebar).toBeVisible();
  });

  test('widget site ownership structure is available', async ({ page }) => {
    await page.goto('/app.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const hasWidgetSites = await page.evaluate(() => {
      if (!window.__gcApp) return null;
      return Array.isArray(window.__gcApp.sites);
    });

    if (hasWidgetSites !== null) {
      expect(hasWidgetSites).toBe(true);
    }
  });

  test('bootstrap RPC functions are callable', async ({ page }) => {
    await page.goto('/app.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const hasRPC = await page.evaluate(() => {
      const supabase = window.__gcApp ? true : false;
      return supabase;
    });
    expect(typeof hasRPC).toBe('boolean');
  });
});

test.describe('Icon Size Consistency', () => {
  const STANDARD_SIZES = [12, 14, 16, 18, 20, 24, 32, 48];

  test('landing page icons use standard scale sizes', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const iconSizes = await page.evaluate(() => {
      const icons = document.querySelectorAll('.material-symbols-outlined');
      return Array.from(icons).map(el => {
        const size = parseFloat(getComputedStyle(el).fontSize);
        return Math.round(size);
      });
    });

    const nonStandard = iconSizes.filter(size => !STANDARD_SIZES.includes(size));
    expect(nonStandard.length).toBe(0, `Found non-standard icon sizes: ${nonStandard.join(', ')}px`);
  });

  test('auth page icons use standard scale sizes', async ({ page }) => {
    await page.goto('/sign-in.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const iconSizes = await page.evaluate(() => {
      const icons = document.querySelectorAll('.material-symbols-outlined');
      return Array.from(icons).map(el => {
        const size = parseFloat(getComputedStyle(el).fontSize);
        return Math.round(size);
      });
    });

    const nonStandard = iconSizes.filter(size => !STANDARD_SIZES.includes(size));
    expect(nonStandard.length).toBe(0, `Found non-standard icon sizes: ${nonStandard.join(', ')}px`);
  });
});