import { test, expect, type Page, type Locator } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { ALL_STATES } from '../app/dev/sheet-scroll-check/fixtures';

// The dev fixture deliberately 404s in production. Run with the config's
// ordinary next-dev server; CI gives this its own step after the golden specs.
// Headless Chromium hides scrollbars unless told not to; the thin thumb is
// part of what this spec and its screenshots check on a mouse.
test.use({
  channel: process.platform === 'win32' ? 'msedge' : undefined,
  trace: 'off',
  launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] },
});
test.describe.configure({ mode: 'parallel' });

const sizes = [[320, 568], [360, 640], [390, 844], [430, 932], [844, 390], [768, 1024], [1280, 800]] as const;
const screenshotDir = process.env.SHEET_SCROLL_SCREENSHOTS;
const nameOf = (state: string) => state === 'photo' ? 'add-photo' : state;

/* Measured in one step inside the page and retried: a wide result swaps its
   layout in after hydration, so a box read in two round trips can catch the
   node in between. A box that is never fully on screen still fails. */
async function insideViewport(locator: Locator) {
  await expect.poll(() => locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return 'not rendered';
    const inside = r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
    return inside ? 'inside' : `outside: ${[r.left, r.top, r.right, r.bottom].map(Math.round).join(',')} in ${innerWidth}x${innerHeight}`;
  })).toBe('inside');
}

async function assertScroll(page: Page) {
  const metrics = await page.evaluate(() => {
    const elements = [...document.querySelectorAll<HTMLElement>('body *')];
    const scrolling = elements.filter((el) => /^(auto|scroll)$/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight + 1);
    return {
      document: [document.documentElement, document.body].map((el) => ({ height: el.scrollHeight, client: el.clientHeight, width: el.scrollWidth, inline: el.clientWidth })),
      scrolling: scrolling.map((el) => `${el.tagName}.${el.className}`),
      // The compare handle intentionally extends past its 2px rail. Guard
      // the actual scroll surface rather than treating that rail as a page.
      horizontal: elements.filter((el) => el.classList.contains('gc-scroll') && el.scrollWidth > el.clientWidth + 1)
        .map((el) => `${el.tagName}.${el.className}`),
    };
  });
  for (const doc of metrics.document) {
    expect(doc.height).toBeLessThanOrEqual(doc.client + 1);
    expect(doc.width).toBeLessThanOrEqual(doc.inline + 1);
  }
  expect(metrics.scrolling.length, metrics.scrolling.join('\n')).toBeLessThanOrEqual(1);
  expect(metrics.horizontal).toEqual([]);
  const send = page.locator('.gc-shell__foot button[type="submit"]');
  const action = await send.count() ? send : page.locator('.gc-shell__foot button').first();
  if (await action.count()) await insideViewport(action);
  const close = page.locator('[data-sheet-close], button[aria-label="Close"], button[aria-label="إغلاق"]').first();
  await expect(close).toBeVisible();
  await insideViewport(close);
  const before = await close.boundingBox();
  await page.locator('.gc-scroll').evaluate((el) => { el.scrollTop = el.scrollHeight; });
  expect((await close.boundingBox())!.y).toBeCloseTo(before!.y, 1);
  if (await action.count()) await insideViewport(action);
}

for (const [width, height] of sizes) {
  for (const locale of ['en', 'ar'] as const) {
      test(`${width}x${height} ${locale}: every state`, async ({ page, context, baseURL }) => {
        await context.addCookies([{ name: 'gc-locale', value: locale, url: baseURL! }]);
        await page.setViewportSize({ width, height });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        for (const state of ALL_STATES) await test.step(state, async () => {
        await page.goto(`/dev/sheet-scroll-check?state=${state}&locale=${locale}`);
        await expect(page.locator('[data-scroll-fixture] .gc-shell')).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        for (const dark of [false, true]) {
          await page.evaluate((dark) => document.documentElement.classList.toggle('dark', dark), dark);
          await assertScroll(page);
          const key = ['photo', 'result', 'chat'].includes(state);
          const requiredShot = dark
            ? key && width === 390 && locale === 'en'
            : (width === 390 && height === 844 && locale === 'en') ||
              (key && ((width === 320 && locale === 'ar') || (width === 844 && locale === 'en') || (width === 1280 && locale === 'en')));
          if (screenshotDir && requiredShot) {
            await page.locator('.gc-scroll').evaluate((el) => { el.scrollTop = el.scrollHeight > el.clientHeight && el.getAttribute('role') === 'log' ? el.scrollHeight : 0; });
            await mkdir(screenshotDir, { recursive: true });
            await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
            await page.screenshot({ path: `${screenshotDir}/${nameOf(state)}-${width}x${height}-${locale}${dark ? '-dark' : ''}.png`, fullPage: false, animations: 'disabled' });
          }
        }
        });
      });
  }
}

