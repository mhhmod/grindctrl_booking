// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

const source = (file: string) => readFileSync(`public/widget/v1/${file}.js`, 'utf8');
type Product = { id: string; variantId: string | null; title: string; imageUrl: string; price: number | null; currency: string | null };
type Context = { embedUrl: string; context: { expiresAt: string }; settings?: Record<string, unknown> };
type Adapter = {
  prepare: () => Promise<boolean>; detectProduct: () => Product | null; placementTarget: () => Element | null;
  getContext: (product: Product) => Promise<Context>; addToCart: (variant: string, qty: number, state?: { product: Product }) => Promise<unknown>;
  getProduct: (product: Product) => Promise<{ variants: Array<{ id: string }> } | null>;
};
type Paste = { create: (options: Record<string, unknown>) => Adapter; detectWebsiteProduct: () => Product | null };
const globals = window as unknown as Record<string, unknown>;
const paste = () => globals.GRINDCTRL_TRYON_PASTE as Paste;
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const listeners: Array<[EventTarget, string, EventListenerOrEventListenerObject]> = [];
const APP = 'https://grindctrl.cloud';
const later = () => new Date(Date.now() + 120000).toISOString();
const LIVE_CONFIG = { tryOn: 'live', reason: null, showCardPill: false, buttonLabel: 'Try it on', accentBg: '#112233',
  accentFg: '#ffeedd', radiusPx: 6, iconBgFrom: '#000000', iconBgTo: '#ffffff', buttonIconPx: 32 };
/* The store's own requests (product JSON, cart, paste-context) go to
   pageFetch in call order; /api/try-on/paste-config, read in parallel with
   them, goes to configFetch. */
let pageFetch: Mock<typeof fetch>;
let configFetch: Mock<typeof fetch>;

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
  return JSON.parse(String(pageFetch.mock.calls[call][1]?.body));
}
// Real Shopify JSON uses protocol-relative URLs; this jsdom page is http, so the fixture is absolute https.
const shopifyProduct = { id: 42, title: 'Dress', featured_image: 'https://cdn.shopify.com/dress.jpg', options: ['Size'],
  variants: [{ id: 77, title: 'M', available: true, price: 1000, option1: 'M' }, { id: 88, title: 'L', available: true, price: 1200, option1: 'L' }] };
const shopifyContext = (variant = '77') => ({ context: { expiresAt: later(), variantId: variant },
  embedUrl: `${APP}/embed/try-on?product=42&variant=${variant}&sheet=1#storefrontContext=proof` });

beforeEach(() => {
  delete globals.woocommerce_params; delete globals.wc_add_to_cart_params; delete globals.wpApiSettings;
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
  pageFetch = vi.fn<typeof fetch>().mockResolvedValue(json({}));
  configFetch = vi.fn<typeof fetch>(async () => json(LIVE_CONFIG));
  vi.stubGlobal('fetch', vi.fn<typeof fetch>((input, init) =>
    (String(input).includes('/api/try-on/paste-config') ? configFetch : pageFetch)(input, init)));
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
    expect(pageFetch).not.toHaveBeenCalled();
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
    expect(pageFetch).not.toHaveBeenCalled();
  });
  it("places the button at the merchant's tag first, else after the page's own add-to-cart button", () => {
    // jsdom has no layout; a browser gives these controls a size.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ width: 120, height: 40 } as DOMRect);
    document.body.innerHTML = '<div data-grindctrl-tryon data-product-id="42" data-title="T" data-image="https://images.example/t.jpg"></div><form><button name="add-to-cart">Add</button></form>';
    expect(adapter().placementTarget()).toBe(document.querySelector('[data-grindctrl-tryon]'));
    (document.querySelector('[data-grindctrl-tryon]') as HTMLElement).style.display = 'none';
    expect(adapter().placementTarget()).toBe(document.querySelector('form'));
  });
  it('keeps non-product and unsafe image pages inactive', () => {
    document.body.innerHTML = '<meta property="og:image" content="https://images.example/blog.jpg">';
    expect(paste().detectWebsiteProduct()).toBeNull();
    document.body.innerHTML = '<div data-grindctrl-tryon data-product-id="42" data-title="Bad" data-image="javascript:alert(1)"></div>';
    expect(paste().detectWebsiteProduct()).toBeNull();
  });
  it('marks website context cart-unsupported and sends no signed claims', async () => {
    document.body.innerHTML = '<div data-grindctrl-tryon data-product-id="42" data-title="Tagged" data-image="https://images.example/tag.jpg"></div>';
    pageFetch.mockResolvedValueOnce(json({ context: { expiresAt: later() }, embedUrl: `${APP}/embed/try-on?product=42` }));
    const a = adapter();
    await a.prepare();
    const result = await a.getContext(a.detectProduct()!);
    expect(String(pageFetch.mock.calls[0][0])).toBe(`${APP}/api/try-on/paste-context`);
    expect(pageFetch.mock.calls[0][1]?.credentials).toBe('omit');
    const body = bodyOf(0);
    expect(body).toMatchObject({ key: 'embed-key', productId: '42', variantId: null, imageUrl: 'https://images.example/tag.jpg', pageUrl: window.location.href });
    expect(body).not.toHaveProperty('signed');
    expect(new URL(result.embedUrl).searchParams.get('cart')).toBe('unsupported');
  });
});

