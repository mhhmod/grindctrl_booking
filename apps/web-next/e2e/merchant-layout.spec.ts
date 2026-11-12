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

const WIDTHS = [320, 360, 390, 430, 768, 1024, 1280, 1440];
const heightFor = (width: number) => (width === 320 ? 568 : width >= 768 ? 800 : 844);
// Every merchant screen in the fixture; state variants carry the awkward data.
const SCREENS = [
  'today', 'today-calm', 'today-setup', 'tryon', 'tryon-empty', 'tryon-error', 'tryon-setup',
  'store', 'store-outdated', 'store-new', 'settings', 'plan', 'plan-zero', 'claim', 'onboarding', 'connect', 'connect-code',
];

/* The rules every screen keeps at every width, returned as readable
   problems so a failure names the element. */
async function layoutProblems(page: Page, touch: boolean) {
  return page.evaluate((coarse) => {
    const root = document.querySelector('[data-merchant-layout-fixture]')!;
    const problems: string[] = [];
    const vw = document.documentElement.clientWidth;
    const name = (el: Element) => {
      const text = (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
      return `<${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? `.${el.className.split(' ')[0]}` : ''}> "${text}"`;
    };
    const visible = (el: Element) => {
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) return false;
      const style = getComputedStyle(el);
      return style.visibility !== 'hidden' && style.opacity !== '0' && el.checkVisibility?.() !== false;
    };
    // Inside a deliberate sideways scroller (tabs, code), the box may run past the viewport.
    const inScroller = (el: Element) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const x = getComputedStyle(p).overflowX;
        if (x === 'auto' || x === 'scroll' || x === 'hidden' || x === 'clip') return true;
      }
      return false;
    };
    const all = Array.from(root.querySelectorAll('*')).filter(visible);
    for (const el of all) {
      const box = el.getBoundingClientRect();
      if ((box.right > vw + 1 || box.left < -1) && !inScroller(el)) problems.push(`wider than viewport: ${name(el)} ${Math.round(box.left)}..${Math.round(box.right)}`);
    }
    // No two text boxes overlap inside a row (a flex or grid container's children).
    const textOf = (el: Element) => (el.textContent ?? '').trim().length > 0;
    for (const row of all) {
      const display = getComputedStyle(row).display;
      if (!/flex|grid/.test(display)) continue;
      const kids = Array.from(row.children).filter((k) => visible(k) && textOf(k) && !['absolute', 'fixed'].includes(getComputedStyle(k).position));
      for (let i = 0; i < kids.length; i++) {
        for (let j = i + 1; j < kids.length; j++) {
          const a = kids[i].getBoundingClientRect();
          const b = kids[j].getBoundingClientRect();
          const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (w > 1 && h > 1) problems.push(`overlap in row ${name(row)}: ${name(kids[i])} / ${name(kids[j])}`);
        }
      }
    }
    // A leaf whose text runs out of its own box.
    for (const el of all) {
      if (!(el instanceof HTMLElement) || el.children.length > 0 || !textOf(el)) continue;
      const style = getComputedStyle(el);
      // Ellipsis is deliberate; visually hidden screen-reader text is clipped on purpose.
      if (style.textOverflow === 'ellipsis' || style.overflowX === 'visible' || el.getBoundingClientRect().width <= 2) continue;
      if (el.scrollWidth - el.clientWidth > 1) problems.push(`clipped text: ${name(el)}`);
    }
    if (coarse) {
      const targets = root.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, [role=switch], [role=tab], [role=radio], summary');
      for (const target of Array.from(targets)) {
        // A link inside running text is exempt (WCAG 2.5.8 inline).
        if (target.tagName === 'A' && getComputedStyle(target).display === 'inline') continue;
        // Visually hidden inputs are hit through their label or control root.
        const hit = !visible(target) || target.getBoundingClientRect().width < 4
          ? target.closest('label, [class*="-root"]') : target;
        if (!hit || !visible(hit)) continue;
        const box = hit.getBoundingClientRect();
        if (box.height < 43.5 || box.width < 43.5) problems.push(`touch target ${Math.round(box.width)}x${Math.round(box.height)}: ${name(hit)}`);
      }
    }
    if (getComputedStyle(root).direction === 'rtl') {
      // Directional icons (GcIcon's rtl:-scale-x-100) point the Arabic way.
      for (const icon of all.filter((el) => el instanceof SVGElement && (el.getAttribute('class') ?? '').includes('rtl:-scale-x-100'))) {
        // Tailwind 4 flips with the scale property, not transform.
        const style = getComputedStyle(icon);
        if (!style.scale.startsWith('-1') && !style.transform.startsWith('matrix(-1')) problems.push(`unmirrored icon in ${name(icon.parentElement!)}`);
      }
      // Emails, hosts and URLs keep their own direction inside Arabic text.
      const LTR_VALUE = /[\w.+-]+@[\w-]+\.[\w.]+|\b[\w-]+(\.[\w-]+)*\.(com|net|org|cloud|store)\b/;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.nodeValue ?? '';
        const match = LTR_VALUE.exec(text);
        if (!match || !visible(node.parentElement!)) continue;
        const before = text.slice(0, match.index);
        const after = text.slice(match.index + match[0].length);
        if (!/[؀-ۿ]/.test(before + after)) {
          // The value is alone in its element: that element must hold LTR, or be isolated.
          const host = node.parentElement!;
          const style = getComputedStyle(host);
          const isolated = style.direction === 'ltr' || /isolate|plaintext/.test(style.unicodeBidi) || host.closest('bdi, [dir=ltr]');
          const siblingsArabic = /[؀-ۿ]/.test(host.parentElement?.textContent ?? '');
          if (!isolated && siblingsArabic && style.display === 'inline') problems.push(`LTR value not isolated: ${name(host)}`);
          continue;
        }
        if (!before.endsWith('⁨') && !node.parentElement!.closest('bdi, [dir=ltr]')) problems.push(`LTR value not isolated: "${match[0]}" in ${name(node.parentElement!)}`);
      }
    }
    // At most one vertical scroll area per pane: the page itself scrolls.
    const scrollers = all.filter((el) => {
      const y = getComputedStyle(el).overflowY;
      return (y === 'auto' || y === 'scroll') && el.scrollHeight - el.clientHeight > 1;
    });
    if (scrollers.length > 1) problems.push(`nested scroll areas: ${scrollers.map(name).join(', ')}`);
    return Array.from(new Set(problems));
  }, touch);
}

