// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fireEvent, waitFor } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const assets = {
  shopify: readFileSync(path.resolve(process.cwd(), '../grindctrl-tryon/extensions/tryon-block/assets/tryon.js'), 'utf8'),
  woo: readFileSync(path.resolve(process.cwd(), 'public/widget/v1/tryon-woo.js'), 'utf8'),
};
type Platform = keyof typeof assets;
const listeners: Array<[EventTarget, string, EventListenerOrEventListenerObject]> = [];
let visible: (() => void) | undefined;
let now: number;
let contexts: number;

function message(frame: HTMLIFrameElement, productId: string, state: string, origin = 'https://grindctrl.cloud', expiresAt?: number, all?: boolean) {
  window.dispatchEvent(new MessageEvent('message', {
    origin, source: frame.contentWindow, data: { type: 'grindctrl-tryon:look', productId, state, expiresAt, all },
  }));
}

async function boot(platform: Platform, locale = 'en', connection: object = {}) {
  // A later visit gets a new document and runtime, but keeps device storage.
  for (const [target, type, listener] of listeners.splice(0)) target.removeEventListener(type, listener);
  visible = undefined;
  document.documentElement.style.overflow = '';
  Object.defineProperty(navigator, 'connection', { configurable: true, value: connection });
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) { visible = () => callback([{ isIntersecting: true }]); }
    observe() {}
    disconnect() {}
  });
  document.body.innerHTML = platform === 'shopify'
    ? `<main><div class="gc-tryon-root gc-tryon-root--pending" data-product="tee" data-variant="123" data-title="Tee" data-shop="demo.myshopify.com" data-garment="https://cdn.shopify.com/tee.jpg" data-locale="${locale}"><button type="button" class="gc-tryon-btn"><span class="gc-tryon-label">Try it on</span></button></div></main>`
    : '<main><button type="button" class="gc-tryon-btn" data-product-id="42" data-product-type="simple">Try it on</button></main>';
  (window as unknown as Record<string, unknown>).grindctrlTryOn = { restUrl: '/wp-json/grindctrl/v1/', storeApi: '/wp-json/wc/store/v1/', locale };
  delete (window as unknown as Record<string, unknown>).__grindctrlTryOnWoo;
  delete (window as unknown as Record<string, unknown>).GRINDCTRL_TRYON_ENGINE;
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
    const url = String(input);
    if (url.includes('/config?')) return new Response(JSON.stringify({ features: ['v16_tryon'], tryOn: 'live' }));
    if (url.includes('products/')) return new Response(JSON.stringify({ variants: [] }));
    contexts += 1;
    const expiresAt = new Date(now + 120000).toISOString();
    if (platform === 'shopify') {
      const nonce = new URL(url, 'https://shop.example').searchParams.get('nonce');
      return new Response(JSON.stringify({ token: 'signed', nonce, expiresAt }));
    }
    return new Response(JSON.stringify({ context: { expiresAt }, embedUrl: 'https://grindctrl.cloud/embed/try-on?product=woo-42&sheet=1#storefrontContext=signed&storefrontNonce=nonce' }));
  }));
  if (platform === 'woo') window.eval(readFileSync(path.resolve(process.cwd(), 'public/widget/v1/tryon-engine.js'), 'utf8'));
  window.eval(assets[platform]);
  if (platform === 'shopify') await waitFor(() => expect(document.querySelector('.gc-tryon-root--pending')).toBeNull());
  return { button: document.querySelector<HTMLButtonElement>('.gc-tryon-btn')!, product: platform === 'shopify' ? 'tee' : 'woo-42' };
}

async function loadedFrame() {
  await waitFor(() => expect(document.querySelector('iframe')?.getAttribute('src')).toContain('/embed/try-on?'));
  return document.querySelector<HTMLIFrameElement>('iframe')!;
}

