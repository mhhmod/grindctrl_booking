// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* The "Try on" pill on product cards for pasted Shopify code: the paste
   adapter's card mode (tryon-paste.js) on the hosted engine (tryon-engine.js),
   against Dawn-like and generic grid markup. */

const source = (file: string) => readFileSync(`public/widget/v1/${file}.js`, 'utf8');
type Product = { id: string; variantId: string | null; title: string; imageUrl: string; card?: boolean };
type Adapter = {
  prepare: () => Promise<boolean>; injectCards: boolean; injectButton: boolean;
  detectProduct: (button?: Element) => Product | null;
  addToCart: (variant: string, qty: number, state?: { product: Product | null }) => Promise<unknown>;
};
type Paste = { create: (options: Record<string, unknown>) => Adapter };
const globals = window as unknown as Record<string, unknown>;
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const html = (body: string) => new Response(body, { status: 200, headers: { 'Content-Type': 'text/html' } });
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const listeners: Array<[EventTarget, string, EventListenerOrEventListenerObject, boolean | AddEventListenerOptions | undefined]> = [];
const observers: MutationObserver[] = [];
const APP = 'https://grindctrl.cloud';
const later = () => new Date(Date.now() + 120000).toISOString();

const CARDS = { site: 'site-id', shop: 'shop.myshopify.com', issuedAt: '123', customer: '', products: [
  { id: '501', variant: '601', handle: 'linen-abaya', title: 'Linen abaya &amp; scarf',
    image: '//shop.example/cdn/shop/files/abaya.jpg?v=1&amp;width=1200', signature: 'a'.repeat(64) },
  { id: '502', variant: '602', handle: 'silk-scarf', title: 'Silk scarf', image: 'https://cdn.shopify.com/s/files/scarf.jpg', signature: 'b'.repeat(64) },
  { id: '503', variant: '603', handle: 'cotton-shirt', title: 'Cotton shirt', image: 'https://cdn.shopify.com/s/files/shirt.jpg', signature: 'c'.repeat(64) },
] };
const block = (cards: unknown = CARDS) => `<script type="application/json" data-gc-cards="site-id">${JSON.stringify(cards)}</script>`;
const dawnCard = (handle: string, title: string) => `<li class="grid__item"><div class="card-wrapper product-card-wrapper"><div class="card">
  <div class="card__inner"><div class="card__media"><div class="media"><img src="https://cdn.shopify.com/${handle}.jpg" alt=""></div></div></div>
  <div class="card__content"><h3 class="card__heading"><a href="/products/${handle}" class="full-unstyled-link">${title}</a></h3></div></div></div></li>`;
const genericCard = (handle: string) => `<div class="product-item"><a href="/collections/sale/products/${handle}?variant=1">
  <img src="https://cdn.shopify.com/${handle}.jpg"></a><p>${handle}</p></div>`;
const LIVE = { tryOn: 'live', reason: null, showCardPill: true, catalogLabel: 'Try on', catalogIconPx: 16, catalogFontPx: 13,
  catalogPadPx: 7, accentBg: '#112233', accentFg: 'not a color', radiusPx: 8 };

