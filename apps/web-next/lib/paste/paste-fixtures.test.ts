// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* The pasted code on any website stack (a plain script tag, no platform
   app): every fixture in testing/paste-fixtures runs through the real
   messenger.js, tryon-paste.js and tryon-engine.js, and the test checks what
   a shopper would get: the product read from the page, one button in the
   expected place (or floating, or none), pills on listings, client-side
   navigation followed, and Store Chat showing the same product. */

const widget = (file: string) => readFileSync(`public/widget/v1/${file}.js`, 'utf8');
const APP = 'https://grindctrl.cloud';
const globals = window as unknown as Record<string, unknown>;
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const nativeSetTimeout = globalThis.setTimeout;
const wait = (ms: number) => new Promise((resolve) => nativeSetTimeout(resolve, ms));
// Timers the widgets start in one test, cleared before the next so a stale copy never touches its page.
let timers: Array<ReturnType<typeof setTimeout>> = [];
const later = () => new Date(Date.now() + 120000).toISOString();
const listeners: Array<[EventTarget, string, EventListenerOrEventListenerObject, boolean | AddEventListenerOptions | undefined]> = [];
const observers: MutationObserver[] = [];
const LIVE = { tryOn: 'live', reason: null, showCardPill: true, buttonLabel: 'Try it on', catalogLabel: 'Try on', accentBg: '#112233',
  accentFg: '#ffeedd', radiusPx: 8 };
type Product = { id: string; variantId: string | null; title: string; imageUrl: string; price: unknown; currency: string | null };
const detect = () => (globals.GRINDCTRL_TRYON_PASTE as { detectWebsiteProduct: () => Product | null }).detectWebsiteProduct();

let features: string[] = [];
let contextBodies: Array<Record<string, unknown>> = [];
let configUrls: URL[] = [];

function chatConfig() {
  return { v: 1, key: 'REPLACE_WITH_EMBED_KEY', storeName: 'Fixture store', active: true, available: true, aiEnabled: false,
    attachmentsEnabled: false, features, team: null,
    appearance: { position: 'bottom-right', accentColor: '#222222', launcherIcon: 'chat', launcherLabel: { en: 'Chat', ar: 'محادثة' },
      launcherSizePx: 56, radiusStyle: 'soft', languageMode: 'auto' },
    behaviour: { greetingEnabled: false, proactiveEnabled: false, targetingMode: 'all', excludePatterns: [] } };
}

/* Puts a fixture's head and body in this page at its own address. Its
   scripts do not run; the SPA's app script is returned to run on purpose. */
function load(file: string) {
  const doc = new DOMParser().parseFromString(readFileSync(`testing/paste-fixtures/${file}`, 'utf8'), 'text/html');
  const meta = (name: string) => doc.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ?? '';
  window.history.replaceState({}, '', meta('gc-fixture-path') || '/');
  document.documentElement.lang = doc.documentElement.lang;
  if (doc.documentElement.dir) document.documentElement.dir = doc.documentElement.dir;
  else document.documentElement.removeAttribute('dir');
  document.head.innerHTML = doc.head.innerHTML;
  document.body.innerHTML = doc.body.innerHTML;
  for (const tag of document.querySelectorAll('script[data-gc-install]')) tag.setAttribute('data-app-origin', APP);
  return { expect: meta('gc-fixture-expect'), app: doc.querySelector('script[data-fixture-app]')?.textContent ?? '' };
}
function boot(currentScript: HTMLScriptElement | null = document.querySelector<HTMLScriptElement>('script[data-gc-install]')) {
  vi.spyOn(document, 'currentScript', 'get').mockReturnValue(currentScript);
  (0, eval)(widget('messenger'));
}
const buttons = () => [...document.querySelectorAll<HTMLButtonElement>('.gc-tryon-btn')];
const pills = () => [...document.querySelectorAll<HTMLButtonElement>('.gc-tryon-pill')];
const launchers = () => document.querySelectorAll('[data-gc-chat-launcher]');