for (const width of WIDTHS) {
  const touch = width < 1280;
  test.describe(`${width}px`, () => {
    test.use({ hasTouch: touch, viewport: { width, height: heightFor(width) } });
    for (const locale of ['en', 'ar'] as const) {
      test(`${width} ${locale}: every merchant screen fits`, async ({ page }) => {
        if (touch) expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
        const found: string[] = [];
        for (const screen of SCREENS) {
          await ready(page, screen, locale);
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
          if (overflow > 1) found.push(`${screen}: document scrolls sideways by ${overflow}px`);
          found.push(...(await layoutProblems(page, touch)).map((p) => `${screen}: ${p}`));
        }
        expect(found).toEqual([]);
      });
    }
  });
}

/* Review screenshots, only when MERCHANT_LAYOUT_SHOTS names a folder:
   MERCHANT_LAYOUT_SCREENS picks screens and MERCHANT_LAYOUT_FULL takes the
   whole page instead of the viewport. */
const SHOT_SIZES = [[390, 844, 'en', 'dark'], [320, 568, 'ar', 'light'], [1280, 800, 'en', 'light']] as const;
for (const [width, height, locale, theme] of SHOT_SIZES) {
  test(`shots ${width} ${locale} ${theme}`, async ({ page }) => {
    test.skip(!shots, 'MERCHANT_LAYOUT_SHOTS is not set');
    await page.setViewportSize({ width, height });
    await page.addInitScript((value) => localStorage.setItem('theme', value), theme);
    const only = process.env.MERCHANT_LAYOUT_SCREENS?.split(',');
    await mkdir(shots!, { recursive: true });
    // Every screen on the phone; the main three at the small and desktop sizes.
    for (const screen of only ?? (width === 390 ? SCREENS : ['today', 'tryon', 'tryon-setup', 'store'])) {
      await ready(page, screen, locale);
      const parts = process.env.MERCHANT_LAYOUT_FULL
        ? Math.ceil(await page.evaluate(() => document.documentElement.scrollHeight / innerHeight)) : 1;
      for (let part = 0; part < parts; part++) {
        await page.evaluate((y) => window.scrollTo(0, y), part * height * 0.9);
        await page.screenshot({ path: path.join(shots!, `${screen}-${width}x${height}-${locale}-${theme}${parts > 1 ? `-${part + 1}` : ''}.png`), animations: 'disabled' });
      }
    }
  });
}

for (const width of WIDTHS) {
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