function snippet() {
  const script = document.createElement('script');
  script.src = `${APP}/widget/v1/messenger.js`;
  Object.assign(script.dataset, { key: 'embed-key', gcInstall: 'paste', gcPlatform: 'shopify', gcV: '2', gcSite: 'site-id',
    gcShop: 'shop.myshopify.com', gcProduct: '', gcVariant: '', gcIssuedAt: '123', gcCustomer: '', gcSignature: '' });
  return script;
}
function listing(body: string, cards: unknown = CARDS) {
  window.history.replaceState({}, '', '/collections/all');
  document.body.innerHTML = `<main>${body}</main>${cards ? block(cards) : ''}`;
}
type Handler = (url: URL, init?: RequestInit) => Response | Promise<Response>;
function route(handlers: Record<string, Handler>) {
  vi.mocked(fetch).mockImplementation(async (input, init) => {
    const url = new URL(String(input), window.location.href);
    const handler = handlers[url.pathname];
    return handler ? handler(url, init) : json({}, 404);
  });
}
const calls = (pathname: string) => vi.mocked(fetch).mock.calls.filter(([input]) => new URL(String(input), window.location.href).pathname === pathname);
const contextBody = (n = 0) => JSON.parse(String(calls('/api/try-on/paste-context')[n][1]?.body));
const pills = () => [...document.querySelectorAll<HTMLButtonElement>('.gc-tryon-pill')];
const pillFor = (id: string) => document.querySelector<HTMLButtonElement>(`.gc-tryon-pill[data-product-id="${id}"]`)!;
const contextFor = (id: string) => ({ context: { expiresAt: later(), variantId: id }, embedUrl: `${APP}/embed/try-on?product=${id}&sheet=1#storefrontContext=proof` });

async function start(config: unknown = LIVE, handlers: Record<string, Handler> = {}) {
  route({ '/api/try-on/paste-config': () => json(config), '/collections/all': () => html('<html></html>'), ...handlers });
  const adapter = (globals.GRINDCTRL_TRYON_PASTE as Paste).create({ script: snippet(), appOrigin: APP, locale: 'en',
    visitorId: 'shared-visitor-123456', preview: '' });
  const found = await adapter.prepare();
  if (found) {
    (0, eval)(source('tryon-engine'));
    (globals.GRINDCTRL_TRYON_ENGINE as { mount: (a: Adapter) => void }).mount(adapter);
  }
  return { adapter, found };
}

