import { test, expect } from '@playwright/test';

/* End-to-end proof for the storefront Support Messenger.
   The host page deliberately contains hostile CSS (resets, content-box,
   aggressive stacking) to prove the shadow-root launcher + iframe surface
   survive real-world theme conditions. API calls are intercepted so the
   shopper-side contract is tested without a live database. */

const CONFIG = {
  v: 1,
  key: 'gc_e2e_key',
  storeName: 'Sara’s Store',
  active: true,
  available: true,
  aiEnabled: true,
  appearance: {
    accentColor: '#2a2826',
    launcherIcon: 'chat',
    launcherCustomIconUrl: null,
    launcherLabel: { en: 'Support', ar: 'الدعم' },
    launcherSizePx: 56,
    position: 'bottom-right',
    radiusStyle: 'soft',
    themeMode: 'light',
    assistantAvatarUrl: null,
  },
  behaviour: {
    welcomeTitle: { en: 'Hi 👋 How can we help?', ar: 'مرحباً 👋 كيف نقدر نساعدك؟' },
    welcomeSubtitle: { en: 'Ask us anything.', ar: 'اسألنا أي شيء.' },
    inputPlaceholder: { en: 'Ask anything…', ar: 'اكتب سؤالك…' },
    greetingEnabled: false,
    greetingDelaySeconds: 0,
    greeting: null,
    proactiveEnabled: false,
    proactiveDelaySeconds: 30,
    targetingMode: 'everywhere',
    excludePatterns: [],
  },
};

const HOSTILE_CSS = `
  button { all: unset; }
  * { box-sizing: content-box; }
  img { max-width: 100%; }
  iframe { border: 10px solid red !important; }
  .launcher-zone { position: sticky; z-index: 5; }
`;

/* The fake storefront must live on the app's own origin: the loader tag is a
   relative URL and the widget derives its app origin from `script.src`. A
   bare page.setContent() runs on about:blank, where neither resolves — so we
   serve the host document from a routed same-origin URL instead. It also
   makes page.reload() a genuine refresh (localStorage survives). */
const HOST_PATH = '/e2e-storefront';

function hostHtml(options: { locale?: string; hostile?: boolean; shopOnly?: boolean } = {}) {
  /* shopOnly reproduces the Shopify app-embed block exactly: it knows the
     shop's permanent domain and nothing else — no embed key to paste. */
  const identity = options.shopOnly
    ? 'data-shop="sara-store.myshopify.com"'
    : `data-key="${CONFIG.key}"`;
  return `<!doctype html>
    <html><head><meta charset="utf-8"><style>${options.hostile === false ? '' : HOSTILE_CSS}</style></head>
    <body>
      <div class="launcher-zone">Sticky theme element</div>
      <h1>Store product page</h1>
      <button id="theme-cart">Add to cart</button>
      <script src="/widget/v1/messenger.js" ${identity} data-locale="${options.locale ?? ''}"></script>
    </body></html>`;
}

/* The loader attaches a zero-size shadow host and positions the button
   inside the shadow root, so assertions target the button (Playwright
   pierces shadow DOM), never the host box. */
function launcherButton(page: import('@playwright/test').Page) {
  return page.locator('div[class^="pos-"]').last().locator('button');
}

async function openHostPage(
  page: import('@playwright/test').Page,
  options: { locale?: string; intercept?: boolean; hostile?: boolean; shopOnly?: boolean } = {},
) {
  await page.route(`**${HOST_PATH}`, (route) =>
    route.fulfill({ contentType: 'text/html', body: hostHtml(options) }),
  );
  await page.route('**/api/messenger/config?*', (route) =>
    route.fulfill({ json: { ...CONFIG, key: new URL(route.request().url()).searchParams.get('key') ?? CONFIG.key } }),
  );
  if (options.intercept !== false) {
    let conversationCounter = 0;
    await page.route('**/api/messenger/bootstrap', (route) =>
      route.fulfill({
        json: {
          anonymousId: 'anon1234567890',
          conversationId: 'b3c9d1e2-1111-4222-8333-444455556666',
          status: 'open',
          aiEnabled: true,
          storeName: CONFIG.storeName,
          v: 1,
          messages: [],
        },
      }),
    );
    await page.route('**/api/messenger/send', (route) => {
      const body = route.request().postDataJSON() as { text?: string };
      conversationCounter += 1;
      const now = new Date().toISOString();
      route.fulfill({
        json: {
          userMessage: { id: `u-${conversationCounter}`, role: 'user', content: body.text ?? '', createdAt: now },
          reply:
            conversationCounter === 1
              ? { id: `a-${conversationCounter}`, role: 'assistant', content: 'We ship within 2 days!', createdAt: now, author: 'ai' }
              : null,
          status: 'open',
        },
      });
    });
  }

  await page.goto(HOST_PATH, { waitUntil: 'domcontentloaded' });
}

