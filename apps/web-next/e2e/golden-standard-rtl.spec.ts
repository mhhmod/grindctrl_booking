import { test, expect } from '@playwright/test';
import { waitForPageReady } from './page-ready';

/* dir/lang correctness is already covered per-page by mobile-overflow.spec.ts.
   This file checks the other half of RTL: the handful of elements that are
   directional on purpose (an arrow that must point at the reading
   direction's "next", not always screen-right) and must genuinely flip via
   Tailwind's `rtl:` variant, not just inherit `direction: rtl` and hope. A
   missed one here is invisible in a screenshot diff against an EN baseline
   (RTL screenshots are compared against their own RTL baseline, never an
   EN one) and easy to miss by eye, which is exactly why this needs an
   assertion rather than a design review. */

/* Tailwind v4 implements the scale-x- and rotate- utilities via the native
   CSS `scale`/`rotate` properties (independent of `transform`), not by
   composing `transform: scale()/rotate()` — confirmed against the real
   compiled stylesheet, not assumed: `.rtl\:-scale-x-100` resolves to
   `scale: -1 1`, and `.rtl\:md\:rotate-180` resolves to `rotate: 180deg`,
   while `getComputedStyle(el).transform` stays "none" for both. Checking
   `.transform` here would silently pass on a real mirroring regression. */
async function computedDirectionalStyle(locator: import('@playwright/test').Locator) {
  return locator.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { scale: cs.scale, rotate: cs.rotate };
  });
}

test.describe('directional icons mirror in Arabic', () => {
  test('the home hero primary CTA arrow points start-to-end, not always right', async ({ page, context, baseURL }) => {
    for (const locale of ['en', 'ar'] as const) {
      await context.clearCookies();
      await context.addCookies([{ name: 'gc-locale', value: locale, url: baseURL! }]);
      await page.goto('/');
      await waitForPageReady(page, '/');

      const arrow = page.locator('[data-icon="inline-end"] svg').first();
      await expect(arrow).toBeVisible();
      const { scale } = await computedDirectionalStyle(arrow);

      if (locale === 'ar') {
        expect(scale, 'arrow must be horizontally flipped in Arabic (rtl:-scale-x-100)').toBe('-1 1');
      } else {
        expect(scale, 'arrow must render unflipped in English').toBe('none');
      }
    }
  });

  /* The old #how section and its rotating connector went with the previous
     landing. The v15 page's How it works section is #journey, and its
     forward arrow (on See it working) mirrors with scale, like every
     forward arrow on the page. */
  test('the How it works forward arrow mirrors for Arabic\'s reversed reading order', async ({
    page,
    context,
    baseURL,
  }) => {
    for (const locale of ['en', 'ar'] as const) {
      await context.clearCookies();
      await context.addCookies([{ name: 'gc-locale', value: locale, url: baseURL! }]);
      await page.setViewportSize({ width: 1280, height: 1000 });
      await page.goto('/');
      await waitForPageReady(page, '/');
      await page.locator('#journey').scrollIntoViewIfNeeded();

      const arrow = page.locator('#journey [data-icon="inline-end"] svg').first();
      await expect(arrow).toBeVisible();
      const { scale } = await computedDirectionalStyle(arrow);

      if (locale === 'ar') {
        expect(scale, 'the arrow must be horizontally flipped in Arabic').toBe('-1 1');
      } else {
        expect(scale, 'the arrow must render unflipped in English').toBe('none');
      }
    }
  });
});
