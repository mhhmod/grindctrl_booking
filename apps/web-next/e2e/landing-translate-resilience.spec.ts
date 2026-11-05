import { test, expect, type Page } from '@playwright/test';
import { waitForPageReady } from './page-ready';

test.beforeEach(async ({ page }) => {
  // These are DOM resilience checks, not Clerk/Redis integration checks.
  // Only the read-only session/budget request is fixed; no messages or
  // provider calls are submitted, mocked or allowed by this fixture.
  await page.route('**/api/assistant/session', async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    await route.fulfill({
      json: {
        tenantId: 'resilience-test',
        authenticated: false,
        budgets: { chat: { remaining: 8, resetSeconds: 0 }, voice: { remaining: 3, resetSeconds: 0 } },
      },
    });
  });
});

async function ready(page: Page) {
  await waitForPageReady(page, '/');
  // Next's devtools indicator overlaps the launcher's corner locally. The
  // visual golden spec hides the same development-only portal; runtime
  // failures still fail our console.error and pageerror assertions below.
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
}

/* Chrome's translator replaces React-owned Text nodes, including text added
   after the first pass. Keep the replacement text identical: this tests DOM
   ownership, without relying on a translation service or browser profile. */
async function translateText(page: Page) {
  await page.evaluate(() => {
    const wrap = (root: Node) => {
      const nodes: Node[] = [];
      if (root.nodeType === Node.TEXT_NODE) nodes.push(root);
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) nodes.push(walker.currentNode);
      for (const node of nodes) {
        const parent = node.parentElement;
        if (!node.isConnected || !node.textContent?.trim() || !parent || parent.closest('font,script,style,noscript,textarea')) continue;
        const outer = document.createElement('font');
        const inner = document.createElement('font');
        outer.style.verticalAlign = inner.style.verticalAlign = 'inherit';
        inner.textContent = node.textContent;
        outer.appendChild(inner);
        parent.replaceChild(outer, node);
      }
    };
    wrap(document.body);
    new MutationObserver((records) => {
      for (const record of records) for (const node of record.addedNodes) wrap(node);
    }).observe(document.body, { childList: true, subtree: true });
  });
  expect(await page.locator('body font font').count()).toBeGreaterThan(100);
}

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`${error.name}: ${error.message}`));
  // React reports caught commit errors to console.error, not pageerror.
  page.on('console', (message) => {
    if (message.type() === 'error') {
      const url = message.location().url;
      errors.push(`${message.text()}${url ? ` [${url}]` : ''}`);
    }
  });
  return errors;
}

