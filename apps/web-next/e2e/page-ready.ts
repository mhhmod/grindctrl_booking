import type { Page } from '@playwright/test';

/* Fonts move text widths, so every golden check waits for them. The landing
   story also renders on the server with a guessed layout (desktop or phone,
   from the request) and swaps to the one the viewport wants after
   hydration; it marks its root data-ready once that layout is on screen and
   measured. Checks on / wait for that, so they test what a visitor sees
   rather than the moment before the swap. */
export async function waitForPageReady(page: Page, path: string) {
  await page.evaluate(() => document.fonts.ready);
  if (path === '/' || path.startsWith('/#')) {
    await page.locator('.gc-story[data-ready]').waitFor({ state: 'attached', timeout: 60_000 });
  }
}