describe('Shopify paste', () => {
  it('re-reads the selected variant but keeps the signed claims and variant in context requests', async () => {
    shopifyPage();
    pageFetch.mockResolvedValueOnce(json(shopifyProduct)).mockResolvedValueOnce(json(shopifyContext()));
    const a = adapter('shopify');
    expect(await a.prepare()).toBe(true);
    expect(String(pageFetch.mock.calls[0][0])).toBe('/products/dress.js');
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
    expect(pageFetch).toHaveBeenCalledTimes(2); // a valid context is reused, never a replay of the same render
  });
  it('reads a fresh signed render of this page once when the first one was used or went stale', async () => {
    shopifyPage();
    const fresh = '<html><body><script async src="x" data-key="embed-key" data-gc-install="paste" data-gc-platform="shopify" data-gc-site="site-id" data-gc-shop="shop.myshopify.com" data-gc-product="42" data-gc-variant="88" data-gc-issued-at="456" data-gc-customer="" data-gc-signature="fresh"></script></body></html>';
    pageFetch.mockResolvedValueOnce(json(shopifyProduct))
      .mockResolvedValueOnce(json({ error: 'replayed' }, 409))
      .mockResolvedValueOnce(new Response(fresh, { status: 200, headers: { 'Content-Type': 'text/html' } }))
      .mockResolvedValueOnce(json(shopifyContext('88')));
    const a = adapter('shopify');
    await a.prepare();
    const result = await a.getContext(a.detectProduct()!);
    const page = new URL(String(pageFetch.mock.calls[2][0]), window.location.href);
    expect(page.pathname).toBe('/products/dress');
    expect(page.searchParams.get('variant')).toBe('88');
    expect(bodyOf(3)).toMatchObject({ variantId: '88', signed: { variantId: '88', issuedAt: '456', signature: 'fresh' } });
    expect(new URL(result.embedUrl).searchParams.get('variant')).toBe('88');
  });
  it('does not loop or hide the button when no fresh render is available', async () => {
    shopifyPage();
    pageFetch.mockResolvedValueOnce(json(shopifyProduct))
      .mockResolvedValueOnce(json({ error: 'stale_signature' }, 401))
      .mockResolvedValueOnce(new Response('<html></html>', { status: 200 }));
    const a = adapter('shopify');
    await a.prepare();
    const error = await a.getContext(a.detectProduct()!).catch((e: Error & { hidden?: boolean }) => e);
    expect(error).toMatchObject({ message: 'stale_signature' });
    expect((error as { hidden?: boolean }).hidden).toBeFalsy();
    expect(pageFetch).toHaveBeenCalledTimes(3);
  });
  it.each([['out_of_looks', 409, true], ['paused', 409, true], ['origin_not_allowed', 403, true], ['shop_proof_pending', 403, true], ['shopify_app_installed', 409, true], ['rate_limited', 429, false], ['unavailable', 503, false]] as const)(
    'classifies %s as hidden=%s', async (code, status, hidden) => {
      shopifyPage();
      pageFetch.mockResolvedValueOnce(json(shopifyProduct)).mockResolvedValueOnce(json({ error: code }, status));
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
    pageFetch.mockResolvedValueOnce(json(shopifyProduct))
      .mockResolvedValueOnce(json({ items: [{ id: 88, variant_title: 'L' }] }))
      .mockResolvedValueOnce(json({ item_count: 2 }));
    const a = adapter('shopify');
    await a.prepare();
    expect(await a.addToCart('999', 1)).toEqual({ ok: false });
    expect(await a.addToCart('88', 2)).toEqual({ ok: true, variantTitle: 'L' });
    const [url, init] = pageFetch.mock.calls[1];
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
    pageFetch.mockResolvedValueOnce(json(shopifyProduct)).mockResolvedValueOnce(json({ description: 'All 1 L are in your cart.' }, 422));
    const a = adapter('shopify');
    await a.prepare();
    expect(await a.addToCart('88', 1)).toEqual({ ok: false, message: 'All 1 L are in your cart.' });
  });
  it('does not accept public JSON for a different product', async () => {
    shopifyPage();
    pageFetch.mockResolvedValueOnce(json({ ...shopifyProduct, id: 999 }));
    expect(await adapter('shopify').prepare()).toBe(false);
  });
});