beforeEach(() => {
  vi.stubGlobal('navigator', Object.create(navigator, { sendBeacon: { value: vi.fn(() => true) } }));
  for (const target of [document, window]) {
    const add = target.addEventListener.bind(target);
    vi.spyOn(target, 'addEventListener').mockImplementation((type, listener, options) => {
      if (listener) listeners.push([target, type, listener, options]);
      add(type, listener, options);
    });
  }
  const Native = window.MutationObserver;
  vi.stubGlobal('MutationObserver', class extends Native {
    constructor(callback: MutationCallback) { super(callback); observers.push(this); }
  });
  // jsdom has no layout: every element gets a size unless its inline style zeroes it.
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const zero = /(^|;)\s*(width|height)\s*:\s*0/.test(this.getAttribute('style') ?? '');
    return { x: 0, y: 0, top: 0, left: 0, right: zero ? 0 : 120, bottom: zero ? 0 : 40, width: zero ? 0 : 120, height: zero ? 0 : 40, toJSON: () => ({}) } as DOMRect;
  });
  vi.stubGlobal('CSS', { supports: (_property: string, value: string) => /^#[0-9a-f]{3,8}$/i.test(value) });
  vi.stubGlobal('requestIdleCallback', vi.fn());
  vi.stubGlobal('setTimeout', (handler: TimerHandler, ms?: number, ...rest: unknown[]) => {
    const id = nativeSetTimeout(handler as (...args: unknown[]) => void, ms, ...rest);
    timers.push(id);
    return id;
  });
  features = [];
  contextBodies = [];
  configUrls = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), window.location.href);
    if (url.pathname === '/api/messenger/config') return json(chatConfig());
    if (url.pathname === '/api/try-on/paste-config') { configUrls.push(url); return json(LIVE); }
    if (url.pathname === '/api/try-on/paste-context') {
      const body = JSON.parse(String(init?.body));
      contextBodies.push(body);
      return json({ context: { expiresAt: later() }, embedUrl: `${APP}/embed/try-on?product=${body.productId}&sheet=1` });
    }
    return json({}, 404);
  }));
  document.documentElement.className = '';
  window.localStorage.clear();
  window.sessionStorage.clear();
  for (const key of ['GRINDCTRL_TRYON_PASTE', 'GRINDCTRL_TRYON_ENGINE', '__gcPasteTryOn', 'GRINDCTRL_MESSENGER', '__spaRender', 'Shopify', 'grindctrlWoo']) delete globals[key];
  // Loaded already, as the browser would have from the app origin.
  (0, eval)(widget('tryon-paste'));
  (0, eval)(widget('tryon-engine'));
});
/* Each test's messenger, adapter and engine stay alive in their closures:
   silence them (listeners, observers, timers, the chat frame), let work in
   flight finish, then empty the page, so the next test starts clean. Logout
   rather than close: close() walks history back, a navigation that would
   land in the next test. */
