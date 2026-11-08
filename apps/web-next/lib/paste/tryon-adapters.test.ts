// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const source = (file: string) => readFileSync(`public/widget/v1/${file}.js`, 'utf8');
type Product = { id: string; variantId: string | null; title: string; imageUrl: string; price: number | null; currency: string | null };
type Context = { embedUrl: string; context: { expiresAt: string }; settings?: Record<string, unknown> };
type Adapter = {
  prepare: () => Promise<boolean>; detectProduct: () => Product | null; placementTarget: () => Element | null;
  getContext: (product: Product) => Promise<Context>; addToCart: (variant: string, qty: number) => Promise<unknown>;
};
type Paste = { create: (options: Record<string, unknown>) => Adapter; detectWebsiteProduct: () => Product | null };
const globals = window as unknown as Record<string, unknown>;
const paste = () => globals.GRINDCTRL_TRYON_PASTE as Paste;
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const listeners: Array<[EventTarget, string, EventListenerOrEventListenerObject]> = [];
const APP = 'https://grindctrl.cloud';
const later = () => new Date(Date.now() + 120000).toISOString();

function snippet(platform = 'website', claims: Record<string, string> = {}) {
  const script = document.createElement('script');
  script.src = `${APP}/widget/v1/messenger.js`;
  Object.assign(script.dataset, { key: 'embed-key', gcInstall: 'paste', gcPlatform: platform, gcSite: 'site-id',
    gcShop: 'shop.myshopify.com', gcProduct: '42', gcVariant: '77', gcIssuedAt: '123', gcCustomer: '', gcSignature: 'signed', ...claims });
  return script;
}
function adapter(platform = 'website') {
  return paste().create({ script: snippet(platform), appOrigin: APP, locale: 'en',
    visitorId: 'shared-visitor-123456', preview: 'signed-preview-token' });
}
function mount(a: Adapter) {
  (0, eval)(source('tryon-engine'));
  (globals.GRINDCTRL_TRYON_ENGINE as { mount: (a: Adapter) => void }).mount(a);
}
function shopifyPage() {
  window.history.replaceState({}, '', '/products/dress');
  document.body.innerHTML = '<form action="/cart/add"><input name="id" value="88"></form>';
}
function bodyOf(call: number) {
  return JSON.parse(String(vi.mocked(fetch).mock.calls[call][1]?.body));
}
// Real Shopify JSON uses protocol-relative URLs; this jsdom page is http, so the fixture is absolute https.
const shopifyProduct = { id: 42, title: 'Dress', featured_image: 'https://cdn.shopify.com/dress.jpg', options: ['Size'],
  variants: [{ id: 77, title: 'M', available: true, price: 1000, option1: 'M' }, { id: 88, title: 'L', available: true, price: 1200, option1: 'L' }] };
const shopifyContext = (variant = '77') => ({ context: { expiresAt: later(), variantId: variant },
  embedUrl: `${APP}/embed/try-on?product=42&variant=${variant}&sheet=1#storefrontContext=proof` });