describe('shared hosted engine with a paste adapter', () => {
  async function openShopifySheet(extra: Partial<Context> = {}) {
    shopifyPage();
    pageFetch.mockResolvedValueOnce(json(shopifyProduct)).mockResolvedValueOnce(json({ ...shopifyContext(), ...extra }));
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
    expect(frame.hasAttribute('title')).toBe(false);
    expect(frame.getAttribute('aria-label')).toBe('GRINDCTRL Try-On');
    expect(sheet.querySelectorAll('.gc-tryon-skeleton__tips span')).toHaveLength(3);
    expect(sheet.querySelector('.gc-tryon-skeleton__button')).not.toBeNull();
    expect(source('tryon-engine')).toMatch(/@media \(min-width:640px\)[\s\S]*?\.gc-tryon-sheet__handle\{display:none\}/);
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
    pageFetch.mockResolvedValueOnce(json(shopifyProduct))
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
  it("applies the owner's label and colors from the context settings when the config could not be read", async () => {
    // jsdom has no CSS.supports; browsers do.
    vi.stubGlobal('CSS', { supports: (_property: string, value: string) => /^#[0-9a-f]{3,8}$/i.test(value) });
    configFetch.mockResolvedValueOnce(json({ tryOn: 'hidden', reason: 'unavailable' }, 503));
    const { button } = await openShopifySheet({ settings: { buttonLabel: 'Try it on', accentBg: '#112233', accentFg: 'not a color', radiusPx: 6,
      iconBgFrom: '#000000', iconBgTo: 'nope', buttonIconPx: 99 } });
    expect(button.querySelector('.gc-tryon-label')).toHaveTextContent('Try it on');
    expect(button.style.getPropertyValue('--gc-bg')).toBe('#112233');
    expect(button.style.getPropertyValue('--gc-fg')).toBe('');
    expect(button.style.getPropertyValue('--gc-radius')).toBe('6px');
    // The gradient is a pair; the size stays in the dashboard's range.
    expect(button.style.getPropertyValue('--gc-ic-from')).toBe('');
    expect(button.style.getPropertyValue('--gc-ic-to')).toBe('');
    expect(button.style.getPropertyValue('--gc-ic-size')).toBe('40px');
  });
  it('leaves an already styled button as it is when the context settings arrive', async () => {
    vi.stubGlobal('CSS', { supports: (_property: string, value: string) => /^#[0-9a-f]{3,8}$/i.test(value) });
    const { button } = await openShopifySheet({ settings: { buttonLabel: 'Other label', accentBg: '#999999', radiusPx: 0 } });
    expect(button.querySelector('.gc-tryon-label')).toHaveTextContent('Try it on');
    expect(button.style.getPropertyValue('--gc-bg')).toBe('#112233');
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
    pageFetch.mockResolvedValueOnce(json({ items: [{ variant_title: 'L' }] })).mockResolvedValueOnce(json({ item_count: 1 }));
    const replies = vi.spyOn(frame.contentWindow!, 'postMessage');
    message(APP, frame.contentWindow, { type: 'grindctrl-tryon:add-to-cart', variantId: '88' });
    await vi.waitFor(() => expect(replies).toHaveBeenCalledWith({ type: 'grindctrl-tryon:cart-result', ok: true, variantTitle: 'L' }, APP));
    expect(JSON.parse(String(pageFetch.mock.calls[2][1]?.body))).toEqual({ items: [{ id: 88, quantity: 1 }] });
  });
  it('a website look returns to the product instead of adding to a cart', async () => {
    document.body.innerHTML = '<div data-grindctrl-tryon data-product-id="42" data-title="Tagged" data-image="https://images.example/tag.jpg"></div>';
    pageFetch.mockResolvedValueOnce(json({ context: { expiresAt: later() }, embedUrl: `${APP}/embed/try-on?product=42` }));
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
    expect(pageFetch).toHaveBeenCalledTimes(1);
  });
  it.each(['out_of_looks', 'paused'])('removes the button when the store cannot start a look (%s)', async (code) => {
    shopifyPage();
    pageFetch.mockResolvedValueOnce(json(shopifyProduct)).mockResolvedValueOnce(json({ error: code }, 409));
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
    pageFetch.mockResolvedValueOnce(json(shopifyProduct));
    const a = adapter('shopify');
    await a.prepare();
    mount(a);
    expect(document.querySelectorAll('.gc-tryon-btn')).toHaveLength(1);
    (document.querySelector('.gc-tryon-btn') as HTMLButtonElement).click();
    await tick();
    expect(document.querySelector('.gc-tryon-sheet')).toBeNull();
    expect(pageFetch).toHaveBeenCalledTimes(1);
  });
});

describe("the pasted product button waits for the store's config", () => {
  const supports = { supports: (_property: string, value: string) => /^#[0-9a-f]{3,8}$/i.test(value) };
  function deferredConfig() {
    let release: (response: Response) => void = () => {};
    configFetch.mockImplementationOnce(() => new Promise<Response>((resolve) => { release = resolve; }));
    return (response: Response) => release(response);
  }
  async function boot(a: Adapter) {
    if (await a.prepare()) mount(a);
    return document.querySelector<HTMLButtonElement>('.gc-tryon-btn');
  }

  it.each(['shopify', 'website'])("adds nothing before the config answers, then the %s button in the owner's design from its first paint", async (platform) => {
    vi.stubGlobal('CSS', supports);
    if (platform === 'shopify') {
      shopifyPage();
      pageFetch.mockResolvedValueOnce(json(shopifyProduct));
    } else {
      document.body.innerHTML = '<div data-grindctrl-tryon data-product-id="42" data-title="Tagged" data-image="https://images.example/tag.jpg"></div>';
    }
    const release = deferredConfig();
    // What the button looked like at the moment it went into the page.
    let atInsert: { label: string | null; vars: string[]; children: string[] } | null = null;
    const insert = Element.prototype.insertAdjacentElement;
    vi.spyOn(Element.prototype, 'insertAdjacentElement').mockImplementation(function (this: Element, position, element) {
      if (element instanceof HTMLButtonElement && element.matches('.gc-tryon-btn')) {
        atInsert = { label: element.querySelector('.gc-tryon-label')?.textContent ?? null,
          vars: ['--gc-bg', '--gc-fg', '--gc-radius', '--gc-ic-from', '--gc-ic-to', '--gc-ic-size'].map((name) => element.style.getPropertyValue(name)),
          children: [...element.children].map((child) => child.className) };
      }
      return insert.call(this, position, element);
    });
    const a = adapter(platform);
    const booted = boot(a);
    await tick();
    expect(configFetch).toHaveBeenCalledOnce();
    if (platform === 'shopify') expect(pageFetch).toHaveBeenCalledOnce(); // in parallel with the product
    expect(document.querySelector('.gc-tryon-btn')).toBeNull();

    release(json(LIVE_CONFIG));
    const button = await booted;
    expect(atInsert).toEqual({ label: 'Try it on', vars: ['#112233', '#ffeedd', '6px', '#000000', '#ffffff', '32px'], children: ['gc-tryon-ic', 'gc-tryon-label'] });
    expect([...button!.children].map((child) => child.className)).toEqual(['gc-tryon-ic', 'gc-tryon-label', 'gc-tryon-ready']);
    const params = new URL(String(configFetch.mock.calls[0][0])).searchParams;
    expect(Object.fromEntries(params)).toEqual({ key: 'embed-key', locale: 'en', vid: 'shared-visitor-123456', preview: 'signed-preview-token' });
    expect(configFetch.mock.calls[0][1]?.credentials).toBe('omit');
  });

  it.each(['shopify', 'website'])('adds no %s button when the config says Try-On is hidden for this visitor', async (platform) => {
    if (platform === 'shopify') {
      shopifyPage();
      pageFetch.mockResolvedValueOnce(json(shopifyProduct));
    } else {
      document.body.innerHTML = '<div data-grindctrl-tryon data-product-id="42" data-title="Tagged" data-image="https://images.example/tag.jpg"></div>';
    }
    configFetch.mockResolvedValueOnce(json({ tryOn: 'hidden', reason: 'paused', showCardPill: false }));
    expect(await boot(adapter(platform))).toBeNull();
  });

  it.each([
    ['answers with an error', () => configFetch.mockResolvedValueOnce(json({ tryOn: 'hidden', reason: 'unavailable' }, 503))],
    ['cannot be reached', () => configFetch.mockRejectedValueOnce(new TypeError('offline'))],
  ])('keeps the default button when the config %s', async (_name, fail) => {
    vi.stubGlobal('CSS', supports);
    shopifyPage();
    pageFetch.mockResolvedValueOnce(json(shopifyProduct));
    fail();
    const button = await boot(adapter('shopify'));
    expect(button).not.toBeNull();
    expect(button!.querySelector('.gc-tryon-label')).toHaveTextContent('Try it on with AI');
    expect(button!.firstElementChild).toHaveClass('gc-tryon-ic');
    expect(button!.style.getPropertyValue('--gc-bg')).toBe('');
    expect(button!.dataset.gcStyled).toBeUndefined();
  });

  it('adds no button when the product cannot be read, whatever the config says', async () => {
    shopifyPage();
    pageFetch.mockResolvedValueOnce(json({ ...shopifyProduct, id: 999 }));
    expect(await boot(adapter('shopify'))).toBeNull();
    expect(configFetch).toHaveBeenCalledOnce();
  });
});

describe('pasted WooCommerce cart', () => {
  function woo(variable = false) {
    const variations = [{ variation_id: 77, attributes: { attribute_pa_size: 'm' }, is_in_stock: true }];
    document.body.innerHTML = `<div data-grindctrl-tryon data-product-id="dress" data-title="Dress" data-image="https://images.example/dress.jpg"></div>
      <form class="cart ${variable ? 'variations_form' : ''}" data-product_id="42">
        <button class="single_add_to_cart_button" name="add-to-cart" value="42">Add to cart</button>
        ${variable ? '<input name="variation_id" value="77"><select name="attribute_pa_size"><option value="m">M</option></select>' : ''}</form>`;
    if (variable) document.querySelector('form')!.setAttribute('data-product_variations', JSON.stringify(variations));
    globals.wc_add_to_cart_params = { cart_url: '/cart/' };
    pageFetch.mockImplementation(async () => new Response('{}', { headers: { Nonce: 'fresh-nonce' } }));
    const a = adapter();
    const product = a.detectProduct()!;
    return { a, product };
  }
  it.each([false, true])('adds only this simple/variable product (%s) with a Store API nonce and quantity', async (variable) => {
    const { a, product } = woo(variable);
    const id = variable ? '77' : '42';
    expect(product.variantId).toBe(id);
    expect((await a.getProduct(product))?.variants.map((v) => v.id)).toEqual([id]);
    expect(await a.addToCart(id, 3, { product })).toMatchObject({ ok: true });
    expect(String(pageFetch.mock.calls[0][0])).toContain('/wp-json/wc/store/v1/cart');
    const init = pageFetch.mock.calls[1][1]!;
    expect(new Headers(init.headers).get('Nonce')).toBe('fresh-nonce');
    expect(JSON.parse(String(init.body))).toMatchObject({ id: Number(id), quantity: 3 });
    if (variable) expect(JSON.parse(String(init.body)).variation).toEqual([{ attribute: 'pa_size', value: 'm' }]);
  });
  it('refuses another product or variation and quantities outside 1–99 before fetching', async () => {
    const { a, product } = woo(true);
    for (const id of ['42', '999']) expect(await a.addToCart(id, 1, { product })).toEqual({ ok: false });
    for (const qty of [0, 100, -1, 1.5, NaN]) expect(await a.addToCart('77', qty, { product })).toEqual({ ok: false });
    expect(pageFetch).not.toHaveBeenCalled();
    expect(await a.addToCart('77', 99, { product })).toMatchObject({ ok: true });
  });
  it('keeps every non-Woo website unsupported regardless of its address', async () => {
    const { a, product } = woo();
    delete globals.wc_add_to_cart_params;
    document.querySelector('form')!.remove();
    window.history.replaceState({}, '', '/woocommerce/product/dress');
    expect(await a.addToCart('42', 1, { product })).toBe('unsupported');
    expect(await a.getProduct(product)).toBeNull();
    expect(pageFetch).not.toHaveBeenCalled();
  });
});

describe('messenger paste loading', () => {
  it.each(['website', 'shopify'])('loads no Try-On assets on non-product %s pages', async (platform) => {
    window.history.replaceState({}, '', '/pages/about');
    vi.spyOn(document, 'currentScript', 'get').mockReturnValue(snippet(platform));
    pageFetch.mockResolvedValue(json(null));
    (0, eval)(source('messenger'));
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await tick();
    expect(document.querySelector('script[src*="tryon-"]')).toBeNull();
    expect(globals.GRINDCTRL_MESSENGER).toBeDefined();
  });
  it('requests the versioned engine beside the adapter before config resolves, and mounts only after prepare', async () => {
    document.body.innerHTML = `<script type="application/ld+json">${JSON.stringify({ '@type': 'Product', sku: 'dress', image: 'https://images.example/d.jpg' })}</script>`;
    delete globals.GRINDCTRL_TRYON_PASTE;
    vi.spyOn(document, 'currentScript', 'get').mockReturnValue(snippet('website'));
    pageFetch.mockResolvedValue(json(null));
    (0, eval)(source('messenger'));
    document.dispatchEvent(new Event('DOMContentLoaded'));
    const scripts = [...document.querySelectorAll<HTMLScriptElement>('script[src*="tryon-"]')].map((node) => node.src);
    expect(scripts).toHaveLength(2);
    expect(scripts[0]).toMatch(/tryon-paste\.js\?v=[a-f0-9]{12}$/);
    expect(scripts[1]).toMatch(/tryon-engine\.js\?v=[a-f0-9]{12}$/);
    let finish = (_found: boolean) => {};
    const prepare = vi.fn(() => new Promise<boolean>((resolve) => { finish = resolve; }));
    const mount = vi.fn();
    globals.GRINDCTRL_TRYON_PASTE = { create: () => ({ prepare }) };
    globals.GRINDCTRL_TRYON_ENGINE = { mount };
    document.querySelector('script[src*="tryon-paste"]')!.dispatchEvent(new Event('load'));
    await tick();
    expect(prepare).toHaveBeenCalledOnce();
    expect(mount).not.toHaveBeenCalled();
    document.querySelector('script[src*="tryon-engine"]')!.dispatchEvent(new Event('load'));
    await tick();
    expect(mount).not.toHaveBeenCalled();
    finish(true);
    await tick();
    expect(mount).toHaveBeenCalledOnce();
    expect(pageFetch.mock.calls.some(([url]) => String(url).startsWith(`${APP}/api/messenger/config?key=embed-key`))).toBe(true);
  });
  it('chat boots even when product adapter loading fails', async () => {
    shopifyPage();
    delete globals.GRINDCTRL_TRYON_PASTE;
    vi.spyOn(document, 'currentScript', 'get').mockReturnValue(snippet('shopify'));
    pageFetch.mockResolvedValue(json(null));
    (0, eval)(source('messenger'));
    document.dispatchEvent(new Event('DOMContentLoaded'));
    const script = document.querySelector('script[src*="tryon-paste"]')!;
    expect(script).not.toBeNull();
    script.dispatchEvent(new Event('error'));
    await tick();
    expect(pageFetch.mock.calls.some(([url]) => String(url).includes('/api/messenger/config'))).toBe(true);
    expect(globals.GRINDCTRL_MESSENGER).toBeDefined();
  });
});