async function scrollToBeat(page: Page, id: string) {
  const y = await page.locator(`[data-beat="${id}"]`).evaluate((el) => Math.round(el.getBoundingClientRect().top + scrollY));
  await page.evaluate((top) => scrollTo(0, top), y);
  await expect.poll(() => page.evaluate(() => Math.round(scrollY))).toBe(y);
  // The controller samples native scroll once per animation frame.
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

async function checkControls(page: Page, locale: 'en' | 'ar', phone: boolean) {
  if (phone) {
    await page.getByRole('button', { name: locale === 'ar' ? 'فتح القائمة' : 'Open menu', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').getByRole('link', { name: locale === 'ar' ? 'تسجيل الدخول' : 'Sign in', exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  } else {
    const nav = page.locator('[data-site-header] nav').first();
    const results = nav.locator('a[href="/#results"]');
    await results.click();
    await expect(results).toHaveAttribute('aria-current', 'location');
  }
  // The launcher is intentionally hidden during pinned scenes. Test it once
  // native scrolling reaches the ordinary content, as an actual visitor does.
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await expect(page.locator('html')).not.toHaveAttribute('data-story', 'pinned');
  await page.locator('[data-assistant-launcher] button').click();
  await expect(page.getByRole('dialog', { name: 'GrindCTRL AI', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}

for (const locale of ['ar', 'en'] as const) {
  for (const phone of [true, false]) {
    test(`translation preserves the landing story and controls in ${locale}, ${phone ? 'phone' : 'desktop'}`, async ({ page, context, baseURL }) => {
      const errors = collectErrors(page);
      await context.addCookies([{ name: 'gc-locale', value: locale, url: baseURL! }]);
      await page.setViewportSize(phone ? { width: 390, height: 844 } : { width: 1440, height: 900 });
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await ready(page);
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
      await translateText(page);

      const beats = await page.locator('[data-beat]').evaluateAll((els) => els.map((el) => el.getAttribute('data-beat')!));
      for (const beat of beats) await scrollToBeat(page, beat);
      await expect(page.locator('.gc-story')).toHaveAttribute('data-a', 'steps');
      await scrollToBeat(page, 'ops:0');
      const active = page.locator('#ops button[aria-pressed="true"]:visible').first();
      const signature = () => active.evaluate((el) => el.getAttribute('aria-label') || el.textContent);
      const initial = await signature();
      expect(initial).toBeTruthy();
      await scrollToBeat(page, 'ops:3');
      await expect.poll(signature).not.toBe(initial);
      expect(await signature()).toBeTruthy();
      if (phone) {
        await expect(page.locator('#ops p[aria-live="polite"]:visible span').last()).toHaveText(locale === 'ar' ? 'فريقك يتولّى الأمر' : 'Your team takes over');
      }
      expect(Math.abs(await page.locator('[data-k="sheetO"]').evaluate((el) => el.getBoundingClientRect().top))).toBeLessThan(1);
      await checkControls(page, locale, phone);
      expect(errors).toEqual([]);
    });
  }
}

test('unrelated stale profile data cannot break the Arabic phone landing', async ({ page, context, baseURL }) => {
  const errors = collectErrors(page);
  await context.addCookies([{ name: 'gc-locale', value: 'ar', url: baseURL! }]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await ready(page);
  await page.evaluate(async () => {
    localStorage.setItem('gc:landing:last-preview:v1', '{broken');
    // Use whichever SDK keys this configured site actually created, without
    // embedding a deployment-specific analytics project key in the test.
    for (const storage of [localStorage, sessionStorage]) {
      for (const key of Object.keys(storage)) {
        if (key.startsWith('ph_') || key.startsWith('__ph_opt_in_out_')) storage.setItem(key, '{broken');
      }
    }
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('grindctrl-tryon', 1);
      request.onupgradeneeded = () => {
        for (const name of ['kept', 'settings']) {
          if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name);
        }
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(['kept', 'settings'], 'readwrite');
        tx.objectStore('kept').put('{broken', 'photo');
        tx.objectStore('kept').put({ savedAt: Date.now(), expiresAt: Date.now() + 86400000, jobId: 1, productId: null, productName: [], imageDataUrl: {} }, 'look:stale');
        tx.objectStore('settings').put('{broken', 'consent');
        tx.objectStore('settings').put({ savedAt: 0, expiresAt: 9999999999999, value: 'yes' }, 'keep-on-phone');
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      };
    });
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await ready(page);
  await scrollToBeat(page, 'ops:3');
  await checkControls(page, 'ar', true);
  expect(errors).toEqual([]);
});

for (const theme of ['light dark', '{"old": true}', '{broken']) {
  test(`a stale theme ${JSON.stringify(theme)} cannot unmount the Arabic phone landing`, async ({ page, context, baseURL }) => {
    const errors = collectErrors(page);
    await context.addCookies([{ name: 'gc-locale', value: 'ar', url: baseURL! }]);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript((value) => localStorage.setItem('theme', value), theme);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await ready(page);
    await expect(page.locator('html')).toHaveClass(/light/);
    expect(await page.evaluate(() => localStorage.getItem('theme'))).toBeNull();
    await checkControls(page, 'ar', true);
    expect(errors).toEqual([]);
  });
}
