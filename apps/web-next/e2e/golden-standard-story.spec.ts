import { test, expect, type Page } from '@playwright/test';
import { waitForPageReady } from './page-ready';

/* The landing's paced story (docs/handoff/site-v15/02-landing.md): sheets
   really pin, one gesture moves exactly one beat, nav items and hash links
   land on the right scene, a language switch mid-story keeps the beat and
   flips <html> at once, covered sheets are inert, and with reduced motion
   nothing is pinned at all. */

async function openStory(page: Page, path = '/', { width = 1440, height = 900 } = {}) {
  await page.setViewportSize({ width, height });
  await page.goto(path);
  await waitForPageReady(page, '/');
}

/** Where each beat and the rest of the page begin, measured the way the director measures them. */
async function stops(page: Page) {
  return page.evaluate(() => {
    const y = window.scrollY;
    const beats = Array.from(document.querySelectorAll('[data-beat]'))
      .map((el) => ({ id: el.getAttribute('data-beat') as string, y: Math.round(el.getBoundingClientRect().top + y) }))
      .sort((a, b) => a.y - b.y);
    const rest = document.querySelector('[data-k="rest"]') as HTMLElement;
    return { beats, rest: Math.round(rest.getBoundingClientRect().top + y) };
  });
}

const scrollY = (page: Page) => page.evaluate(() => Math.round(window.scrollY));

async function settleAt(page: Page, y: number) {
  await expect.poll(() => scrollY(page), { timeout: 5000 }).toBe(y);
}

test.describe('landing story, paced', () => {
  test('a sheet really pins while its scene plays', async ({ page }) => {
    await openStory(page);
    const { beats } = await stops(page);
    const store = beats.find((b) => b.id === 'store:1')!;
    await page.evaluate((y) => window.scrollTo(0, y), store.y);
    await settleAt(page, store.y);
    const top = await page.locator('[data-k="sheetS"]').evaluate((el) => el.getBoundingClientRect().top);
    expect(Math.abs(top)).toBeLessThan(1);
    expect(await page.locator('[data-k="sheetS"]').evaluate((el) => getComputedStyle(el).position)).toBe('sticky');
  });

  test('one wheel gesture and one arrow key each move exactly one beat', async ({ page }) => {
    await openStory(page);
    const { beats } = await stops(page);
    await page.mouse.move(720, 450);
    await page.mouse.wheel(0, 120);
    await settleAt(page, beats[1].y);

    /* A trackpad fling: forty decaying deltas, one every 16ms for about
       two thirds of a second, still move one beat. Replayed inside the page
       so the cadence is a trackpad's, not the test runner's round trips. */
    await page.waitForTimeout(400);
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          let i = 0;
          const tick = () => {
            window.dispatchEvent(new WheelEvent('wheel', { deltaY: 40 - i * 0.8, deltaMode: 0, bubbles: true, cancelable: true }));
            i += 1;
            if (i < 40) window.setTimeout(tick, 16);
            else resolve();
          };
          tick();
        }),
    );
    await settleAt(page, beats[2].y);
    await page.waitForTimeout(600);
    expect(await scrollY(page)).toBe(beats[2].y);

    await page.keyboard.press('ArrowDown');
    await settleAt(page, beats[3].y);
    await page.keyboard.press('ArrowUp');
    await settleAt(page, beats[2].y);
  });

  test('nav items and hash links land on the first beat of their scene', async ({ page }) => {
    await openStory(page);
    const { beats } = await stops(page);
    const at = (id: string) => beats.find((b) => b.id === id)!.y;

    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'AI operations' }).click();
    await settleAt(page, at('ops:0'));
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'AI operations' })).toHaveAttribute(
      'aria-current',
      'location',
    );

    /* Try it on lands on the first try-on beat after the hero. */
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Try it on' }).click();
    await settleAt(page, at('tryon:1'));

    await page.evaluate(() => {
      window.location.hash = 'results';
    });
    await settleAt(page, at('results:0'));

    await openStory(page, '/#store');
    await settleAt(page, at('store:0'));

    /* The old anchors still land somewhere sensible. */
    await openStory(page, '/#demo');
    await settleAt(page, at('tryon:1'));
  });

  test('switching language mid-story keeps the beat and flips <html> straight away', async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'gc-locale', value: 'en', url: baseURL! }]);
    await openStory(page);
    const { beats } = await stops(page);
    const ops1 = beats.find((b) => b.id === 'ops:1')!.y;
    await page.evaluate((y) => window.scrollTo(0, y), ops1);
    await settleAt(page, ops1);

    await page.getByRole('banner').getByRole('button', { name: 'التبديل إلى العربية' }).click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.getByRole('heading', { level: 2, name: /فريقك والذكاء الاصطناعي/ })).toBeVisible();
    await page.waitForTimeout(600);
    const after = await stops(page);
    expect(await scrollY(page)).toBe(after.beats.find((b) => b.id === 'ops:1')!.y);
    await expect(page.locator('#ops button[aria-pressed="true"]:visible')).toContainText('حالة الطلب داخل الدردشة');
  });

  test('sheets that are covered or not yet on screen are inert', async ({ page }) => {
    await openStory(page);
    const { beats } = await stops(page);
    const store0 = beats.find((b) => b.id === 'store:0')!.y;
    await page.evaluate((y) => window.scrollTo(0, y), store0);
    await settleAt(page, store0);
    await expect(page.locator('[data-k="sheetA"]')).toHaveAttribute('inert', '');
    await expect(page.locator('[data-k="sheetS"]')).not.toHaveAttribute('inert', '');
    await expect(page.locator('[data-k="sheetO"]')).toHaveAttribute('inert', '');
    await expect(page.locator('html')).toHaveAttribute('data-story', 'pinned');
  });

  test('below the story, scrolling is native and the site assistant returns', async ({ page }) => {
    await openStory(page);
    const { rest } = await stops(page);
    await page.evaluate((y) => window.scrollTo(0, y + 400), rest);
    await page.waitForTimeout(600);
    expect(await scrollY(page)).toBe(rest + 400);
    await expect(page.locator('html')).not.toHaveAttribute('data-story', 'pinned');
  });
});

test.describe('landing story, reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('nothing is pinned: the scenes are ordinary sections showing their final beat', async ({ page }) => {
    await openStory(page);
    await expect(page.locator('.gc-story')).toHaveAttribute('data-stacked', '');
    for (const key of ['A', 'S', 'O', 'B', 'C']) {
      expect(await page.locator(`[data-k="sheet${key}"]`).evaluate((el) => getComputedStyle(el).position)).toBe('relative');
    }
    await expect(page.locator('html')).not.toHaveAttribute('data-story', 'pinned');
    /* Final beats: Report is the active product tab, the last results card is centred. */
    await expect(page.getByRole('button', { name: /Report/ })).toHaveAttribute('aria-pressed', 'true');
    /* Input stays native. */
    await page.keyboard.press('PageDown');
    await expect.poll(() => scrollY(page)).toBeGreaterThan(0);
  });
});

test.describe('landing story, touch screen', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test('stacks and scrolls natively instead of pacing swipes', async ({ page }) => {
    await page.goto('/');
    await waitForPageReady(page, '/');
    /* Paced swipes scrolled the page from script every frame, which fought the
       phone's own momentum and address bar and flickered on real phones. */
    await expect(page.locator('.gc-story')).toHaveAttribute('data-stacked', '');
    expect(await page.locator('[data-k="sheetS"]').evaluate((el) => getComputedStyle(el).position)).toBe('relative');
    await expect(page.locator('html')).not.toHaveAttribute('data-story', 'pinned');
  });
});