test.describe('storefront support messenger', () => {
  /* The iframe target is a server-rendered route; against `next dev` its
     first request pays a cold webpack compile that can outlast a whole test.
     Warm it once per worker so the specs measure the widget, not the
     bundler. Against a built server this returns immediately. */
  test.beforeAll(async ({ playwright }) => {
    const api = await playwright.request.newContext({ baseURL: 'http://localhost:3100' });
    await api
      .get(`/embed/messenger?key=${CONFIG.key}&locale=en&origin=http://localhost:3100`, {
        timeout: 300_000,
      })
      .catch(() => undefined);
    await api.dispose();
  });

  test('survives hostile theme CSS: launcher opens the panel and a full turn completes', async ({ page }) => {
    await openHostPage(page);

    const launcher = launcherButton(page);
    await expect(launcher).toBeVisible();
    await expect(launcher).toHaveAttribute('aria-expanded', 'false');

    // Hostile CSS (`button { all: unset }`) must not break the hit area.
    const box = await launcher.boundingBox();
    expect(box?.height).toBeGreaterThan(40);

    await launcher.click();
    await expect(launcher).toHaveAttribute('aria-expanded', 'true');

    const frame = page.frameLocator('iframe[src*="/embed/messenger"]');
    await expect(frame.locator('#gc-msgr-input')).toBeVisible({ timeout: 20_000 });

    await frame.locator('#gc-msgr-input').fill('How long is shipping?');
    await frame.getByRole('button', { name: /send message/i }).click();

    await expect(frame.getByText('How long is shipping?').first()).toBeVisible();
    await expect(frame.getByText('We ship within 2 days!')).toBeVisible();
  });

  test('boots from the Shopify app-embed block, which carries no embed key', async ({ page }) => {
    await openHostPage(page, { shopOnly: true });

    // Requiring data-key here once made the entire Shopify install path a
    // no-op: the loader returned before it could resolve the shop.
    const launcher = launcherButton(page);
    await expect(launcher).toBeVisible();

    await launcher.click();
    const frame = page.frameLocator('iframe[src*="/embed/messenger"]');
    await expect(frame.locator('#gc-msgr-input')).toBeVisible({ timeout: 20_000 });
  });

  test('renders Arabic RTL when the locale hint is ar', async ({ page }) => {
    await openHostPage(page, { locale: 'ar' });

    await launcherButton(page).click();

    const frame = page.frameLocator('iframe[src*="/embed/messenger"]');
    await expect(frame.locator('[dir="rtl"]')).toBeVisible({ timeout: 20_000 });
    await expect(frame.locator('#gc-msgr-input')).toHaveAttribute('placeholder', /اكتب سؤالك/);
  });

  test('restores the conversation after a full page refresh', async ({ page }) => {
    let bootstrapCalls = 0;
    await page.route('**/api/messenger/config?*', (route) => route.fulfill({ json: CONFIG }));
    await page.route('**/api/messenger/bootstrap', (route) => {
      bootstrapCalls += 1;
      return route.fulfill({
        json: {
          anonymousId: 'anon1234567890',
          conversationId: 'b3c9d1e2-1111-4222-8333-444455556666',
          status: 'handoff_requested',
          aiEnabled: true,
          storeName: CONFIG.storeName,
          v: 1,
          messages:
            bootstrapCalls === 1
              ? []
              : [
                  { id: 'u1', role: 'user', content: 'Where is my order?', createdAt: new Date().toISOString() },
                  { id: 's1', role: 'system', content: 'You are being connected with our team — we will reply here shortly.', createdAt: new Date().toISOString(), author: 'system' },
                ],
        },
      });
    });
    await page.route('**/api/messenger/send', (route) =>
      route.fulfill({
        json: {
          userMessage: { id: 'u1', role: 'user', content: 'Where is my order?', createdAt: new Date().toISOString() },
          reply: null,
          status: 'handoff_requested',
        },
      }),
    );

    await page.route(`**${HOST_PATH}`, (route) =>
      route.fulfill({ contentType: 'text/html', body: hostHtml({ hostile: false }) }),
    );
    await page.goto(HOST_PATH, { waitUntil: 'domcontentloaded' });

    const frame = page.frameLocator('iframe[src*="/embed/messenger"]');
    await launcherButton(page).click();
    await expect(frame.locator('#gc-msgr-input')).toBeVisible({ timeout: 20_000 });

    await frame.locator('#gc-msgr-input').fill('Where is my order?');
    await frame.getByRole('button', { name: /send message/i }).click();
    // Before the refresh the only handoff signal is the live status banner.
    await expect(frame.getByText(/connecting you with our team/i)).toBeVisible();

    // A genuine refresh of the same origin: localStorage (anon id +
    // conversation id) must survive and the loader must restore the thread.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await launcherButton(page).click();

    await expect(frame.getByText('Where is my order?').first()).toBeVisible({ timeout: 20_000 });
    await expect(frame.getByText(/being connected with our team/i)).toBeVisible();
  });

  test('mobile viewport: the opened messenger fills the screen and stays usable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 780 });
    await openHostPage(page);

    await launcherButton(page).click();
    const frame = page.frameLocator('iframe[src*="/embed/messenger"]');
    await expect(frame.locator('#gc-msgr-input')).toBeVisible({ timeout: 20_000 });

    const iframeBox = await page.locator('iframe[src*="/embed/messenger"]').boundingBox();
    expect(iframeBox?.width).toBeGreaterThan(370);
    expect(iframeBox?.x).toBeLessThanOrEqual(2);
  });
});
