import { test as base, expect, type Page } from '@playwright/test';

// Viewports matching VISUAL-QA.md
export const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 },
} as const;

// Selectors
export const SEL = {
  nav: '#main-nav',
  navLinks: '#nav-marketing-links',
  navLink: (page: string) => `.nav-link[data-nav="${page}"]`,
  drawerLink: (page: string) => `.drawer-link[data-nav="${page}"]`,
  hamburger: '#hamburger-btn',
  drawer: '#nav-drawer',
  themeToggle: '#theme-toggle',
  langToggle: '#lang-toggle',
  pageSection: (page: string) => `#page-${page}`,
  logoText: '.gc-site-nav__logo-text',
} as const;

/** Wait for Shoelace custom elements to be defined */
export async function waitForShoelace(page: Page) {
  await page.waitForFunction(() => customElements.get('sl-drawer') !== undefined);
  await page.waitForTimeout(100);
}

/** Wait for custom fonts to load (Manrope, Inter) */
export async function waitForFonts(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
}

/** Navigate to a page via hash and wait for section to be visible */
export async function gotoPage(page: Page, name: string) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000); // let inline JS init + Tailwind CDN start
  if (name !== 'home') {
    const link = page.locator(SEL.navLink(name));
    await link.click();
    await page.waitForTimeout(500);
  }
  await page.waitForSelector(`${SEL.pageSection(name)}.active`, { state: 'visible', timeout: 10_000 });
}

/** Load page, wait for Shoelace and inline JS */
export async function setupPage(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await waitForShoelace(page);
}

/** Open the mobile drawer */
export async function openDrawer(page: Page) {
  const btn = page.locator(SEL.hamburger);
  await btn.click();
  const drawer = page.locator(SEL.drawer);
  await drawer.evaluate((el: any) => el.show());
  await page.waitForTimeout(400); // animation
}

/** Close the mobile drawer */
export async function closeDrawer(page: Page) {
  const drawer = page.locator(SEL.drawer);
  await drawer.evaluate((el: any) => el.hide());
  await page.waitForTimeout(400);
}

export { expect };
export const test = base;