afterEach(async () => {
  (globals.GRINDCTRL_MESSENGER as { logout?: () => void } | undefined)?.logout?.();
  for (const [target, type, listener, options] of listeners.splice(0)) target.removeEventListener(type, listener, options);
  for (const observer of observers.splice(0)) observer.disconnect();
  for (const id of timers.splice(0)) clearTimeout(id);
  await wait(20);
  for (const id of timers.splice(0)) clearTimeout(id);
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const PRODUCT_PAGES: Array<[string, Partial<Product>]> = [
  ['plain-jsonld.html', { id: 'lwd-204', title: 'Linen wrap dress', imageUrl: 'https://cdn.ateliernour.example/products/lwd-204-front.jpg', price: '89.00', currency: 'USD' }],
  ['microdata-only.html', { id: 'os-311', title: 'Cotton overshirt', imageUrl: 'https://media.northline.example/overshirt-sand.jpg', price: '64.00', currency: 'EUR' }],
  ['og-only.html', { id: 'wool-cardigan', title: 'Wool cardigan', imageUrl: 'https://assets.pagekit.example/u/88/wool-cardigan.jpg', price: '120', currency: 'GBP' }],
  ['wix-like.html', { id: '364215376135191', title: 'Ribbed knit top', imageUrl: 'https://static.wixstatic.com/media/84770f_ribbed~mv2.jpg', price: '38.00', currency: 'USD' }],
  ['squarespace-like.html', { id: 'sq8125440', title: 'Pleated midi skirt', imageUrl: 'https://images.squarespace-cdn.com/content/v1/5f1/pleated-skirt.jpg', price: '95.00' }],
  ['webflow-like.html', { id: 'canvas-tote', title: 'Canvas tote', imageUrl: 'https://cdn.prod.website-files.com/64b/64c_canvas-tote.jpg', price: '45.00' }],
  ['easyorders-like.html', { id: 'dressa14', title: 'فستان كريب أسود', imageUrl: 'https://files.easy-orders.net/1715000000123.jpeg', price: 350, currency: 'EGP' }],
  ['salla-like.html', { id: '1987654321', title: 'فستان سهرة مطرز', imageUrl: 'https://cdn.salla.sa/XyZ/embroidered-dress.jpg', price: '749', currency: 'SAR' }],
  ['zid-like.html', { id: 'qamees-katan', variantId: 'QK-M', title: 'قميص كتان', imageUrl: 'https://media.zid.store/a1b2/qamees-katan.jpg', price: '220' }],
  ['no-button.html', { id: 'sand-trench', variantId: null, title: 'Sand trench coat', imageUrl: 'https://images.lookbook.example/sand-trench.jpg' }],
  ['double-load.html', { id: 'cb-9', title: 'Cropped blazer', imageUrl: 'https://cdn.blazers.example/cropped-blazer.jpg' }],
];

describe('a product page on any stack', () => {
  it.each(['jsonld', 'microdata', 'og'])('uses the canonical product slug, then the /products/ route, for identifier-free %s', (kind) => {
    load('easyorders-like.html');
    if (kind !== 'jsonld') document.getElementById('product-jsonld')!.remove();
    if (kind === 'microdata') {
      document.querySelector('main')!.insertAdjacentHTML('beforeend', '<div itemscope itemtype="https://schema.org/Product"><meta itemprop="name" content="Dress"><meta itemprop="image" content="https://files.easy-orders.net/1.jpeg"></div>');
    }
    document.querySelector('link[rel="canonical"]')!.setAttribute('href', '/products/CANONICAL1');
    expect(detect()?.id).toBe('canonical1');
    document.querySelector('link[rel="canonical"]')!.remove();
    expect(detect()?.id).toBe('dressa14');
  });

  it.each([
    ['اضغط هنا للشراء', 'button', true], ['للشراء', 'button', true], ['اضغط للشراء الآن', 'button', true],
    ['اطلب', 'button', true], ['اطلب', 'a', false], ['اطلب', 'div', false],
  ] as const)('purchase phrase %s on %s: matches=%s', (label, tag, matches) => {
    load('easyorders-like.html');
    document.querySelectorAll('main .mt-5').forEach((node) => node.remove());
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `<${tag} ${tag === 'a' ? 'href="/order"' : tag === 'div' ? 'role="button"' : ''}>${label}</${tag}>`;
    document.querySelector('main')!.appendChild(wrapper);
    const placement = (globals.GRINDCTRL_TRYON_PASTE as { create: (o: Record<string, unknown>) => { placement: () => { node: Element; mode: string } } })
      .create({ script: document.querySelector('script[data-gc-install]'), appOrigin: APP, locale: 'ar', visitorId: 'shared-visitor-123456' }).placement();
    expect(placement.mode).toBe(matches ? 'purchase' : 'title');
    if (matches) expect(placement.node).toBe(wrapper);
  });

  it.each(PRODUCT_PAGES)('%s: reads the product and places exactly one button where expected', async (file, product) => {
    const fixture = load(file);
    expect(detect()).toMatchObject(product);
    boot();
    await vi.waitFor(() => expect(buttons()).toHaveLength(1));
    const button = buttons()[0];
    expect(button.dataset.productId).toBe(product.id);
    if (fixture.expect === 'float') {
      expect(button.parentElement).toBe(document.body);
      expect(button).toHaveClass('gc-tryon-btn--float');
    } else {
      expect(button.previousElementSibling).toBe(document.querySelector('[data-gc-expect="after"]'));
      expect(button).not.toHaveClass('gc-tryon-btn--float');
    }
    // The owner's look from the first paint, asked in the page's language.
    expect(button.querySelector('.gc-tryon-label')).toHaveTextContent('Try it on');
    const rtl = document.documentElement.dir === 'rtl';
    expect(configUrls[0].searchParams.get('locale')).toBe(rtl ? 'ar' : 'en');
    expect(button.closest('[dir]')?.getAttribute('dir') ?? 'ltr').toBe(rtl ? 'rtl' : 'ltr');
    // Settles: our own button and its live region never make it re-place itself.
    await wait(700);
    expect(buttons()).toEqual([button]);
    expect(launchers()).toHaveLength(1);
  });

  it('lays out the injected button with logical properties only, so it mirrors in Arabic', () => {
    load('easyorders-like.html');
    boot();
    return vi.waitFor(() => {
      const css = document.getElementById('gc-tryon-woo-css')?.textContent ?? '';
      const rules = css.match(/\.gc-tryon-btn--(float|wide)[^{]*\{[^}]*\}/g) ?? [];
      expect(rules.length).toBeGreaterThan(2);
      for (const rule of rules) expect(rule).not.toMatch(/[{;](left|right|margin-left|margin-right|padding-left|padding-right)\s*:/);
      expect(css).toContain('inset-inline-start:16px');
      expect(css).toContain('env(safe-area-inset-bottom');
      expect(css).toMatch(/prefers-reduced-motion:reduce\)\{\.gc-tryon-btn--float\{animation:none/);
    });
  });

  it('skips a fixed bottom buy bar, hidden controls, card buttons and navigation', async () => {
    load('easyorders-like.html');
    const fixed = document.createElement('div');
    fixed.className = 'fixed-buy-bar';
    fixed.style.position = 'fixed';
    fixed.innerHTML = '<button>اطلب الآن</button>';
    document.body.prepend(fixed);
    boot();
    await vi.waitFor(() => expect(buttons()).toHaveLength(1));
    expect(buttons()[0].closest('.fixed-buy-bar')).toBeNull();
    expect(buttons()[0].previousElementSibling).toBe(document.querySelector('[data-gc-expect="after"]'));
    load('plain-jsonld.html');
    const placement = (globals.GRINDCTRL_TRYON_PASTE as { create: (o: Record<string, unknown>) => { placement: () => { node: Element; mode: string } } })
      .create({ script: document.querySelector('script[data-gc-install]'), appOrigin: APP, locale: 'en', visitorId: 'shared-visitor-123456' }).placement();
    expect(placement).toEqual({ node: document.querySelector('form.buy-form'), mode: 'purchase' });
  });

  it('floats at the bottom inline start, and takes the other corner when the chat bubble is on that side', async () => {
    load('no-button.html');
    boot();
    await vi.waitFor(() => expect(launchers()).toHaveLength(1));
    await vi.waitFor(() => expect(buttons()).toHaveLength(1));
    // English: start is left, the bubble is right.
    expect(buttons()[0]).not.toHaveClass('gc-tryon-btn--float-end');
  });

  it('floats away from the chat bubble on an Arabic page (start is the right edge there)', async () => {
    load('no-button.html');
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
    boot();
    await vi.waitFor(() => expect(launchers()).toHaveLength(1));
    await vi.waitFor(() => expect(buttons()[0]).toHaveClass('gc-tryon-btn--float', 'gc-tryon-btn--float-end'));
  });

  it('hides the floating pill while the Try-On sheet is open', async () => {
    load('no-button.html');
    boot();
    await vi.waitFor(() => expect(buttons()).toHaveLength(1));
    buttons()[0].click();
    await vi.waitFor(() => expect(document.querySelector('.gc-tryon-sheet')).not.toBeNull());
    expect(document.documentElement).toHaveClass('gc-tryon-open');
    expect(document.getElementById('gc-tryon-woo-css')?.textContent).toContain('.gc-tryon-open .gc-tryon-btn--float{visibility:hidden}');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.documentElement).not.toHaveClass('gc-tryon-open');
    expect(contextBodies[0]).toMatchObject({ productId: 'sand-trench', variantId: null, imageUrl: 'https://images.lookbook.example/sand-trench.jpg' });
    expect(contextBodies[0]).not.toHaveProperty('signed');
  });

  it('follows the size the shopper picks, and the ?variant= address, without changing the product id', () => {
    load('zid-like.html');
    expect(detect()).toMatchObject({ id: 'qamees-katan', variantId: 'QK-M', imageUrl: 'https://media.zid.store/a1b2/qamees-katan.jpg', price: '220' });
    (document.querySelector('input[value="L"]') as HTMLInputElement).checked = true;
    expect(detect()).toMatchObject({ id: 'qamees-katan', variantId: 'QK-L', imageUrl: 'https://media.zid.store/a1b2/qamees-katan-l.jpg', price: '230' });
    for (const input of document.querySelectorAll<HTMLInputElement>('input[name="size"]')) input.checked = false;
    expect(detect()?.variantId).toBeNull();
    window.history.replaceState({}, '', '/products/qamees-katan?variant=QK-L');
    expect(detect()).toMatchObject({ id: 'qamees-katan', variantId: 'QK-L' });
  });

  it('falls back to og:image, then the largest real image in the product area, never a pixel or a thumbnail', () => {
    window.history.replaceState({}, '', '/shop/plain-tee');
    document.head.innerHTML = '';
    document.body.innerHTML = `<script type="application/ld+json">${JSON.stringify({ '@type': 'Product', sku: 'tee-1', name: 'Plain tee' })}</script>
      <main><h1>Plain tee</h1><img src="https://cdn.example/pixel.gif" width="1" height="1"><img src="https://cdn.example/swatch.jpg" width="150" height="150"></main>`;
    expect(detect()).toBeNull();
    document.querySelector('main')!.insertAdjacentHTML('beforeend', '<img src="https://cdn.example/tee-small.jpg" width="400" height="500"><img src="https://cdn.example/tee-large.jpg" width="1000" height="1250"><img src="http://cdn.example/insecure.jpg" width="2000" height="2000">');
    expect(detect()).toMatchObject({ id: 'tee-1', imageUrl: 'https://cdn.example/tee-large.jpg' });
    document.head.innerHTML = '<meta property="og:image" content="https://cdn.example/og-tee.jpg">';
    expect(detect()?.imageUrl).toBe('https://cdn.example/og-tee.jpg');
  });

  it('adds nothing, and asks the server nothing, on a page without a product', async () => {
    load('not-product.html');
    delete globals.GRINDCTRL_TRYON_PASTE;
    delete globals.GRINDCTRL_TRYON_ENGINE;
    boot();
    await vi.waitFor(() => expect(launchers()).toHaveLength(1));
    await wait(400);
    expect(buttons()).toHaveLength(0);
    expect(pills()).toHaveLength(0);
    expect(configUrls).toHaveLength(0);
    expect(document.querySelector('script[src*="tryon-"]')).toBeNull();
  });
});

describe('a client-side store', () => {
  it('follows real EasyOrders products and clears Try-On and chat on onClick-only collections', async () => {
    features = ['v16_chat'];
    const fixture = load('easyorders-like.html');
    (0, eval)(fixture.app);
    boot();
    await vi.waitFor(() => expect(buttons().map((button) => button.dataset.productId)).toEqual(['dressa14']));
    expect(buttons()[0].previousElementSibling).toBe(document.querySelector('div.mt-5.flex.flex-col.flex-col-reverse.gap-4'));
    expect(document.querySelector('form')).toBeNull();
    const frame = await openChat();
    const posted = vi.spyOn(frame.contentWindow!, 'postMessage');
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'grindctrl-messenger:ready' }, source: frame.contentWindow }));
    await vi.waitFor(() => expect(pageProducts(posted).at(-1)).toMatchObject({ handle: 'dressa14', priceMinor: 35000, currency: 'EGP' }));
    document.querySelector<HTMLButtonElement>('[data-fixture-switch]')!.click();
    await vi.waitFor(() => expect(buttons().map((button) => button.dataset.productId)).toEqual(['dressb20']));
    expect(buttons()[0].previousElementSibling).toBe(document.querySelector('[data-gc-expect="after"]'));
    await vi.waitFor(() => expect(pageProducts(posted).at(-1)).toMatchObject({ handle: 'dressb20', title: 'فستان كريب أزرق',
      imageUrl: 'https://files.easy-orders.net/1715000000456.jpeg', priceMinor: 45000 }));
    document.querySelector<HTMLButtonElement>('[data-fixture-collection]')!.click();
    await vi.waitFor(() => expect(buttons()).toHaveLength(0));
    await vi.waitFor(() => expect(pageProducts(posted).at(-1)).toBeNull());
    await wait(450);
    expect(pills()).toHaveLength(0);
    expect(document.querySelector('a[href*="/products/"]')).toBeNull();
  });

  async function spa() {
    const fixture = load('spa.html');
    (0, eval)(fixture.app);
    boot();
    await vi.waitFor(() => expect(buttons().map((button) => button.dataset.productId)).toEqual(['ld-1']));
  }
  const navigate = (href: string) => (document.querySelector(`a[href="${href}"]`) as HTMLAnchorElement).click();

  it('keeps exactly one button, for the product now shown, through pushState and back', async () => {
    await spa();
    navigate('/shop/silk-abaya');
    await vi.waitFor(() => expect(buttons().map((button) => button.dataset.productId)).toEqual(['sa-2']));
    expect(buttons()[0].previousElementSibling).toBe(document.querySelector('[data-gc-expect="after"]'));
    navigate('/');
    await vi.waitFor(() => expect(document.querySelector('.home')).not.toBeNull());
    await wait(450);
    expect(buttons()).toHaveLength(0);
    window.history.back();
    await vi.waitFor(() => expect(buttons().map((button) => button.dataset.productId)).toEqual(['sa-2']));
    await wait(450);
    expect(buttons()).toHaveLength(1);
  });

  it('puts the button back after a re-render, a bounded number of times per address', async () => {
    await spa();
    const render = globals.__spaRender as () => void;
    let restored = 0;
    for (let i = 0; i < 5; i++) {
      render();
      expect(buttons()).toHaveLength(0);
      await wait(450);
      if (buttons().length) restored++;
      expect(buttons().length).toBeLessThanOrEqual(1);
    }
    expect(restored).toBe(3);
    // A new address starts a new count.
    navigate('/shop/silk-abaya');
    await vi.waitFor(() => expect(buttons()).toHaveLength(1));
  });

  it("tells Store Chat about the new product after a client-side route", async () => {
    features = ['v16_chat'];
    await spa();
    const frame = await openChat();
    const posted = vi.spyOn(frame.contentWindow!, 'postMessage');
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'grindctrl-messenger:ready' }, source: frame.contentWindow }));
    await vi.waitFor(() => expect(pageProducts(posted).at(-1)).toMatchObject({ handle: 'ld-1', title: 'Linen dress', tryOn: true }));
    navigate('/shop/silk-abaya');
    await vi.waitFor(() => expect(pageProducts(posted).at(-1)).toMatchObject({ handle: 'sa-2', title: 'Silk abaya',
      imageUrl: 'https://cdn.spa-shop.example/silk-abaya.jpg', priceMinor: 14000, currency: 'USD' }));
  });
});

