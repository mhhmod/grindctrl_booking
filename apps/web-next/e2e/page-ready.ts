import type { Page } from '@playwright/test';

/* Fonts move text widths, so every golden check waits for them. The landing
   story renders both its desktop and phone layouts and CSS shows the one
   the viewport wants; after hydration the director measures that layout's
   beats and hides the other, then marks its root data-ready. Checks on /
   wait for that, so they test what a visitor sees rather than the moment
   before the story is measured. */
export async function waitForPageReady(page: Page, path: string) {
  await page.evaluate(() => document.fonts.ready);
  if (path === '/' || path.startsWith('/#')) {
    await page.locator('.gc-story[data-ready]').waitFor({ state: 'attached', timeout: 60_000 });
  }
}
