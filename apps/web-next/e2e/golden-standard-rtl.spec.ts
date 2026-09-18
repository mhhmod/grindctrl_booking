import { test, expect } from '@playwright/test';

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
      await page.evaluate(() => document.fonts.ready);

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

  test('the "how it works" connector arrow rotates for Arabic\'s reversed reading order', async ({
    page,
    context,
    baseURL,
  }) => {
    for (const locale of ['en', 'ar'] as const) {
      await context.clearCookies();
      await context.addCookies([{ name: 'gc-locale', value: locale, url: baseURL! }]);
      // Desktop width: the connector only rotates at md: and up (it stacks
      // vertically, unrotated, below that — rotating it there would be wrong).
      await page.setViewportSize({ width: 1280, height: 1000 });
      await page.goto('/');
      await page.evaluate(() => document.fonts.ready);
      await page.locator('#how').scrollIntoViewIfNeeded();

      const connector = page.locator('#how svg').first();
      await expect(connector).toBeVisible();
      const { rotate } = await computedDirectionalStyle(connector);

      if (locale === 'ar') {
        expect(rotate, 'connector must rotate 180° in Arabic at desktop width (rtl:md:rotate-180)').toBe('180deg');
      } else {
        expect(rotate, 'connector must render unrotated in English at desktop width (md:rotate-0)').toBe('none');
      }
    }
  });
});
