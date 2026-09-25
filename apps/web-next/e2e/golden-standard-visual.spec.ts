import { test, expect } from '@playwright/test';
import { GOLDEN_PAGES } from './golden-pages';
import { waitForPageReady } from './page-ready';

/* Visual regression on the two highest-traffic, highest-risk pages: the
   home page carries the platform's whole pitch, and pricing is the page
   most likely to regress silently (see mobile-overflow.spec.ts's own
   history — an eyebrow style change shipped there unnoticed because
   nothing checked it). Extend VISUAL_PAGES the same way as GOLDEN_PAGES
   grows, once a page earns the baseline-maintenance cost — screenshot
   count is width × locale × page, so this starts deliberately small.

   Baselines only mean anything if every run renders them the same way, so
   these specs are meant to run against the real Docker/Linux production
   candidate in CI (PLAYWRIGHT_BASE_URL set — see playwright.web-next.config.ts
   and next-release-check.yml), not compared across a local OS. Running
   locally still works and is useful for spot-checking a change before it
   reaches CI, but a local run's screenshots are NOT what should be
   committed as the baseline — see docs/golden-landing-standard.md and
   .github/workflows/update-visual-baselines.yml, the only sanctioned way
   to update the committed baseline images. */
const VISUAL_PAGES = GOLDEN_PAGES.filter((p) => p.name === 'landing' || p.name === 'pricing');
const WIDTHS = [390, 1024, 1440];
const LOCALES = ['en', 'ar'] as const;

for (const golden of VISUAL_PAGES) {
  for (const locale of LOCALES) {
    for (const width of WIDTHS) {
      test(`${golden.name} at ${width}px in ${locale} matches its visual baseline`, async ({
        page,
        context,
        baseURL,
      }) => {
        await context.addCookies([{ name: 'gc-locale', value: locale, url: baseURL! }]);
        // Pin light mode explicitly — this spec does not also cover dark,
        // and next-themes' stored preference should never make it ambiguous
        // which theme a baseline image represents.
        await context.addInitScript((theme) => {
          try {
            localStorage.setItem('theme', theme);
          } catch {
            /* private mode or storage disabled — the light default still applies */
          }
        }, 'light');
        // Freezes every gc-* entrance/ambient animation to its settled
        // state via the app's own prefers-reduced-motion rules (see
        // app/globals.css), so the same page renders identical pixels on
        // every run instead of racing the aurora drift or a fade-in.
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.setViewportSize({ width, height: 1200 });
        await page.goto(golden.path);
        await waitForPageReady(page, golden.path);
        await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });

        await expect(page).toHaveScreenshot(`${golden.name}-${locale}-${width}.png`, {
          fullPage: true,
          animations: 'disabled',
          maxDiffPixelRatio: 0.01,
        });
      });
    }
  }
}
