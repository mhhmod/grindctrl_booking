import { test, expect } from '@playwright/test';

const widths = [320, 360, 390, 430, 768, 1024, 1280, 1440];

// The dashboard fixture uses shipping components and sample facts, with no DB reads.
for (const locale of ['en', 'ar'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    for (const surface of ['privacy', 'terms', 'sign-up', 'today', 'settings'] as const) {
      test(`${surface} stays readable in ${locale}/${theme} from 320 to 1440`, async ({ page, context, baseURL }) => {
        await context.addCookies([{ name: 'gc-locale', value: locale, url: baseURL! }]);
        await page.addInitScript((value) => localStorage.setItem('theme', value), theme);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        // These checks never need APIs, analytics, auth, or external services.
        await page.route('**/*', (route) => {
          const url = new URL(route.request().url());
          return url.origin === new URL(baseURL!).origin && !url.pathname.startsWith('/api/')
            ? route.continue() : route.abort();
        });
        const dashboard = surface === 'today' || surface === 'settings';
        const path = dashboard ? `/dev/merchant-layout-check?page=${surface}&locale=${locale}` : `/${surface}`;
        await page.goto(path);
        await expect(page.locator('html')).toHaveAttribute('lang', locale);
        await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
        await expect(page.locator('html')).toHaveClass(new RegExp(theme));
        await page.evaluate(() => document.fonts.ready);

        if (surface === 'privacy' || surface === 'terms') {
          await expect(page.locator('time')).toHaveAttribute('datetime', '2026-11-12');
          await expect(page.locator('time')).toHaveText(locale === 'ar' ? '12 نوفمبر 2026' : '12 November 2026');
          await expect(page.locator('main')).not.toContainText(/draft|مسودة/i);
          await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
        }
        if (surface === 'today') {
          await expect(page.getByText(locale === 'ar' ? '24 ساعة' : '24 h', { exact: true })).toBeVisible();
        }
        if (surface === 'sign-up') {
          await expect(page.getByRole('link', { name: locale === 'ar' ? 'سياسة الخصوصية' : 'Privacy policy' })).toHaveAttribute('href', '/privacy');
          await expect(page.getByRole('link', { name: locale === 'ar' ? 'شروط الخدمة' : 'Terms of service' })).toHaveAttribute('href', '/terms');
        }

        for (const width of widths) {
          await page.setViewportSize({ width, height: 900 });
          const overflow = await page.evaluate(() => {
            const doc = document.documentElement;
            return doc.scrollWidth - doc.clientWidth;
          });
          expect(overflow, `${surface}/${locale}/${theme} at ${width}px`).toBeLessThanOrEqual(1);
          if (surface === 'settings') {
            const change = page.getByRole('link', { name: locale === 'ar' ? 'غيّر ذلك في دردشة المتجر' : 'Change in Store Chat' });
            await expect(change).toHaveAttribute('href', '/dashboard/store-chat/setup');
            const rows = await change.locator('..').locator('ul li bdi').evaluateAll((nodes) => nodes.map((node) => {
              const el = node as HTMLElement;
              const style = getComputedStyle(el);
              const rect = el.getBoundingClientRect();
              return { dir: el.dir, title: el.title, text: el.textContent, overflow: style.overflowX, whiteSpace: style.whiteSpace, ellipsis: style.textOverflow, start: rect.left, end: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, scroll: el.scrollWidth };
            }));
            expect(rows).toHaveLength(2);
            expect(rows[1].top).toBeGreaterThanOrEqual(rows[0].bottom);
            if (width === 320) expect(rows.some((row) => row.scroll > row.width)).toBe(true);
            for (const row of rows) {
              expect(row.dir).toBe('ltr');
              expect(row.title).toBe(row.text);
              expect(row.overflow).toBe('hidden');
              expect(row.whiteSpace).toBe('nowrap');
              expect(row.ellipsis).toBe('ellipsis');
              expect(row.start).toBeGreaterThanOrEqual(0);
              expect(row.end).toBeLessThanOrEqual(width + 1);
            }
            if (width === 320) await page.screenshot({ path: test.info().outputPath('settings-320.png'), fullPage: true });
          }
        }
      });
    }
  }
}