describe('product cards on a listing', () => {
  it.each([
    ['listing-itemlist.html', { 'lwd-204': 'https://cdn.ateliernour.example/products/lwd-204-front.jpg',
      'poplin-shirt-dress': 'https://cdn.ateliernour.example/products/poplin.jpg', 'satin-slip': 'https://cdn.ateliernour.example/products/satin-slip.jpg' }],
    ['listing-data-attrs.html', { 'wool-coat': 'https://img.outerwear.example/wool-coat.jpg', 'quilted-vest': 'https://img.outerwear.example/quilted-vest.jpg' }],
  ] as const)('%s: one pill per listed card, each opening Try-On for its own product', async (file, images) => {
    const fixture = load(file);
    boot();
    const ids = Object.keys(images).sort();
    await vi.waitFor(() => expect(pills().map((pill) => pill.dataset.productId).sort()).toEqual(ids));
    expect(fixture.expect).toBe(`cards:${ids.length}`);
    expect(buttons()).toHaveLength(0);
    for (const pill of pills()) {
      expect(pill.closest('header, nav, a')).toBeNull();
      expect(pill.querySelector('.gc-tryon-label')).toHaveTextContent('Try on');
    }
    for (const [id, imageUrl] of Object.entries(images)) {
      document.querySelector<HTMLButtonElement>(`.gc-tryon-pill[data-product-id="${id}"]`)!.click();
      await vi.waitFor(() => expect(contextBodies.at(-1)).toMatchObject({ productId: id, imageUrl, variantId: null }));
      expect(contextBodies.at(-1)).not.toHaveProperty('signed');
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    }
    await wait(400);
    expect(pills()).toHaveLength(ids.length);
  });
  /* A stock WooCommerce shop page has no ItemList and no card tags: the
     loader must still start on it (the owner's test store showed no pills
     because only the adapter knew WooCommerce cards). */
  it('woocommerce-shop.html: the loader starts on a WooCommerce shop page and gives each card its pill', async () => {
    const fixture = load('woocommerce-shop.html');
    (window as unknown as { wc_add_to_cart_params?: object }).wc_add_to_cart_params = {};
    try {
      boot();
      await vi.waitFor(() => expect(pills().map((pill) => pill.dataset.productId).sort()).toEqual(['14', '15', '16']));
      expect(fixture.expect).toBe('cards:3');
      document.querySelector<HTMLButtonElement>('.gc-tryon-pill[data-product-id="14"]')!.click();
      await vi.waitFor(() => expect(contextBodies.at(-1)).toMatchObject({ productId: '14', imageUrl: 'https://store.example/wp-content/uploads/linen.jpg' }));
    } finally {
      delete (window as unknown as { wc_add_to_cart_params?: object }).wc_add_to_cart_params;
    }
  });
});