test('long content doubles the tips and keeps controls pinned', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto('/dev/sheet-scroll-check?state=photo&locale=ar&long=1');
  await expect(page.locator('.gc-scroll li')).toHaveCount(6);
  await page.evaluate(() => document.fonts.ready);
  await assertScroll(page);
  expect(await page.locator('.gc-scroll').evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  if (screenshotDir) {
    await page.locator('.gc-scroll').evaluate((el) => { el.scrollTop = 0; });
    await mkdir(screenshotDir, { recursive: true });
    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
    await page.screenshot({ path: `${screenshotDir}/add-photo-long-360x640-ar.png`, fullPage: false, animations: 'disabled' });
  }
});

test('a mouse gets the 6px thumb with no arrow buttons where the body overflows', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/dev/sheet-scroll-check?state=chat');
  const body = page.locator('.gc-scroll');
  await expect(body).toBeVisible();
  const bar = await body.evaluate((el: HTMLElement) => ({
    overflows: el.scrollHeight > el.clientHeight,
    // Chromium only honours ::-webkit-scrollbar (6px, no buttons) while the
    // standard properties are unset; set, it draws its own bar with arrows.
    gutter: el.offsetWidth - el.clientWidth - parseFloat(getComputedStyle(el).borderInlineStartWidth) - parseFloat(getComputedStyle(el).borderInlineEndWidth),
    standard: getComputedStyle(el).scrollbarWidth,
  }));
  expect(bar).toEqual({ overflows: true, gutter: 6, standard: 'auto' });
});

test('chat keeps the newest message above a resized keyboard viewport', async ({ page }) => {
  await page.goto('/dev/sheet-scroll-check?state=chat');
  const thread = page.getByRole('log');
  await expect(thread).toBeVisible();
  await page.setViewportSize({ width: 390, height: 390 });
  await page.locator('textarea').fill('A draft\nwith several\nlines');
  await expect.poll(() => thread.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight)).toBeLessThanOrEqual(1);
  await assertScroll(page);
});

/* The merchant Inbox in the dashboard shell's fill frame. The document never
   scrolls; the panes (the shell's sidebar, the conversation list, the thread)
   each have at most one scroll area, and nothing else scrolls. Returns the
   scroll areas found, for the message. */
async function assertInboxPanes(page: Page) {
  const result = await page.evaluate(() => {
    window.scrollTo(0, 1e6);
    const scrolled = [window.scrollY, document.documentElement.scrollTop, document.body.scrollTop];
    const doc = [document.documentElement, document.body].map((el) => ({ height: el.scrollHeight, client: el.clientHeight, width: el.scrollWidth, inline: el.clientWidth }));
    const grid = document.querySelector('[data-inbox-fixture] section[aria-label]')!.parentElement!;
    const panes = [document.querySelector<HTMLElement>('[data-inbox-fixture] > aside')!, ...Array.from(grid.children as HTMLCollectionOf<HTMLElement>)];
    const name = (el: Element) => `${el.tagName}.${String(el.className).slice(0, 60)}`;
    const scrolling = [...document.querySelectorAll<HTMLElement>('body *')].filter(
      (el) => /^(auto|scroll)$/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight + 1,
    );
    const perPane = panes.map((pane) => scrolling.filter((el) => pane.contains(el)).map(name));
    const outside = scrolling.filter((el) => !panes.some((pane) => pane.contains(el))).map(name);
    return { scrolled, doc, perPane, outside };
  });
  expect(result.scrolled, 'the document does not scroll').toEqual([0, 0, 0]);
  for (const doc of result.doc) {
    expect(doc.height).toBeLessThanOrEqual(doc.client + 1);
    expect(doc.width).toBeLessThanOrEqual(doc.inline + 1);
  }
  expect(result.outside, 'scroll areas outside the panes').toEqual([]);
  for (const areas of result.perPane) expect(areas.length, areas.join('\n')).toBeLessThanOrEqual(1);
}

const inboxSizes = [[390, 844], [844, 390], [768, 1024], [1280, 800]] as const;

