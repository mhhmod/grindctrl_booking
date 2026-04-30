import { test, expect } from './fixtures';

const AUTH_WIDTHS = [320, 360, 375, 390, 414, 768];
const DASHBOARD_WIDTHS = [390, 768, 1280];

async function assertNoHorizontalOverflow(page: any) {
  const hasOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
  });
  expect(hasOverflow).toBe(false);
}

async function assertAuthContrast(page: any) {
  const ratio = await page.evaluate(() => {
    function parse(color: string) {
      const m = color.match(/\d+(\.\d+)?/g);
      if (!m || m.length < 3) return [0, 0, 0];
      return [Number(m[0]), Number(m[1]), Number(m[2])];
    }

    function luminance(rgb: number[]) {
      const channels = rgb.map((v) => {
        const n = v / 255;
        return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    }

    function contrast(a: number[], b: number[]) {
      const l1 = luminance(a);
      const l2 = luminance(b);
      const high = Math.max(l1, l2);
      const low = Math.min(l1, l2);
      return (high + 0.05) / (low + 0.05);
    }

    const title = document.querySelector('.gc-auth-title');
    const pageEl = document.querySelector('.gc-auth-page');
    const subtitle = document.querySelector('.gc-auth-subtitle');
    if (!title || !pageEl || !subtitle) return 0;

    const titleColor = parse(getComputedStyle(title).color);
    const subtitleColor = parse(getComputedStyle(subtitle).color);
    const pageColor = parse(getComputedStyle(pageEl).backgroundColor);

    return Math.min(contrast(titleColor, pageColor), contrast(subtitleColor, pageColor));
  });

  expect(ratio).toBeGreaterThan(3.2);
}

async function assertAuthNeutralShell(page: any) {
  const shellLooksNeutral = await page.evaluate(() => {
    const pageEl = document.querySelector('.gc-auth-page');
    const intro = document.querySelector('.gc-auth-intro');
    const card = document.querySelector('.gc-auth-card');
    if (!pageEl || !intro || !card) return false;

    const pageStyle = getComputedStyle(pageEl);
    const introStyle = getComputedStyle(intro);
    const cardStyle = getComputedStyle(card);

    return pageStyle.backgroundImage !== 'none' &&
      introStyle.borderTopColor !== 'rgba(0, 0, 0, 0)' &&
      cardStyle.borderTopColor !== 'rgba(0, 0, 0, 0)' &&
      Number.parseFloat(cardStyle.borderTopWidth) >= 1;
  });

  expect(shellLooksNeutral).toBe(true);
}

for (const lang of ['en', 'ar'] as const) {
  test.describe(`Stabilization Matrix (${lang.toUpperCase()})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((currentLang) => {
        localStorage.setItem('grindctrl-lang', currentLang);
      }, lang);
    });

    for (const width of AUTH_WIDTHS) {
      test(`auth surfaces are stable at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });

        await page.goto('/sign-in.html', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1600);
        await expect(page.locator('.gc-auth-shell')).toBeVisible();
        await expect(page.locator('.gc-auth-card')).toBeVisible();
        await assertNoHorizontalOverflow(page);
        await assertAuthContrast(page);
        await assertAuthNeutralShell(page);

        await page.goto('/sign-up.html', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1600);
        await expect(page.locator('.gc-auth-shell')).toBeVisible();
        await expect(page.locator('.gc-auth-card')).toBeVisible();
        await assertNoHorizontalOverflow(page);
        await assertAuthContrast(page);
        await assertAuthNeutralShell(page);
      });
    }

    for (const width of DASHBOARD_WIDTHS) {
      test(`dashboard shell stays stable at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/app.html', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2200);

        const setupMessage = page.locator('#app-setup-message');
        if (await setupMessage.isVisible()) {
          await expect(setupMessage).toBeVisible();
        } else {
          await expect(page.locator('.gc-app-topbar')).toBeVisible();
          await expect(page.locator('.gc-app-sidebar')).toBeVisible();
          await expect(page.locator('.gc-app-step-row')).toHaveCount(5);
        }

        await assertNoHorizontalOverflow(page);
      });
    }
  });
}
