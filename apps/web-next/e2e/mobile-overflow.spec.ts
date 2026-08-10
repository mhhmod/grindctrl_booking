import { test, expect } from '@playwright/test';

const WIDTHS = [320, 360, 390, 430];
const LOCALES = ['en', 'ar'] as const;

/* Both public pages. /pricing was missed the first time round and kept the
   tracking-[0.22em] eyebrow the landing pass removed, so it went untested with
   the very defect this sweep exists to catch. */
const PAGES = [
  { name: 'landing', path: '/' },
  { name: 'pricing', path: '/pricing' },
] as const;

for (const { name, path } of PAGES) {
for (const locale of LOCALES) {
  for (const width of WIDTHS) {
    test(`${name} has no horizontal overflow at ${width}px in ${locale}`, async ({ page, context }) => {
      /* Locale comes only from this cookie (SITE_LOCALE_COOKIE), read server
         side in app/page.tsx. There is no ?lang= param. */
      await context.addCookies([
        { name: 'gc-locale', value: locale, url: 'http://localhost:3100' },
      ]);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);
      /* Not networkidle — Next dev holds an HMR connection open, so it never
         settles. Fonts are what actually move text widths, so wait for those. */
      await page.evaluate(() => document.fonts.ready);

      /* Prove the locale actually applied — otherwise this silently tests
         English twice and the Arabic case, the one most likely to overflow,
         goes unchecked. dir lives on the landing root div, not <html>. */
      const root = page.locator('.gc-landing-root');
      await expect(root).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
      await expect(root).toHaveAttribute('lang', locale);

      const { scrollWidth, clientWidth } = await page.evaluate(() => {
        const doc = document.documentElement;
        return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth };
      });

      /* One pixel of slack absorbs sub-pixel rounding; beyond that is a real
         element pushing the page wide. */
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

      /* The landing root sets overflow-x-hidden, so a too-wide child is
         clipped and never shows up in scrollWidth above. Measure the elements
         directly. Only text-bearing elements are checked: decorative blurs and
         the marquee track extend past the viewport on purpose, unreadable text
         is the actual reported bug. */
      const overflowing = await page.evaluate((slack) => {
        const viewport = document.documentElement.clientWidth;
        return Array.from(document.querySelectorAll<HTMLElement>('body *'))
          .filter((el) => {
            const direct = Array.from(el.childNodes).some(
              (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim().length > 0,
            );
            if (!direct) return false;
            const style = getComputedStyle(el);
            if (style.visibility === 'hidden' || style.display === 'none') return false;
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) return false;

            /* Skip anything clipped by a SCOPED clipper inside the page — a
               marquee lays its track wider than the screen on purpose and
               relies on its own viewport to clip it, so those chips are
               off-screen by design and never widen the page.

               The walk stops at .gc-landing-root, which itself carries
               overflow-x-hidden. Walking past it would skip every element on
               the page and leave this assertion permanently green — which is
               precisely the failure mode this whole sweep exists to avoid. */
            for (
              let p = el.parentElement;
              p && p !== document.body && !p.classList.contains('gc-landing-root');
              p = p.parentElement
            ) {
              const ps = getComputedStyle(p);
              if (ps.overflowX === 'hidden' || ps.overflowX === 'clip') return false;
            }
            // Box escapes the viewport (shrink-to-fit elements like Badge).
            if (r.right > viewport + slack || r.left < -slack) return true;
            /* Or the text spills out of its own box — a block-level element
               keeps a viewport-width rect while its content runs past the
               edge, so the check above cannot see it. overflow-x must be
               visible: auto/scroll is a scroller and hidden is a deliberate
               clip or truncation. */
            return style.overflowX === 'visible' && el.scrollWidth > el.clientWidth + slack;
          })
          .slice(0, 10)
          .map((el) => {
            const r = el.getBoundingClientRect();
            return `${el.tagName}.${String(el.className).slice(0, 60)} [${Math.round(r.left)}..${Math.round(r.right)}] "${(el.textContent ?? '').trim().slice(0, 40)}"`;
          });
      }, 1);

      expect(overflowing, `text overflowing the ${width}px viewport on ${path}`).toEqual([]);
    });
  }
}
}
