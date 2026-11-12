import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

test.use({ channel: process.platform === 'win32' ? 'msedge' : undefined, trace: 'off' });
const shots = process.env.MERCHANT_LAYOUT_SHOTS;

async function ready(page: Page, surface: string, locale: string) {
  await page.goto(`/dev/merchant-layout-check?page=${surface}&locale=${locale}`);
  await expect(page.locator('[data-merchant-layout-fixture]')).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
  // Dev URLs get the public launcher; real dashboard URLs suppress it.
  await page.addStyleTag({ content: '[data-assistant-launcher], nextjs-portal { display: none !important; }' });
}

for (const locale of ['en', 'ar']) {
  test(`Inbox phone ${locale}: conversation keeps its gap under the sticky bar`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/dev/sheet-scroll-check/inbox?locale=${locale}`);
    await page.locator('button[data-conversation-id="c1"]').click();
    await expect(page.getByRole('log')).toBeVisible();
    const gap = await page.evaluate(() => {
      const bar = document.querySelector('[data-inbox-fixture] header')!.getBoundingClientRect();
      const card = document.querySelector('section[aria-label]')!.getBoundingClientRect();
      return card.top - bar.bottom;
    });
    expect(gap).toBeGreaterThanOrEqual(8);
    await noOverflow(page);
  });
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
}

for (const width of [320, 360, 390, 430, 768, 1024, 1280, 1440]) {
  for (const locale of ['en', 'ar'] as const) {
    for (const theme of ['light', 'dark'] as const) {
      test(`${width} ${locale} ${theme}: Plan icons/cards and Team addresses fit`, async ({ page }) => {
        const height = width === 320 ? 568 : width >= 768 ? 800 : 844;
        await page.setViewportSize({ width, height });
        await page.addInitScript((value) => localStorage.setItem('theme', value), theme);
        await ready(page, 'plan', locale);
        await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', theme);
        await noOverflow(page);
        const runout = page.locator('section[aria-labelledby="plan-runout"]');
        const geometry = await runout.locator('li').evaluateAll((rows) => rows.map((row) => {
          const icon = row.querySelector('svg')!.getBoundingClientRect();
          const text = row.querySelector('span')!.getBoundingClientRect();
          const box = row.getBoundingClientRect();
          return { width: icon.width, height: icon.height, textInset: getComputedStyle(row).direction === 'rtl' ? box.right - text.right : text.left - box.left };
        }));
        for (const row of geometry) {
          expect(row.width).toBeCloseTo(18, 1);
          expect(row.height).toBeCloseTo(18, 1);
        }
        expect(geometry[0].textInset).toBeCloseTo(geometry[1].textInset, 1);
        // Status badges are the page's other SVG + text flex rows.
        for (const icon of await page.locator('section[aria-labelledby="plan-yours"] svg').all()) {
          expect((await icon.boundingBox())!.width).toBeCloseTo(14, 1);
        }
        const cards = page.locator('#plan-list li');
        await expect(cards).toHaveCount(4);
        for (const card of await cards.all()) {
          await expect(card).toContainText(locale === 'ar' ? 'دردشة المتجر مشمولة' : 'Store Chat included');
          expect(await card.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
        }
        const planShot = theme === 'dark' && (width === 390 || (width === 1280 && locale === 'en'));
        if (shots && planShot) {
          await mkdir(shots, { recursive: true });
          await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
          for (const [label, section] of [['runout', runout], ['plans', page.locator('#plan-list')]] as const) {
            await section.scrollIntoViewIfNeeded();
            await page.evaluate((id) => window.scrollTo(0, document.querySelector(id)!.getBoundingClientRect().top + scrollY - 85), label === 'runout' ? 'section[aria-labelledby="plan-runout"]' : '#plan-list');
            await page.screenshot({ path: path.join(shots, `plan-${label}-${width}x${height}-${locale}-${theme}.png`), animations: 'disabled' });
          }
        }
        await ready(page, 'team', locale);
        await noOverflow(page);
        const people = page.locator('section[aria-labelledby="team-people"]');
        // The address/name track must stay between the avatar and the role,
        // including the null-name email fallback, member Edit and invite actions.
        const rows = await people.locator('li').evaluateAll((items) => items.map((item) => {
          const [avatar, who, role] = Array.from(item.children).map((el) => el.getBoundingClientRect());
          const rtl = getComputedStyle(item).direction === 'rtl';
          return {
            avatarGap: rtl ? avatar.left - who.right : who.left - avatar.right,
            roleGap: rtl ? who.left - role.right : role.left - who.right,
            overflow: (item.children[1] as HTMLElement).scrollWidth - (item.children[1] as HTMLElement).clientWidth,
          };
        }));
        expect(rows).toHaveLength(3);
        for (const row of rows) {
          expect(row.avatarGap).toBeGreaterThanOrEqual(10);
          expect(row.roleGap).toBeGreaterThanOrEqual(10);
          expect(row.overflow).toBeLessThanOrEqual(1);
        }
        for (const address of await people.locator('[data-truncate]').all()) {
          const css = await address.evaluate((el) => {
            const style = getComputedStyle(el);
            return { direction: style.direction, overflow: style.overflow, ellipsis: style.textOverflow };
          });
          expect(css).toEqual({ direction: 'ltr', overflow: 'hidden', ellipsis: 'ellipsis' });
        }
        const alert = people.locator('p').last();
        expect(await alert.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
        if (shots && theme === 'dark' && (width === 390 || (width === 320 && locale === 'ar'))) {
          await mkdir(shots, { recursive: true });
          await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
          await people.locator('li').first().scrollIntoViewIfNeeded();
          await people.locator('li').first().evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 85));
          await page.screenshot({ path: path.join(shots, `team-${width}x${height}-${locale}-${theme}.png`), animations: 'disabled' });
        }
      });
    }
  }
}