beforeEach(() => {
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
  // jsdom has no CSS.supports; browsers do.
  vi.stubGlobal('CSS', { supports: (_property: string, value: string) => /^#[0-9a-f]{3,8}$/i.test(value) });
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  document.documentElement.lang = 'en';
  window.localStorage.clear();
  for (const key of ['GRINDCTRL_TRYON_PASTE', 'GRINDCTRL_TRYON_ENGINE', '__gcPasteTryOn', 'GRINDCTRL_MESSENGER', 'Shopify']) delete globals[key];
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({})));
  (0, eval)(source('tryon-paste'));
});
afterEach(() => {
  for (const [target, type, listener, options] of listeners.splice(0)) target.removeEventListener(type, listener, options);
  for (const observer of observers.splice(0)) observer.disconnect();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('card pills on a pasted-code listing', () => {
  it('adds one pill per signed card on Dawn and generic grids, styled from the catalog settings', async () => {
    listing(`<ul id="product-grid">${dawnCard('linen-abaya', 'Linen abaya')}${dawnCard('wool-coat', 'Wool coat')}</ul>
      <div class="products">${genericCard('silk-scarf')}</div>`);
    const { adapter, found } = await start();
    expect(found).toBe(true);
    expect(adapter.injectCards).toBe(true);
    expect(adapter.injectButton).toBe(false);
    const config = new URL(String(calls('/api/try-on/paste-config')[0][0]));
    expect(Object.fromEntries(config.searchParams)).toEqual({ key: 'embed-key', locale: 'en', vid: 'shared-visitor-123456' });
    expect(calls('/api/try-on/paste-config')[0][1]?.credentials).toBe('omit');

    expect(pills().map((pill) => pill.dataset.productId).sort()).toEqual(['501', '502']);
    // Dawn: in the image's own container. Generic: beside the product link, outside it.
    expect(pillFor('501').parentElement?.matches('.media')).toBe(true);
    expect(pillFor('502').parentElement?.matches('.product-item')).toBe(true);
    expect(pillFor('502').closest('a')).toBeNull();
    expect((pillFor('501').parentElement as HTMLElement).style.position).toBe('relative');
    // The same look as the Shopify app's catalog pill.
    const pill = pillFor('501');
    expect(pill.type).toBe('button');
    expect(pill.querySelector('.gc-tryon-label')).toHaveTextContent('Try on');
    expect(pill.textContent?.replace(/\s+/g, ' ').trim()).toBe('Try on Linen abaya & scarf');
    expect(pill.querySelector('.gc-tryon-pill__icon svg')).not.toBeNull();
    expect(pill.style.getPropertyValue('--gc-pill-font')).toBe('13px');
    expect(pill.style.getPropertyValue('--gc-pill-icon')).toBe('16px');
    expect(pill.style.getPropertyValue('--gc-pill-pad')).toBe('7px');
    expect(pill.style.getPropertyValue('--gc-pill-radius')).toBe('8px');
    expect(pill.style.getPropertyValue('--gc-pill-bg')).toBe('#112233');
    expect(pill.style.getPropertyValue('--gc-pill-fg')).toBe('');
    expect(document.getElementById('gc-tryon-woo-css')?.textContent).toContain('.gc-tryon-pill{position:absolute');
  });

  it('gives an unsigned card no pill, and never re-reads the address the page loaded with', async () => {
    // A collection longer than the signed cards: page 3 shows products the render could not sign.
    listing(`<ul>${dawnCard('wool-coat', 'Wool coat')}${dawnCard('linen-abaya', 'Linen abaya')}</ul>`);
    await start();
    await tick();
    expect(pills().map((pill) => pill.dataset.productId)).toEqual(['501']);
    document.querySelector('ul')!.insertAdjacentHTML('beforeend', dawnCard('linen-coat', 'Linen coat'));
    await wait(350);
    expect(calls('/collections/all')).toHaveLength(0);
    expect(pills()).toHaveLength(1);
  });

  it('signs cards the theme filtered in, from a fresh render of the new address', async () => {
    listing(`<ul>${dawnCard('linen-abaya', 'Linen abaya')}</ul>`);
    const filtered = { ...CARDS, issuedAt: '456', products: [{ id: '504', variant: '604', handle: 'wool-coat', title: 'Wool coat',
      image: 'https://cdn.shopify.com/s/files/coat.jpg', signature: 'd'.repeat(64) }] };
    await start(LIVE, { '/collections/all': () => html(`<html><body>${block(filtered)}</body></html>`) });
    window.history.replaceState({}, '', '/collections/all?filter.v.availability=1');
    document.querySelector('ul')!.innerHTML = dawnCard('wool-coat', 'Wool coat');
    await wait(350);
    await tick();
    await wait(350);
    expect(pills().map((pill) => pill.dataset.productId)).toEqual(['504']);
    const refresh = calls('/collections/all');
    expect(refresh).toHaveLength(1);
    const url = new URL(String(refresh[0][0]), window.location.href);
    expect(url.searchParams.get('filter.v.availability')).toBe('1');
    expect(url.searchParams.has('gc_render')).toBe(true);
    expect(refresh[0][1]?.credentials).toBe('same-origin');
    // Once per address: more unsigned cards there do not fetch it again.
    document.querySelector('ul')!.insertAdjacentHTML('beforeend', dawnCard('linen-coat', 'Linen coat'));
    await wait(350);
    expect(calls('/collections/all')).toHaveLength(1);
  });

  it('adds pills to cards that arrive later (infinite scroll), and never twice', async () => {
    listing(`<ul id="product-grid">${dawnCard('linen-abaya', 'Linen abaya')}</ul>`);
    await start();
    expect(pills()).toHaveLength(1);
    document.getElementById('product-grid')!.insertAdjacentHTML('beforeend', dawnCard('silk-scarf', 'Silk scarf') + dawnCard('cotton-shirt', 'Cotton shirt'));
    await wait(350);
    expect(pills().map((pill) => pill.dataset.productId)).toEqual(['501', '502', '503']);
    // Our own pills and unrelated markup do not trigger more work.
    document.body.insertAdjacentHTML('beforeend', '<div class="toast">Added</div>');
    await wait(350);
    expect(pills()).toHaveLength(3);
  });

  it('opens the sheet with the card\'s own signed product context', async () => {
    listing(`<ul>${dawnCard('linen-abaya', 'Linen abaya')}${dawnCard('silk-scarf', 'Silk scarf')}</ul>`);
    await start(LIVE, { '/api/try-on/paste-context': (_url, init) => json(contextFor(JSON.parse(String(init?.body)).productId)) });
    pillFor('501').click();
    await tick();
    await tick();
    expect(contextBody(0)).toMatchObject({
      key: 'embed-key', productId: '501', variantId: '601', title: 'Linen abaya & scarf', pageUrl: window.location.href, codeVersion: 2,
      imageUrl: `https://${window.location.hostname}/cdn/shop/files/abaya.jpg?v=1&width=1200`,
      signed: { siteId: 'site-id', shopDomain: 'shop.myshopify.com', productId: '501', variantId: '601', issuedAt: '123',
        customerId: '', signature: 'a'.repeat(64) },
    });
    const sheet = document.querySelector('.gc-tryon-sheet') as HTMLElement;
    expect(sheet.hidden).toBe(false);
    expect(sheet.getAttribute('aria-label')).toContain('Linen abaya');
    expect(sheet.querySelector('iframe')!.src).toContain('product=501');
    expect(new URL(sheet.querySelector('iframe')!.src).searchParams.get('selectedVariant')).toBe('601');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    pillFor('502').click();
    await tick();
    await tick();
    expect(contextBody(1)).toMatchObject({ productId: '502', variantId: '602', signed: { productId: '502', signature: 'b'.repeat(64) },
      imageUrl: 'https://cdn.shopify.com/s/files/scarf.jpg' });
  });

  it('reads a fresh signed render from the product page when the card render was used or went stale', async () => {
    listing(`<ul>${dawnCard('linen-abaya', 'Linen abaya')}</ul>`);
    const fresh = '<script async src="x" data-gc-install="paste" data-gc-platform="shopify" data-gc-site="site-id" data-gc-shop="shop.myshopify.com" data-gc-product="501" data-gc-variant="605" data-gc-issued-at="456" data-gc-customer="" data-gc-signature="fresh"></script>';
    let n = 0;
    await start(LIVE, {
      '/api/try-on/paste-context': () => (n++ === 0 ? json({ error: 'replayed' }, 409) : json(contextFor('501'))),
      '/products/linen-abaya': () => html(`<html><body>${fresh}</body></html>`),
    });
    pillFor('501').click();
    await vi.waitFor(() => expect(calls('/api/try-on/paste-context')).toHaveLength(2));
    expect(calls('/products/linen-abaya')).toHaveLength(1);
    expect(contextBody(1)).toMatchObject({ productId: '501', variantId: '605', signed: { variantId: '605', issuedAt: '456', signature: 'fresh' } });
  });

  it('takes every pill away when the store cannot start looks, but only one when that product cannot', async () => {
    listing(`<ul>${dawnCard('linen-abaya', 'Linen abaya')}${dawnCard('silk-scarf', 'Silk scarf')}${dawnCard('cotton-shirt', 'Cotton shirt')}</ul>`);
    await start(LIVE, { '/api/try-on/paste-context': (_url, init) => {
      const id = JSON.parse(String(init?.body)).productId;
      return id === '501' ? json({ error: 'garment_unsafe' }, 422) : json({ error: 'out_of_looks' }, 409);
    } });
    pillFor('501').click();
    await vi.waitFor(() => expect(pills().map((pill) => pill.dataset.productId)).toEqual(['502', '503']));
    expect(document.querySelector('.gc-tryon-sheet')).toBeNull();
    pillFor('502').click();
    await vi.waitFor(() => expect(pills()).toHaveLength(0));
    // And no pill comes back for later cards.
    document.querySelector('ul')!.insertAdjacentHTML('beforeend', dawnCard('linen-abaya', 'Linen abaya'));
    await wait(350);
    expect(pills()).toHaveLength(0);
  });

  it('adds only a variant of the card\'s own product to the cart', async () => {
    listing(`<ul>${dawnCard('linen-abaya', 'Linen abaya')}</ul>`);
    const { adapter } = await start(LIVE, {
      '/products/linen-abaya.js': () => json({ id: 501, title: 'Linen abaya', variants: [{ id: 601, title: 'M', available: false }, { id: 606, title: 'L', available: true }] }),
      '/cart/add.js': () => json({ items: [{ id: 606, variant_title: 'L' }] }),
      '/cart.js': () => json({ item_count: 1 }),
    });
    const product = adapter.detectProduct(pillFor('501'));
    expect(product).toMatchObject({ id: '501', variantId: '601', card: true });
    expect(await adapter.addToCart('999', 1, { product })).toEqual({ ok: false });
    expect(await adapter.addToCart('606', 1, { product })).toEqual({ ok: true, variantTitle: 'L' });
    expect(JSON.parse(String(calls('/cart/add.js')[0][1]?.body))).toEqual({ items: [{ id: 606, quantity: 1 }] });
    expect(window.location.pathname).toBe('/collections/all');
  });
});

describe('card pills stay off', () => {
  it.each([
    ['the card pill switch is off', { ...LIVE, showCardPill: false }],
    ['the main Try-On switch is off', { tryOn: 'hidden', reason: 'paused', showCardPill: false }],
    ['the store is in preview for this visitor', { tryOn: 'hidden', reason: 'preview', showCardPill: false }],
    ['the config cannot be read', null],
  ])('adds nothing when %s', async (_name, config) => {
    listing(`<ul>${dawnCard('linen-abaya', 'Linen abaya')}</ul>`);
    const { found } = await start(config ?? undefined, config ? {} : { '/api/try-on/paste-config': () => json({ error: 'unavailable' }, 503) });
    expect(found).toBe(false);
    expect(pills()).toHaveLength(0);
  });

  it('asks nothing of the server on a listing whose code printed no signed cards, or another site\'s', async () => {
    listing(`<ul>${dawnCard('linen-abaya', 'Linen abaya')}</ul>`, null);
    expect((await start()).found).toBe(false);
    listing(`<ul>${dawnCard('linen-abaya', 'Linen abaya')}</ul>`, { ...CARDS, site: 'other-site' });
    expect((await start()).found).toBe(false);
    expect(calls('/api/try-on/paste-config')).toHaveLength(0);
  });

  it('leaves the cards to the Shopify app when its catalog embed runs on the page', async () => {
    listing(`<ul>${dawnCard('linen-abaya', 'Linen abaya')}</ul>`);
    document.head.insertAdjacentHTML('beforeend', '<style id="gc-cat-styles"></style>');
    await start();
    expect(pills()).toHaveLength(0);
  });
});

describe('messenger on a pasted-code listing', () => {
  it('loads the versioned paste adapter only when the snippet printed signed cards', async () => {
    window.history.replaceState({}, '', '/collections/all');
    document.body.innerHTML = `<ul>${dawnCard('linen-abaya', 'Linen abaya')}</ul>${block()}`;
    delete globals.GRINDCTRL_TRYON_PASTE;
    vi.spyOn(document, 'currentScript', 'get').mockReturnValue(snippet());
    vi.mocked(fetch).mockResolvedValue(json(null));
    (0, eval)(source('messenger'));
    document.dispatchEvent(new Event('DOMContentLoaded'));
    const scripts = [...document.querySelectorAll<HTMLScriptElement>('script[src*="tryon-"]')].map((node) => node.src);
    expect(scripts).toEqual([`${APP}/widget/v1/tryon-paste.js?v=1.2.0`]);
  });
});