describe('loading the snippet', () => {
  it('runs once when pasted twice and injected again by a tag manager without currentScript', async () => {
    load('double-load.html');
    const [first, second] = document.querySelectorAll<HTMLScriptElement>('script[data-gc-install]');
    boot(first);
    boot(second);
    const injected = document.createElement('script');
    injected.src = 'http://localhost:3000/widget/v1/messenger.js';
    for (const [name, value] of Object.entries({ 'data-key': 'REPLACE_WITH_EMBED_KEY', 'data-gc-install': 'paste', 'data-gc-platform': 'website', 'data-app-origin': APP })) {
      injected.setAttribute(name, value);
    }
    document.body.appendChild(injected);
    boot(null);
    await vi.waitFor(() => expect(launchers()).toHaveLength(1));
    await vi.waitFor(() => expect(buttons()).toHaveLength(1));
    await wait(500);
    expect(launchers()).toHaveLength(1);
    expect(buttons()).toHaveLength(1);
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).includes('/api/messenger/config'))).toHaveLength(1);
  });

  it('finds its own tag when a tag manager runs it with no currentScript', async () => {
    load('plain-jsonld.html');
    boot(null);
    await vi.waitFor(() => expect(buttons()).toHaveLength(1));
    expect(launchers()).toHaveLength(1);
  });

  it('works when loaded in <head> before <body> exists', async () => {
    load('plain-jsonld.html');
    const body = document.body;
    document.documentElement.removeChild(body);
    const readyState = vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
    expect(() => boot()).not.toThrow();
    document.documentElement.appendChild(body);
    readyState.mockReturnValue('interactive');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await vi.waitFor(() => expect(buttons()).toHaveLength(1));
    expect(launchers()).toHaveLength(1);
  });
});

