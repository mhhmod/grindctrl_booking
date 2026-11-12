import { test, expect } from '@playwright/test';
import path from 'node:path';

test.use({ channel: process.platform === 'win32' ? 'msedge' : undefined, trace: 'off' });

test('touch scrollbars are hidden and body contains overscroll', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  try {
    const page = await context.newPage();
    await page.goto(`${baseURL}/dev/sheet-scroll-check?state=chat`);
    const body = page.locator('.gc-scroll');
    await expect(body).toBeVisible();
    const css = await body.evaluate((el) => {
      const style = getComputedStyle(el);
      return { coarse: matchMedia('(pointer: coarse)').matches, scrollbar: style.scrollbarWidth, overscroll: style.overscrollBehavior, gutter: style.scrollbarGutter };
    });
    expect(css).toEqual({ coarse: true, scrollbar: 'none', overscroll: 'contain', gutter: 'auto' });
  } finally { await context.close(); }
});

test('the actual engine frame contains wheel scroll and restores the store position', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('https://fixture.invalid/**', (route) => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><body>Fixture frame<script>addEventListener('keydown',function(e){if(e.key==='Escape')parent.postMessage({type:'grindctrl-tryon:close'},'*')})</script></body></html>` }));
  /* A long merchant page on an origin of its own, then the shipped classic
     script. Not setContent over a Next page: document.open keeps that
     page's window, and a React still hydrating (a cold dev server) renders
     its fixture back over the store, button and all. */
  await page.route('https://store.fixture.invalid/**', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body style="margin:0;min-height:4000px"><button id="buy" style="margin-top:1000px">Buy</button></body></html>' }));
  await page.goto('https://store.fixture.invalid/product');
  await page.addScriptTag({ path: path.resolve('public/widget/v1/tryon-engine.js') });
  await page.evaluate(() => {
    const engine = (window as unknown as { GRINDCTRL_TRYON_ENGINE: { mount: (adapter: object) => void } }).GRINDCTRL_TRYON_ENGINE;
    engine.mount({
      signalKey: '', embedOrigin: 'https://fixture.invalid', injectButton: true,
      detectProduct: () => ({ id: 'fixture', title: 'Fixture product' }),
      placement: () => ({ node: document.querySelector('#buy'), mode: 'after' }),
      placementTarget: () => document.querySelector('#buy'), lookKey: () => 'fixture',
      buttonLabel: 'Try on', messageProductId: () => 'fixture',
      getContext: () => Promise.resolve({ embedUrl: 'https://fixture.invalid/embed?sheet=1', context: { expiresAt: new Date(Date.now() + 60000).toISOString() } }),
    });
    window.scrollTo(0, 900);
  });
  const before = await page.evaluate(() => scrollY);
  await page.locator('.gc-tryon-btn').click();
  const panel = page.locator('.gc-tryon-sheet__panel');
  await expect(panel).toBeVisible();
  expect(await page.evaluate(() => document.body.style.position)).toBe('fixed');
  await page.mouse.wheel(0, 1000);
  expect(await page.evaluate(() => document.body.getBoundingClientRect().top)).toBe(-before);
  const height = await panel.evaluate((el) => el.getBoundingClientRect().height);
  expect(height).toBeLessThanOrEqual(844 * 0.92 + 1);
  // Click the dimmed top gap (also an iOS rubber-band guard via touch-action).
  await page.locator('.gc-tryon-sheet__backdrop').click({ position: { x: 5, y: 5 } });
  await expect(page.locator('.gc-tryon-sheet')).toBeHidden();
  expect(await page.evaluate(() => scrollY)).toBe(before);
  expect(await page.evaluate(() => document.body.style.position)).toBe('');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.locator('.gc-tryon-btn').click();
  expect(await panel.evaluate((el) => el.getBoundingClientRect().height)).toBe(720);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(before);
});