for (const [width, height] of inboxSizes) {
  for (const locale of ['en', 'ar'] as const) {
    test(`inbox ${width}x${height} ${locale}: one scroll area per pane, newest message above the composer`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(`/dev/sheet-scroll-check/inbox?locale=${locale}`);
      const row = page.locator('[data-inbox-fixture] button[data-conversation-id="c1"]');
      await row.waitFor();
      await page.evaluate(() => document.fonts.ready);
      await test.step('list', () => assertInboxPanes(page));

      await row.click();
      const log = page.getByRole('log');
      await expect(log.locator('p, div').filter({ hasText: locale === 'ar' ? 'سيؤكد الفريق الموعد' : 'confirm the exact date' }).last()).toBeVisible();
      const composer = page.locator('section footer');
      await expect(composer).toBeVisible();
      await expect.poll(() => log.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight)).toBeLessThanOrEqual(1);
      await test.step('conversation', () => assertInboxPanes(page));
      await insideViewport(composer);

      const geometry = await page.evaluate(() => {
        const box = (el: Element | null) => {
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
        };
        const log = document.querySelector('[role="log"]')!;
        const bar = document.querySelector('[data-inbox-fixture] header');
        const tabs = document.querySelector('nav[aria-label="Tabs"]');
        return {
          card: box(document.querySelector('section[aria-label]'))!,
          log: box(log)!,
          newest: box(log.lastElementChild)!,
          composer: box(document.querySelector('section footer'))!,
          bar: bar && getComputedStyle(bar).display !== 'none' ? box(bar) : null,
          tabs: tabs && getComputedStyle(tabs).display !== 'none' ? box(tabs) : null,
          width: innerWidth,
        };
      });
      expect(geometry.newest.top, 'newest message starts inside the thread').toBeGreaterThanOrEqual(geometry.log.top - 1);
      expect(geometry.newest.bottom, 'newest message ends above the composer').toBeLessThanOrEqual(Math.min(geometry.composer.top, geometry.log.bottom) + 1);
      if (geometry.bar) expect.soft(geometry.card.top - geometry.bar.bottom, 'gap under the top bar').toBeGreaterThanOrEqual(8);
      if (geometry.tabs) {
        expect.soft(geometry.tabs.top - geometry.card.bottom, 'gap above the tab bar').toBeGreaterThanOrEqual(8);
        expect(geometry.composer.bottom, 'composer above the tab bar').toBeLessThanOrEqual(geometry.tabs.top + 1);
      }
      expect.soft(Math.min(geometry.card.left, geometry.width - geometry.card.right), 'gap at the screen edges').toBeGreaterThanOrEqual(12);

      const shot = (width === 390 && height === 844) || (width === 1280 && locale === 'en');
      if (screenshotDir && shot) {
        await mkdir(screenshotDir, { recursive: true });
        await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
        await page.screenshot({ path: `${screenshotDir}/inbox-${width}x${height}-${locale}.png`, fullPage: false, animations: 'disabled' });
      }

      if (width !== 390) return;
      // A keyboard opening shrinks the viewport under the thread.
      await page.locator('section footer textarea').focus();
      await page.setViewportSize({ width: 390, height: 520 });
      // Measured on the next frames, not polled: the panel's refetch also
      // re-pins the thread and would hide a missing resize follow.
      const hidden = await page.evaluate(async () => {
        await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
        const list = document.querySelector('[role="log"]')!;
        const footer = document.querySelector('section footer')!.getBoundingClientRect();
        return list.lastElementChild!.getBoundingClientRect().bottom - Math.min(footer.top, list.getBoundingClientRect().bottom);
      });
      expect(hidden, 'newest message above the reply box with the keyboard open').toBeLessThanOrEqual(1);
      await assertInboxPanes(page);
      await insideViewport(composer);
    });
  }
}

test('look viewer fits, zooms and pans without any scroll area', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dev/sheet-scroll-check?state=result');
  await page.getByRole('button', { name: /full screen/i }).click();
  const viewer = page.getByRole('dialog');
  await expect(viewer).toBeVisible();
  expect(await viewer.evaluate((el) => [...el.querySelectorAll('*')].some((item) => /auto|scroll/.test(getComputedStyle(item).overflowY) && item.scrollHeight > item.clientHeight + 1))).toBe(false);
  await viewer.locator('img').click();
  await insideViewport(viewer.getByRole('button', { name: 'Close' }));
});