beforeEach(() => {
  contexts = 0;
  visible = undefined;
  now = Date.now();
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  window.history.replaceState({}, '', '/products/tee');
  window.localStorage.clear();
  document.getElementById('gc-tryon-woo-css')?.remove();
  for (const target of [document, window] as EventTarget[]) {
    const add = target.addEventListener.bind(target);
    vi.spyOn(target, 'addEventListener').mockImplementation((type, listener, options) => {
      if (listener) listeners.push([target, type, listener]);
      add(type, listener, options);
    });
  }
});
afterEach(() => {
  for (const [target, type, listener] of listeners.splice(0)) target.removeEventListener(type, listener);
  document.body.innerHTML = '';
  document.documentElement.style.overflow = '';
  delete (navigator as Navigator & { connection?: object }).connection;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe.each<Platform>(['shopify', 'woo'])('%s storefront opening', (platform) => {
  it('opens a skeleton synchronously, keeps the iframe alive while closed, announces a ready look once and clears it when seen', async () => {
    const { button, product } = await boot(platform);
    fireEvent.click(button);
    expect(document.querySelector<HTMLElement>('.gc-tryon-sheet')?.hidden).toBe(false);
    expect(document.querySelector('[role="status"]')).toHaveTextContent('Opening try-on');
    const frame = await loadedFrame();
    fireEvent.load(frame);
    expect(document.querySelector<HTMLElement>('.gc-tryon-loading')?.hidden).toBe(true);
    fireEvent.click(document.querySelector('.gc-tryon-sheet__close')!);
    expect(frame.isConnected).toBe(true);
    message(frame, 'other-product', 'ready');
    message(frame, product, 'ready', 'https://evil.example');
    expect(button).toHaveTextContent('Try it on');
    message(frame, product, 'ready');
    expect(button).toHaveTextContent('See your look');
    expect(button.querySelector<HTMLElement>('.gc-tryon-ready')?.hidden).toBe(false);
    expect(document.querySelector('[aria-live="polite"]')).toHaveTextContent('Your look is ready');
    fireEvent.click(button);
    expect(document.querySelector('iframe')).toBe(frame);
    expect(button.querySelector<HTMLElement>('.gc-tryon-ready')?.hidden).toBe(true);
    expect(document.querySelector('[aria-live="polite"]')).toHaveTextContent('');
    message(frame, product, 'cleared');
    expect(button.querySelector('.gc-tryon-label')).toHaveTextContent('Try it on');
    expect(contexts).toBe(1);
  });

  it('prewarms only once and opens a stored look without an unread badge, in Arabic', async () => {
    const { button, product } = await boot(platform, 'ar');
    visible?.();
    const frame = await loadedFrame();
    visible?.();
    expect(document.querySelector<HTMLElement>('.gc-tryon-sheet')?.hidden).toBe(true);
    message(frame, product, 'stored');
    expect(button).toHaveTextContent('شاهد إطلالتك');
    expect(button.querySelector<HTMLElement>('.gc-tryon-ready')?.hidden).toBe(true);
    fireEvent.click(button);
    expect(document.querySelector('iframe')).toBe(frame);
    expect(document.querySelector('.gc-tryon-sheet')).toHaveAttribute('dir', 'rtl');
    message(frame, product, 'ready');
    expect(button.querySelector<HTMLElement>('.gc-tryon-ready')?.hidden).toBe(true);
    expect(contexts).toBe(1);
  });

  it('refreshes an expired prewarmed context at tap, then preserves the opened job across later expiry', async () => {
    const { button } = await boot(platform);
    visible?.();
    const old = await loadedFrame();
    now += 121000;
    fireEvent.click(button);
    const fresh = await loadedFrame();
    expect(fresh).not.toBe(old);
    expect(old.isConnected).toBe(false);
    expect(contexts).toBe(2);
    fireEvent.click(document.querySelector('.gc-tryon-sheet__close')!);
    now += 121000;
    fireEvent.click(button);
    expect(document.querySelector('iframe')).toBe(fresh);
    expect(contexts).toBe(2);
  });

  it('uses only a bounded expiry hint for a repeat visit on Save-Data and clears it when the embed reports no saved look', async () => {
    const { button, product } = await boot(platform);
    fireEvent.click(button);
    const frame = await loadedFrame();
    message(frame, product, 'ready', 'https://grindctrl.cloud', now + 86400000);
    const raw = window.localStorage.getItem('gc_tryon_look_hints_v1')!;
    expect(JSON.parse(raw)).toEqual([{ key: expect.any(String), expiresAt: now + 86400000 }]);
    expect(raw).not.toMatch(/image|photo|token|signed/);
    const visit = await boot(platform, 'en', { saveData: true });
    expect(visit.button).toHaveTextContent('See your look');
    expect(document.querySelector('iframe')).toBeNull();
    fireEvent.click(visit.button);
    const restored = await loadedFrame();
    message(restored, visit.product, 'cleared');
    expect(visit.button.querySelector('.gc-tryon-label')).toHaveTextContent('Try it on');
    expect(JSON.parse(window.localStorage.getItem('gc_tryon_look_hints_v1')!)).toEqual([]);
  });

  it('silently ignores expired, corrupt or unavailable hint storage', async () => {
    window.localStorage.setItem('gc_tryon_look_hints_v1', 'bad JSON');
    expect((await boot(platform, 'en', { saveData: true })).button).toHaveTextContent('Try it on');
    const key = platform === 'shopify' ? 'shopify:demo.myshopify.com:tee' : 'woo:/wp-json/grindctrl/v1/:woo-42';
    window.localStorage.setItem('gc_tryon_look_hints_v1', JSON.stringify([{ key, expiresAt: now - 1 }]));
    expect((await boot(platform, 'en', { saveData: true })).button).toHaveTextContent('Try it on');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect((await boot(platform, 'en', { saveData: true })).button).toHaveTextContent('Try it on');
  });

  it('caps metadata at five products and forgets all its hints without touching other store storage', async () => {
    const { button, product } = await boot(platform);
    fireEvent.click(button);
    const frame = await loadedFrame();
    const hints = Array.from({ length: 8 }, (_, index) => ({ key: `other-${index}`, expiresAt: now + 86400000 }));
    window.localStorage.setItem('gc_tryon_look_hints_v1', JSON.stringify(hints));
    window.localStorage.setItem('merchant-cart', 'keep');
    message(frame, product, 'ready', 'https://grindctrl.cloud', now + 86400000);
    expect(JSON.parse(window.localStorage.getItem('gc_tryon_look_hints_v1')!)).toHaveLength(5);
    message(frame, product, 'cleared', 'https://grindctrl.cloud', undefined, true);
    expect(window.localStorage.getItem('gc_tryon_look_hints_v1')).toBeNull();
    expect(window.localStorage.getItem('merchant-cart')).toBe('keep');
    expect(button.querySelector('.gc-tryon-label')).toHaveTextContent('Try it on');
  });

  it.each([{ saveData: true }, { effectiveType: '2g' }, { effectiveType: 'slow-2g' }])('skips prewarm for %j and still opens on tap', async (connection) => {
    const { button } = await boot(platform, 'en', connection);
    expect(visible).toBeUndefined();
    expect(contexts).toBe(0);
    expect(document.querySelector('iframe')).toBeNull();
    fireEvent.click(button);
    await loadedFrame();
    expect(contexts).toBe(1);
  });
});
