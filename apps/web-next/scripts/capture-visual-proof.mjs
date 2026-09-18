/* Captures the homepage's "real product UI" proof screenshots from the dev
   rig at app/dev/visual-proof/[scene]/page.tsx, plus the real public try-on
   page, and writes them to public/landing/proof/.

   Usage (against a dev server you started yourself):
     node scripts/capture-visual-proof.mjs --base http://localhost:3200
*/

import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'public', 'landing', 'proof');
const LOCALES = ['en', 'ar'];

// Same cookie lib/try-on/i18n.ts's TRYON_LOCALE_COOKIE resolves to (shared
// with the landing/pricing locale cookie) — hardcoded here since this is a
// plain Node ESM script with no TS path-alias resolution for '@/lib/...'.
const TRYON_LOCALE_COOKIE = 'gc-locale';

/* Each scene's own frame element is a fixed pixel box (see FRAME_SIZE in
   page.tsx) — cropped to exactly that box regardless of the surrounding
   browser viewport. `viewport` below is the OUTER browser size Chromium
   renders the page at, which only matters for the scenes whose real
   components read it: ConversationsPanel (inbox) sizes itself off
   window.visualViewport, so its viewport must equal the frame exactly, and
   MessengerOverview / TryOnOverviewView pick shorter, wider Tailwind
   `xl:` (>=1280px) grid layouts at a normal desktop width — which fits
   their fixed 560px/720px frame height far better than the frame's own
   1200px width would trigger on its own. */
const SCENES = [
  { id: 'chat', viewport: { width: 380, height: 640 } },
  { id: 'inbox', viewport: { width: 1200, height: 740 } },
  { id: 'report', viewport: { width: 1440, height: 1000 } },
  { id: 'tryon-usage', viewport: { width: 1440, height: 1000 } },
];

function parseArgs(argv) {
  const out = { base: 'http://localhost:3200' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--base') out.base = argv[i + 1];
  }
  return out;
}

async function waitReadyAndFonts(page) {
  await page.waitForSelector('[data-capture="ready"]', { timeout: 15_000 });
  await page.evaluate(() => document.fonts.ready);
}

/* RootLayout mounts the site-wide floating assistant launcher on every
   route that isn't /embed, /dashboard, /sign-in(-up) or already showing it
   — /dev/visual-proof and /try-on don't opt out, so its fixed-position chip
   floats over our capture. It's unrelated site chrome, not part of either
   surface being proven here, so hide anything position:fixed outside the
   capture target rather than special-casing the launcher's own markup. */
async function hideFixedChrome(page, keepSelector) {
  await page.addStyleTag({
    // nextjs-portal is `next dev`'s own dev-mode indicator button (a
    // shadow-DOM custom element with no class, so the .fixed rule below
    // never reaches it) — absent from a production build, so hiding it
    // here just keeps these proof shots honest about what ships.
    content: `nextjs-portal { display: none !important; }
      .fixed:not(${keepSelector}):not(${keepSelector} *) { visibility: hidden !important; }`,
  });
}

async function toWebp(pngBuffer, outFile) {
  const metadata = await sharp(pngBuffer).metadata();
  await sharp(pngBuffer).webp({ quality: 82, effort: 5 }).toFile(outFile);
  const { size } = await stat(outFile);
  return { width: metadata.width, height: metadata.height, bytes: size };
}

async function captureScene(browser, base, scene, locale, results) {
  const context = await browser.newContext({ viewport: scene.viewport, deviceScaleFactor: 2 });
  const page = await context.newPage();
  try {
    await page.goto(`${base}/dev/visual-proof/${scene.id}?locale=${locale}`, { waitUntil: 'load' });
    await hideFixedChrome(page, '#frame');
    await waitReadyAndFonts(page);
    const frame = page.locator('#frame');
    await frame.waitFor({ state: 'visible' });
    const png = await frame.screenshot();
    const outFile = path.join(OUT_DIR, `${scene.id}-${locale}.webp`);
    const info = await toWebp(png, outFile);
    results.push({ name: `${scene.id}-${locale}.webp`, ...info });
  } finally {
    await context.close();
  }
}

async function captureStorefrontTryOn(browser, base, locale, results) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await context.addCookies([
    { name: TRYON_LOCALE_COOKIE, value: locale, url: base },
  ]);
  const page = await context.newPage();
  try {
    await page.goto(`${base}/try-on`, { waitUntil: 'load' });
    await hideFixedChrome(page, '#__none__');
    // The product showcase image (Premium Ringer Tee) is rendered
    // unconditionally above the fold — wait for it to actually decode
    // rather than just attach, so we never capture a blank/broken image.
    await page.waitForSelector('main img[alt]');
    await page.waitForFunction(() => {
      const img = document.querySelector('main img[alt]');
      return Boolean(img && img.complete && img.naturalWidth > 0);
    });
    await page.evaluate(() => document.fonts.ready);
    const png = await page.screenshot();
    const outFile = path.join(OUT_DIR, `storefront-tryon-${locale}.webp`);
    const info = await toWebp(png, outFile);
    results.push({ name: `storefront-tryon-${locale}.webp`, ...info });
  } finally {
    await context.close();
  }
}

function printTable(rows) {
  const nameWidth = Math.max(4, ...rows.map((r) => r.name.length));
  console.log(`${'file'.padEnd(nameWidth)}  size          bytes`);
  for (const r of rows) {
    const size = `${r.width}x${r.height}`;
    console.log(`${r.name.padEnd(nameWidth)}  ${size.padEnd(12)}  ${r.bytes.toLocaleString()}`);
  }
}

async function main() {
  const { base } = parseArgs(process.argv.slice(2));
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const results = [];
  try {
    for (const scene of SCENES) {
      for (const locale of LOCALES) {
        await captureScene(browser, base, scene, locale, results);
      }
    }
    for (const locale of LOCALES) {
      await captureStorefrontTryOn(browser, base, locale, results);
    }
  } finally {
    await browser.close();
  }

  printTable(results);
}

main().catch((error) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  process.exit(1);
});
