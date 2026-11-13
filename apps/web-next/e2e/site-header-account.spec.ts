import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/* The landing sign-in regression guard (AGENTS.md) for both account states
   of the marketing header, drawn by the dev-only preview
   (app/dev/header-check) so no Clerk session is needed: on phones, Book a
   call and the menu button stay separate, unclipped 44px targets, and a
   signed-in visitor's avatar link is a third one; on desktop the account
   entry sits beside the language switch without opening a menu.

   Screenshots go to HEADER_SHOTS_DIR, or test-results/header-shots. */

const PHONE_WIDTHS = [320, 343, 375, 390] as const;
const LOCALES = ['en', 'ar'] as const;
const THEMES = ['light', 'dark'] as const;
const VIEWERS = ['signed-out', 'signed-in'] as const;
const SHOTS_DIR = process.env.HEADER_SHOTS_DIR ?? path.join('test-results', 'header-shots');

const COPY = {
  en: { signIn: 'Sign in', openDashboard: 'Open dashboard', bookCall: 'Book a call', openMenu: /menu/i },
  ar: { signIn: 'تسجيل الدخول', openDashboard: 'افتح لوحة التحكم', bookCall: 'احجز مكالمة', openMenu: /القائمة/ },
} as const;

async function open(page: Page, viewer: string, locale: 'en' | 'ar', theme: 'light' | 'dark') {
  await page.context().addCookies([{ name: 'gc-locale', value: locale, url: 'http://localhost:3100' }]);
  await page.addInitScript((value) => {
    try {
      window.localStorage.setItem('theme', value);
    } catch {}
  }, theme);
  const response = await page.goto(`/dev/header-check?viewer=${viewer}`);
  test.skip(response?.status() === 404, 'dev-only preview is not served by this build');
  await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
}

type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

function fullTarget(width: number, box: Box | null) {
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(width);
}

for (const viewer of VIEWERS) {
  for (const locale of LOCALES) {
    for (const theme of THEMES) {
      for (const width of PHONE_WIDTHS) {
        test(`phone header, ${viewer}, ${locale} ${theme}, ${width}px`, async ({ page }) => {
          await page.setViewportSize({ width, height: 700 });
          await open(page, viewer, locale, theme);
          const copy = COPY[locale];
          const bar = page.locator('[data-site-header] > div.fixed').nth(1);
          await expect(bar).toBeVisible();
          const book = bar.getByRole('link', { name: copy.bookCall });
          const menu = bar.getByRole('button', { name: copy.openMenu });
          const targets = [await book.boundingBox(), await menu.boundingBox()];
          if (viewer === 'signed-in') targets.push(await bar.getByRole('link', { name: copy.openDashboard }).boundingBox());
          else await expect(bar.getByRole('link', { name: copy.openDashboard })).toHaveCount(0);
          for (const box of targets) fullTarget(width, box);
          for (let i = 0; i < targets.length; i += 1) {
            for (let j = i + 1; j < targets.length; j += 1) expect(overlaps(targets[i]!, targets[j]!)).toBe(false);
          }
          // Nothing in the bar is clipped by it.
          const barBox = (await bar.boundingBox())!;
          for (const box of targets) {
            expect(box!.x).toBeGreaterThanOrEqual(barBox.x);
            expect(box!.x + box!.width).toBeLessThanOrEqual(barBox.x + barBox.width + 0.5);
          }
          const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
          expect(scroll).toBeLessThanOrEqual(client);

          // The menu's first row is the account entry and takes focus.
          await menu.click();
          const dialog = page.getByRole('dialog');
          const first = dialog.getByRole('link').first();
          await expect(first).toHaveAccessibleName(viewer === 'signed-in' ? copy.openDashboard : copy.signIn);
          await expect(first).toBeFocused();
        });
      }
    }
  }
}

for (const viewer of VIEWERS) {
  for (const locale of LOCALES) {
    test(`desktop header, ${viewer}, ${locale}`, async ({ page }) => {
      await page.setViewportSize({ width: 1024, height: 800 });
      await open(page, viewer, locale, 'light');
      const copy = COPY[locale];
      const bar = page.locator('[data-site-header] > div.fixed').first();
      const entry = bar.getByRole('link', { name: viewer === 'signed-in' ? copy.openDashboard : copy.signIn });
      await expect(entry).toBeVisible();
      // Labelled, not icon-only: the visible text carries the name.
      await expect(entry).toContainText(viewer === 'signed-in' ? copy.openDashboard : copy.signIn);
      await expect(entry).toHaveAttribute('href', viewer === 'signed-in' ? '/dashboard' : '/sign-in');
      const entryBox = (await entry.boundingBox())!;
      const barBox = (await bar.boundingBox())!;
      expect(entryBox.x).toBeGreaterThanOrEqual(barBox.x);
      expect(entryBox.x + entryBox.width).toBeLessThanOrEqual(barBox.x + barBox.width);
      const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
      expect(scroll).toBeLessThanOrEqual(client);
    });
  }
}

const SHOTS = [
  { width: 320, height: 568, locale: 'ar', theme: 'light' },
  { width: 390, height: 844, locale: 'en', theme: 'dark' },
  { width: 1280, height: 800, locale: 'en', theme: 'light' },
] as const;

test.describe('server first paint', () => {
  test.use({ javaScriptEnabled: false });
  for (const viewer of VIEWERS) {
    test(`${viewer} account entry is correct before JavaScript`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.context().addCookies([{ name: 'gc-locale', value: 'en', url: 'http://localhost:3100' }]);
      const response = await page.goto(`/dev/header-check?viewer=${viewer}`);
      expect(response?.status()).toBe(200);
      const header = page.getByRole('banner');
      const signedIn = viewer === 'signed-in';
      await expect(header.getByRole('link', { name: signedIn ? 'Open dashboard' : 'Sign in', exact: true }).first()).toBeVisible();
      await expect(header.getByRole('link', { name: signedIn ? 'Sign in' : 'Open dashboard', exact: true })).toHaveCount(0);
    });
  }
});

for (const shot of SHOTS) {
  for (const viewer of VIEWERS) {
    test(`screenshot ${viewer} ${shot.width}x${shot.height} ${shot.locale} ${shot.theme}`, async ({ page }) => {
      await page.setViewportSize({ width: shot.width, height: shot.height });
      await open(page, viewer, shot.locale, shot.theme);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: path.join(SHOTS_DIR,`header-${viewer}-${shot.width}x${shot.height}-${shot.locale}-${shot.theme}.png`),
        animations: 'disabled',
      });
    });
  }
}