beforeEach(() => {
  for (const target of [document, window]) {
    const add = target.addEventListener.bind(target);
    vi.spyOn(target, 'addEventListener').mockImplementation((type, listener, options) => {
      if (listener) listeners.push([target, type, listener]);
      add(type, listener, options);
    });
  }
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  document.documentElement.lang = 'en';
  document.documentElement.style.overflow = '';
  window.history.replaceState({}, '', '/products/dress');
  window.localStorage.clear();
  for (const key of ['GRINDCTRL_TRYON_PASTE', 'GRINDCTRL_TRYON_ENGINE', '__gcPasteTryOn', 'GRINDCTRL_MESSENGER', 'Shopify', 'publish', 'PUB_SUB_EVENTS']) delete globals[key];
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({})));
  (0, eval)(source('tryon-paste'));
});
afterEach(() => {
  for (const [target, type, listener] of listeners.splice(0)) target.removeEventListener(type, listener);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('website product discovery', () => {
  it.each([
    { '@type': 'Product', sku: 'dress-42', name: 'Dress', image: ['https://images.example/dress.jpg'], offers: [{ price: 25, priceCurrency: 'EGP' }] },
    { '@graph': [{ '@type': 'WebSite' }, { '@type': ['Thing', 'Product'], productID: 'dress-42', name: 'Dress', image: { url: 'https://images.example/dress.jpg' }, offers: { price: 25, priceCurrency: 'EGP' } }] },
    [{ '@type': 'ProductGroup', hasVariant: [{ '@type': 'https://schema.org/Product', productID: 'dress-42', name: 'Dress', image: 'https://images.example/dress.jpg', offers: { price: 25, priceCurrency: 'EGP' } }] }],
    { '@type': 'WebPage', mainEntity: { '@type': 'Product', sku: 'DRESS-42', name: 'Dress', image: 'https://images.example/dress.jpg', offers: { lowPrice: 25, priceCurrency: 'EGP' } } },
  ])('reads JSON-LD arrays, type arrays, @graph, variants and mainEntity: %#', (data) => {
    document.body.innerHTML = `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
    expect(paste().detectWebsiteProduct()).toMatchObject({ id: 'dress-42', title: 'Dress', imageUrl: 'https://images.example/dress.jpg', price: 25, currency: 'EGP' });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('uses the page slug when the SKU cannot be a product id', () => {
    window.history.replaceState({}, '', '/shop/summer-dress');
    document.body.innerHTML = `<script type="application/ld+json">${JSON.stringify({ '@type': 'Product', sku: 'A/B 1', name: 'Dress', image: 'https://images.example/d.jpg' })}</script>`;
    expect(paste().detectWebsiteProduct()?.id).toBe('summer-dress');
  });
  it('falls through malformed JSON-LD to product Open Graph', () => {
    document.body.innerHTML = '<script type="application/ld+json">bad</script><meta property="product:retailer_item_id" content="42"><meta property="og:title" content="OG dress"><meta property="og:image" content="https://images.example/og.jpg"><meta property="product:price:amount" content="12"><meta property="product:price:currency" content="USD">';
    expect(paste().detectWebsiteProduct()).toMatchObject({ id: '42', title: 'OG dress', imageUrl: 'https://images.example/og.jpg', price: '12', currency: 'USD' });
  });
  it('uses the explicit tag last and never enables cart on a website', async () => {
    document.body.innerHTML = '<div data-grindctrl-tryon data-product-id="42" data-title="Tagged" data-image="https://images.example/tag.jpg"></div>';
    const a = adapter();
    expect(await a.prepare()).toBe(true);
    expect(a.detectProduct()).toMatchObject({ id: '42', title: 'Tagged' });
    expect(a.placementTarget()).toBe(document.querySelector('[data-grindctrl-tryon]'));
    expect(await a.addToCart('42', 1)).toBe('unsupported');
    expect(fetch).not.toHaveBeenCalled();
  });
  it("places the button after the page's own add-to-cart button when there is one", () => {
    document.body.innerHTML = '<div data-grindctrl-tryon data-product-id="42" data-title="T" data-image="https://images.example/t.jpg"></div><form><button name="add-to-cart">Add</button></form>';
    expect(adapter().placementTarget()).toBe(document.querySelector('button[name="add-to-cart"]'));
  });
  it('keeps non-product and unsafe image pages inactive', () => {
    document.body.innerHTML = '<meta property="og:image" content="https://images.example/blog.jpg">';
    expect(paste().detectWebsiteProduct()).toBeNull();
    document.body.innerHTML = '<div data-grindctrl-tryon data-product-id="42" data-title="Bad" data-image="javascript:alert(1)"></div>';
    expect(paste().detectWebsiteProduct()).toBeNull();
  });
  it('marks website context cart-unsupported and sends no signed claims', async () => {
    document.body.innerHTML = '<div data-grindctrl-tryon data-product-id="42" data-title="Tagged" data-image="https://images.example/tag.jpg"></div>';
    vi.mocked(fetch).mockResolvedValueOnce(json({ context: { expiresAt: later() }, embedUrl: `${APP}/embed/try-on?product=42` }));
    const a = adapter();
    await a.prepare();
    const result = await a.getContext(a.detectProduct()!);
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe(`${APP}/api/try-on/paste-context`);
    expect(vi.mocked(fetch).mock.calls[0][1]?.credentials).toBe('omit');
    const body = bodyOf(0);
    expect(body).toMatchObject({ key: 'embed-key', productId: '42', variantId: null, imageUrl: 'https://images.example/tag.jpg', pageUrl: window.location.href });
    expect(body).not.toHaveProperty('signed');
    expect(new URL(result.embedUrl).searchParams.get('cart')).toBe('unsupported');
  });
});

describe('Shopify paste', () => {
  it('re-reads the selected variant but keeps the signed claims and variant in context requests', async () => {
    shopifyPage();
    vi.mocked(fetch).mockResolvedValueOnce(json(shopifyProduct)).mockResolvedValueOnce(json(shopifyContext()));
    const a = adapter('shopify');
    expect(await a.prepare()).toBe(true);
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe('/products/dress.js');
    expect(a.detectProduct()?.variantId).toBe('88');
    const result = await a.getContext(a.detectProduct()!);
    expect(bodyOf(1)).toMatchObject({ productId: '42', variantId: '77', signed: { productId: '42', variantId: '77', signature: 'signed' },
      visitorId: 'shared-visitor-123456', preview: 'signed-preview-token' });
    const url = new URL(result.embedUrl);
    expect(url.searchParams.get('variant')).toBe('77');
    expect(url.searchParams.get('selectedVariant')).toBe('88');
    expect(url.searchParams.get('variantTitle')).toBe('L');
    expect(url.hash).toBe('#storefrontContext=proof');
    (document.querySelector('input') as HTMLInputElement).value = '77';
    expect(a.detectProduct()?.variantId).toBe('77');
    await a.getContext(a.detectProduct()!);
    expect(fetch).toHaveBeenCalledTimes(2); // a valid context is reused, never a replay of the same render
  });
  it('reads a fresh signed render of this page once when the first one was used or went stale', async () => {
    shopifyPage();
    const fresh = '<html><body><script async src="x" data-key="embed-key" data-gc-install="paste" data-gc-platform="shopify" data-gc-site="site-id" data-gc-shop="shop.myshopify.com" data-gc-product="42" data-gc-variant="88" data-gc-issued-at="456" data-gc-customer="" data-gc-signature="fresh"></script></body></html>';
    vi.mocked(fetch).mockResolvedValueOnce(json(shopifyProduct))
      .mockResolvedValueOnce(json({ error: 'replayed' }, 409))
      .mockResolvedValueOnce(new Response(fresh, { status: 200, headers: { 'Content-Type': 'text/html' } }))
      .mockResolvedValueOnce(json(shopifyContext('88')));
    const a = adapter('shopify');
    await a.prepare();
    const result = await a.getContext(a.detectProduct()!);
    const page = new URL(String(vi.mocked(fetch).mock.calls[2][0]), window.location.href);
    expect(page.pathname).toBe('/products/dress');
    expect(page.searchParams.get('variant')).toBe('88');
    expect(bodyOf(3)).toMatchObject({ variantId: '88', signed: { variantId: '88', issuedAt: '456', signature: 'fresh' } });
    expect(new URL(result.embedUrl).searchParams.get('variant')).toBe('88');
  });
  it('does not loop or hide the button when no fresh render is available', async () => {
    shopifyPage();
    vi.mocked(fetch).mockResolvedValueOnce(json(shopifyProduct))
      .mockResolvedValueOnce(json({ error: 'stale_signature' }, 401))
      .mockResolvedValueOnce(new Response('<html></html>', { status: 200 }));
    const a = adapter('shopify');
    await a.prepare();
    const error = await a.getContext(a.detectProduct()!).catch((e: Error & { hidden?: boolean }) => e);
    expect(error).toMatchObject({ message: 'stale_signature' });
    expect((error as { hidden?: boolean }).hidden).toBeFalsy();
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it.each([['out_of_looks', 409, true], ['origin_not_allowed', 403, true], ['rate_limited', 429, false], ['unavailable', 503, false]] as const)(
    'classifies %s as hidden=%s', async (code, status, hidden) => {
      shopifyPage();
      vi.mocked(fetch).mockResolvedValueOnce(json(shopifyProduct)).mockResolvedValueOnce(json({ error: code }, status));
      const a = adapter('shopify');
      await a.prepare();
      await expect(a.getContext(a.detectProduct()!)).rejects.toMatchObject({ hidden });
    });
  it('adds only a variant of the signed product and refreshes the theme cart without navigation', async () => {
    shopifyPage();
    document.body.insertAdjacentHTML('beforeend', '<span data-cart-count>0</span>');
    const publish = vi.fn();
    Object.assign(globals, { publish, PUB_SUB_EVENTS: { cartUpdate: 'cart-update' } });
    const refresh = vi.fn();
    document.addEventListener('cart:refresh', refresh);
    vi.mocked(fetch).mockResolvedValueOnce(json(shopifyProduct))
      .mockResolvedValueOnce(json({ items: [{ id: 88, variant_title: 'L' }] }))
      .mockResolvedValueOnce(json({ item_count: 2 }));
    const a = adapter('shopify');
    await a.prepare();
    expect(await a.addToCart('999', 1)).toEqual({ ok: false });
    expect(await a.addToCart('88', 2)).toEqual({ ok: true, variantTitle: 'L' });
    const [url, init] = vi.mocked(fetch).mock.calls[1];
    expect(url).toBe('/cart/add.js');
    expect(init?.credentials).toBe('same-origin');
    expect(JSON.parse(String(init?.body))).toEqual({ items: [{ id: 88, quantity: 2 }] });
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(publish).toHaveBeenCalledWith('cart-update', expect.objectContaining({ source: 'grindctrl-tryon', productVariantId: 88 }));
    expect(document.querySelector('[data-cart-count]')).toHaveTextContent('2');
    expect(window.location.pathname).toBe('/products/dress');
  });
  it("passes on the store's own refusal message", async () => {
    shopifyPage();
    vi.mocked(fetch).mockResolvedValueOnce(json(shopifyProduct)).mockResolvedValueOnce(json({ description: 'All 1 L are in your cart.' }, 422));
    const a = adapter('shopify');
    await a.prepare();
    expect(await a.addToCart('88', 1)).toEqual({ ok: false, message: 'All 1 L are in your cart.' });
  });
  it('does not accept public JSON for a different product', async () => {
    shopifyPage();
    vi.mocked(fetch).mockResolvedValueOnce(json({ ...shopifyProduct, id: 999 }));
    expect(await adapter('shopify').prepare()).toBe(false);
  });
});

describe('shared hosted engine with a paste adapter', () => {
  async function openShopifySheet(extra: Partial<Context> = {}) {
    shopifyPage();
    vi.mocked(fetch).mockResolvedValueOnce(json(shopifyProduct)).mockResolvedValueOnce(json({ ...shopifyContext(), ...extra }));
    const a = adapter('shopify');
    await a.prepare();
    mount(a);
    const button = document.querySelector('.gc-tryon-btn') as HTMLButtonElement;
    button.click();
    await tick();
    await tick();
    const sheet = document.querySelector('.gc-tryon-sheet') as HTMLElement;
    return { a, button, sheet, frame: sheet.querySelector('iframe')! };
  }
  const message = (origin: string, sender: Window | null, data: Record<string, unknown>) =>
    window.dispatchEvent(new MessageEvent('message', { origin, source: sender, data }));

  it('injects the existing button after the cart form and only handles messages from its exact frame and origin', async () => {
    const { button, sheet, frame } = await openShopifySheet();
    expect(button.previousElementSibling?.matches('form[action*="/cart/add"]')).toBe(true);
    expect(button.dataset.productId).toBe('42');
    expect(frame.src.startsWith(`${APP}/embed/try-on?`)).toBe(true);
    message('https://evil.example', frame.contentWindow, { type: 'grindctrl-tryon:close' });
    message(APP, window, { type: 'grindctrl-tryon:close' });
    expect(sheet.hidden).toBe(false);
    message(APP, frame.contentWindow, { type: 'grindctrl-tryon:close' });
    expect(sheet.hidden).toBe(true);
    expect(document.querySelector('.gc-tryon-loading')?.getAttribute('role')).toBe('status');
    expect(document.querySelector('.gc-tryon-ready')).not.toBeNull();
  });
  it('refuses an embed URL on any origin but the app', async () => {
    shopifyPage();
    vi.mocked(fetch).mockResolvedValueOnce(json(shopifyProduct))
      .mockResolvedValueOnce(json({ context: { expiresAt: later() }, embedUrl: 'https://evil.example/embed/try-on' }));
    const a = adapter('shopify');
    await a.prepare();
    mount(a);
    (document.querySelector('.gc-tryon-btn') as HTMLButtonElement).click();
    await tick();
    await tick();
    expect(document.querySelector('.gc-tryon-sheet')).toBeNull();
    expect(document.querySelector('.gc-tryon-note')).not.toBeNull();
  });
  it("applies the owner's label and colors from the context settings", async () => {
    // jsdom has no CSS.supports; browsers do.
    vi.stubGlobal('CSS', { supports: (_property: string, value: string) => /^#[0-9a-f]{3,8}$/i.test(value) });
    const { button } = await openShopifySheet({ settings: { buttonLabel: 'Try it on', accentBg: '#112233', accentFg: 'not a color', radiusPx: 6 } });
    expect(button.querySelector('.gc-tryon-label')).toHaveTextContent('Try it on');
    expect(button.style.getPropertyValue('--gc-bg')).toBe('#112233');
    expect(button.style.getPropertyValue('--gc-fg')).toBe('');
    expect(button.style.getPropertyValue('--gc-radius')).toBe('6px');
  });
  it('keeps an opened look when the shopper changes size on the page, and adds the size the sheet asks for', async () => {
    const { button, sheet, frame } = await openShopifySheet();
    message(APP, frame.contentWindow, { type: 'grindctrl-tryon:close' });
    (document.querySelector('input') as HTMLInputElement).value = '77';
    button.click();
    await tick();
    expect(document.querySelectorAll('.gc-tryon-sheet')).toHaveLength(1);
    expect(sheet.hidden).toBe(false);
    vi.mocked(fetch).mockResolvedValueOnce(json({ items: [{ variant_title: 'L' }] })).mockResolvedValueOnce(json({ item_count: 1 }));
    const replies = vi.spyOn(frame.contentWindow!, 'postMessage');
    message(APP, frame.contentWindow, { type: 'grindctrl-tryon:add-to-cart', variantId: '88' });
    await vi.waitFor(() => expect(replies).toHaveBeenCalledWith({ type: 'grindctrl-tryon:cart-result', ok: true, variantTitle: 'L' }, APP));
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[2][1]?.body))).toEqual({ items: [{ id: 88, quantity: 1 }] });
  });
  it('a website look returns to the product instead of adding to a cart', async () => {
    document.body.innerHTML = '<div data-grindctrl-tryon data-product-id="42" data-title="Tagged" data-image="https://images.example/tag.jpg"></div>';
    vi.mocked(fetch).mockResolvedValueOnce(json({ context: { expiresAt: later() }, embedUrl: `${APP}/embed/try-on?product=42` }));
    const a = adapter();
    await a.prepare();
    mount(a);
    (document.querySelector('.gc-tryon-btn') as HTMLButtonElement).click();
    await tick();
    await tick();
    const sheet = document.querySelector('.gc-tryon-sheet') as HTMLElement;
    const frame = sheet.querySelector('iframe')!;
    expect(new URL(frame.src).searchParams.get('cart')).toBe('unsupported');
    message(APP, frame.contentWindow, { type: 'grindctrl-tryon:back-to-product' });
    expect(sheet.hidden).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('removes the button when the store cannot start a look', async () => {
    shopifyPage();
    vi.mocked(fetch).mockResolvedValueOnce(json(shopifyProduct)).mockResolvedValueOnce(json({ error: 'out_of_looks' }, 409));
    const a = adapter('shopify');
    await a.prepare();
    mount(a);
    (document.querySelector('.gc-tryon-btn') as HTMLButtonElement).click();
    await tick();
    await tick();
    expect(document.querySelector('.gc-tryon-btn')).toBeNull();
    expect(document.querySelector('.gc-tryon-sheet')).toBeNull();
  });
  it('adds no second button next to an app or plugin button and leaves that button to its own loader', async () => {
    shopifyPage();
    document.body.insertAdjacentHTML('beforeend', '<button type="button" class="gc-tryon-btn" data-product-id="7">Plugin</button>');
    vi.mocked(fetch).mockResolvedValueOnce(json(shopifyProduct));
    const a = adapter('shopify');
    await a.prepare();
    mount(a);
    expect(document.querySelectorAll('.gc-tryon-btn')).toHaveLength(1);
    (document.querySelector('.gc-tryon-btn') as HTMLButtonElement).click();
    await tick();
    expect(document.querySelector('.gc-tryon-sheet')).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('messenger paste loading', () => {
  it.each(['website', 'shopify'])('loads no Try-On assets on non-product %s pages', async (platform) => {
    window.history.replaceState({}, '', '/pages/about');
    vi.spyOn(document, 'currentScript', 'get').mockReturnValue(snippet(platform));
    vi.mocked(fetch).mockResolvedValue(json(null));
    (0, eval)(source('messenger'));
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await tick();
    expect(document.querySelector('script[src*="tryon-"]')).toBeNull();
    expect(globals.GRINDCTRL_MESSENGER).toBeDefined();
  });
  it('loads only the versioned paste adapter on a website product page, and fetches config for the install signal', async () => {
    document.body.innerHTML = `<script type="application/ld+json">${JSON.stringify({ '@type': 'Product', sku: 'dress', image: 'https://images.example/d.jpg' })}</script>`;
    delete globals.GRINDCTRL_TRYON_PASTE;
    vi.spyOn(document, 'currentScript', 'get').mockReturnValue(snippet('website'));
    vi.mocked(fetch).mockResolvedValue(json(null));
    (0, eval)(source('messenger'));
    document.dispatchEvent(new Event('DOMContentLoaded'));
    const scripts = [...document.querySelectorAll<HTMLScriptElement>('script[src*="tryon-"]')].map((node) => node.src);
    expect(scripts).toEqual([`${APP}/widget/v1/tryon-paste.js?v=1.1.0`]);
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).startsWith(`${APP}/api/messenger/config?key=embed-key`))).toBe(true);
  });
  it('chat boots even when product adapter loading fails', async () => {
    shopifyPage();
    delete globals.GRINDCTRL_TRYON_PASTE;
    vi.spyOn(document, 'currentScript', 'get').mockReturnValue(snippet('shopify'));
    vi.mocked(fetch).mockResolvedValue(json(null));
    (0, eval)(source('messenger'));
    document.dispatchEvent(new Event('DOMContentLoaded'));
    const script = document.querySelector('script[src*="tryon-paste"]')!;
    expect(script).not.toBeNull();
    script.dispatchEvent(new Event('error'));
    await tick();
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/api/messenger/config'))).toBe(true);
    expect(globals.GRINDCTRL_MESSENGER).toBeDefined();
  });
});