/* Store Chat reads the product with the very function the button uses
   (tryon-paste.js detectWebsiteProduct): the same fixtures, the same answer. */
async function openChat() {
  await vi.waitFor(() => expect(launchers()).toHaveLength(1));
  const launcher = (launchers()[0] as HTMLElement).shadowRoot!.querySelector<HTMLButtonElement>('button.btn')!;
  launcher.click();
  const frame = document.querySelector<HTMLIFrameElement>('iframe[src*="/embed/messenger"]');
  expect(frame).not.toBeNull();
  return frame!;
}
function pageProducts(posted: { mock: { calls: unknown[][] } }) {
  return posted.mock.calls.map(([message]) => message as { type?: string; product?: Record<string, unknown> | null })
    .filter((message) => message?.type === 'grindctrl-messenger:page-product').map((message) => message.product);
}

describe('Store Chat on any website', () => {
  it.each(PRODUCT_PAGES.map(([file]) => file))('%s: the panel shows the product the Try-On button uses', async (file) => {
    features = ['v16_chat'];
    load(file);
    boot();
    await vi.waitFor(() => expect(buttons()).toHaveLength(1));
    const expected = detect()!;
    const frame = await openChat();
    const posted = vi.spyOn(frame.contentWindow!, 'postMessage');
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'grindctrl-messenger:ready' }, source: frame.contentWindow }));
    // Sent on open and again when the panel says it is ready; both describe this product.
    await vi.waitFor(() => expect(pageProducts(posted).length).toBeGreaterThan(0));
    for (const product of pageProducts(posted)) {
      expect(product).toMatchObject({ handle: expected.id, title: expected.title, imageUrl: expected.imageUrl, variantId: '', tryOn: true });
    }
  });

  it('a chat-only install on a website reads the same product', async () => {
    features = ['v16_chat'];
    load('microdata-only.html');
    document.querySelector('script[data-gc-install]')!.removeAttribute('data-gc-install');
    boot();
    const frame = await openChat();
    const posted = vi.spyOn(frame.contentWindow!, 'postMessage');
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'grindctrl-messenger:ready' }, source: frame.contentWindow }));
    await vi.waitFor(() => expect(pageProducts(posted)[0]).toMatchObject({ handle: 'os-311', title: 'Cotton overshirt', priceMinor: 6400, currency: 'EUR', tryOn: false }));
    expect(buttons()).toHaveLength(0);
  });
});
