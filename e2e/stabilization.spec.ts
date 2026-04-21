import { test, expect, waitForShoelace } from './fixtures';

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
    const page = document.querySelector('.gc-auth-page');
    const subtitle = document.querySelector('.gc-auth-subtitle');
    if (!title || !page || !subtitle) return 0;

    const titleColor = parse(getComputedStyle(title).color);
    const subtitleColor = parse(getComputedStyle(subtitle).color);
    const pageColor = parse(getComputedStyle(page).backgroundColor);

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

test.describe('Stabilization Pass', () => {
  test('sign-in desktop layout + contrast + Clerk frame', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/sign-in.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1800);

    await expect(page.locator('.gc-auth-shell')).toBeVisible();
    await expect(page.locator('.gc-auth-title')).toBeVisible();
    await expect(page.locator('.gc-auth-card')).toBeVisible();

    await assertNoHorizontalOverflow(page);
    await assertAuthContrast(page);
    await assertAuthNeutralShell(page);

    const clerkFrameLooksIntegrated = await page.evaluate(() => {
      const card = document.querySelector('.gc-auth-card');
      const mount = document.getElementById('clerk-sign-in-mount');
      if (!card || !mount) return false;
      const cardStyle = getComputedStyle(card);
      const mountStyle = getComputedStyle(mount);
      return cardStyle.borderRadius !== '0px' &&
        cardStyle.borderTopColor !== 'rgba(0, 0, 0, 0)' &&
        Number.parseFloat(mountStyle.minHeight) >= 280;
    });
    expect(clerkFrameLooksIntegrated).toBe(true);
  });

  test('sign-in mobile layout (360)', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/sign-in.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1600);

    await expect(page.locator('.gc-auth-card')).toBeVisible();
    await expect(page.locator('.gc-auth-back')).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });

  test('sign-up mobile layout (390)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/sign-up.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1600);

    await expect(page.locator('.gc-auth-card')).toBeVisible();
    await expect(page.locator('.gc-auth-title')).toContainText(/Create|account/i);
    await assertNoHorizontalOverflow(page);
  });

  test('mobile header has no overlap at key widths', async ({ page }) => {
    const widths = [320, 360, 375, 390, 414, 768];
    for (const width of widths) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1700);
      await waitForShoelace(page);

      const noCollision = await page.evaluate(() => {
        const brand = document.querySelector('.gc-site-nav__brand') as HTMLElement | null;
        const actions = document.querySelector('.gc-site-nav__actions') as HTMLElement | null;
        if (!brand || !actions) return false;
        const b = brand.getBoundingClientRect();
        const a = actions.getBoundingClientRect();
        return b.right <= a.left + 2;
      });

      expect(noCollision).toBe(true);
      await assertNoHorizontalOverflow(page);
    }
  });

  test('drawer geometry stays within viewport in LTR', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1700);
    await waitForShoelace(page);

    await page.locator('#hamburger-btn').click();
    await page.waitForTimeout(300);

    const geometry = await page.locator('#nav-drawer').evaluate((el: any) => {
      const panel = el.shadowRoot?.querySelector('[part="panel"]');
      if (!panel) return null;
      const rect = panel.getBoundingClientRect();
      const style = getComputedStyle(panel);
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        radius: style.borderTopLeftRadius,
      };
    });

    expect(geometry).not.toBeNull();
    expect(geometry!.left).toBeGreaterThanOrEqual(0);
    expect(geometry!.right).toBeLessThanOrEqual(390);
    expect(geometry!.top).toBeGreaterThanOrEqual(0);
    expect(geometry!.radius).not.toBe('0px');
  });

  test('drawer geometry stays within viewport in RTL', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('grindctrl-lang', 'ar');
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1800);
    await waitForShoelace(page);

    await page.locator('#hamburger-btn').click();
    await page.waitForTimeout(350);

    const rtlState = await page.evaluate(() => document.documentElement.getAttribute('dir'));
    expect(rtlState).toBe('rtl');

    const geometry = await page.locator('#nav-drawer').evaluate((el: any) => {
      const panel = el.shadowRoot?.querySelector('[part="panel"]');
      if (!panel) return null;
      const rect = panel.getBoundingClientRect();
      return { left: rect.left, right: rect.right };
    });

    expect(geometry).not.toBeNull();
    expect(geometry!.left).toBeGreaterThanOrEqual(0);
    expect(geometry!.right).toBeLessThanOrEqual(390);
  });

  test('trial widget input row EN and send button containment', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    await page.locator('#gc-chat-trigger').click();
    await expect(page.locator('#gc-chat-panel.open')).toBeVisible();

    const contained = await page.evaluate(() => {
      const row = document.querySelector('.gc-chat-input-row');
      const send = document.getElementById('gc-send-btn');
      if (!row || !send) return false;
      const r = row.getBoundingClientRect();
      const s = send.getBoundingClientRect();
      return s.left >= r.left - 0.5 && s.right <= r.right + 0.5 && s.top >= r.top - 0.5 && s.bottom <= r.bottom + 0.5;
    });
    expect(contained).toBe(true);
  });

  test('trial widget input row AR/RTL alignment and containment', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('grindctrl-lang', 'ar');
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    await page.locator('#gc-chat-trigger').click();
    await expect(page.locator('#gc-chat-panel.open')).toBeVisible();

    const rtlComposerOk = await page.evaluate(() => {
      const textarea = document.getElementById('gc-textarea');
      const row = document.querySelector('.gc-chat-input-row');
      const send = document.getElementById('gc-send-btn');
      if (!textarea || !row || !send) return false;

      const taStyle = getComputedStyle(textarea);
      const r = row.getBoundingClientRect();
      const s = send.getBoundingClientRect();
      const contained = s.left >= r.left - 0.5 && s.right <= r.right + 0.5;
      return taStyle.textAlign === 'right' && contained;
    });

    expect(rtlComposerOk).toBe(true);
  });

  test('mockup widget send button does not protrude', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/#install', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    await page.locator('#mockup-launcher').click();
    await page.waitForTimeout(500);

    const contained = await page.evaluate(() => {
      const shell = document.querySelector('.mockup-input-shell');
      const send = document.querySelector('.mockup-send-btn');
      if (!shell || !send) return false;
      const a = shell.getBoundingClientRect();
      const b = send.getBoundingClientRect();
      return b.left >= a.left - 0.5 && b.right <= a.right + 0.5 && b.top >= a.top - 0.5 && b.bottom <= a.bottom + 0.5;
    });
    expect(contained).toBe(true);
  });

  test('critical icon alignment contract on auth + app surfaces', async ({ page }) => {
    await page.goto('/sign-in.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const authIconsOk = await page.evaluate(() => {
      const icons = Array.from(document.querySelectorAll('.gc-auth-page .gc-icon'));
      if (icons.length === 0) return false;
      return icons.every((icon) => {
        const style = getComputedStyle(icon);
        return style.lineHeight === '1' || style.lineHeight.endsWith('px');
      });
    });
    expect(authIconsOk).toBe(true);

    await page.goto('/app.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2200);
    const appIconsOk = await page.evaluate(() => {
      const icons = Array.from(document.querySelectorAll('.gc-app-layout .material-symbols-outlined'));
      if (icons.length === 0) return true;
      return icons.every((icon) => {
        const style = getComputedStyle(icon);
        return style.fontFamily.includes('Material Symbols Outlined');
      });
    });
    expect(appIconsOk).toBe(true);
  });

  test('dashboard loads without prior Supabase runtime warnings', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      const text = msg.text();
      if (/Multiple GoTrueClient|infinite recursion|workspace_members|widget_sites fetch.*500|getWidgetSites failed/i.test(text)) {
        errors.push(text);
      }
    });

    page.on('response', (res) => {
      if (res.status() >= 500 && /widget_sites/.test(res.url())) {
        errors.push('widget_sites response ' + res.status());
      }
    });

    await page.goto('/app.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    await expect(page.locator('.gc-app-topbar')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('dashboard progress surfaces stay readable without overlap', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/app.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    const setupVisible = await page.locator('#app-setup-message').isVisible();
    if (setupVisible) {
      await expect(page.locator('#app-setup-message')).toBeVisible();
      await assertNoHorizontalOverflow(page);
      return;
    }

    const progressReadable = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.gc-app-step-row')) as HTMLElement[];
      const trialProgress = document.querySelector('.gc-app-trial-progress') as HTMLElement | null;
      if (!rows.length || !trialProgress) return false;

      const rowsOk = rows.every((row) => {
        const status = row.querySelector('.gc-app-step-status') as HTMLElement | null;
        if (!status) return false;
        return row.getBoundingClientRect().height >= 56 &&
          status.textContent.trim().length > 0;
      });

      return rowsOk && trialProgress.getBoundingClientRect().height >= 8;
    });

    expect(progressReadable).toBe(true);
    await assertNoHorizontalOverflow(page);
  });
});
