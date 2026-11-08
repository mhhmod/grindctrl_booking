// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* public/widget/v1/tryon-woo.js has no build step, so it is exercised the
   way a store runs it: evaluated against a product page. */
const SOURCE = readFileSync(path.join(process.cwd(), 'public/widget/v1/tryon-woo.js'), 'utf8');
const PLUGIN_SOURCE = readFileSync(path.resolve(process.cwd(), '../../integrations/woocommerce/grindctrl-store-chat/includes/tryon.php'), 'utf8');
const PREVIEW_CAPTURE = /<<<'JS'\r?\n([\s\S]*?)\r?\nJS;/.exec(PLUGIN_SOURCE)?.[1] ?? '';
const EMBED = 'https://grindctrl.cloud/embed/try-on?product=woo-42#storefrontContext=tok&storefrontNonce=nonce';

type FetchCall = { url: string; init: RequestInit };
let calls: FetchCall[];
let handler: (url: string, init: RequestInit) => Response | Promise<Response>;

function page(type: 'variable' | 'simple') {
  document.body.innerHTML = `
    <form class="variations_form cart">
      <select name="attribute_pa_size"><option value="">Choose</option><option value="m" selected>M</option></select>
      <input type="hidden" name="variation_id" value="0" />
      <button type="button" class="gc-tryon-btn" data-product-id="42" data-product-type="${type}" data-gc-page="1">Try it on</button>
    </form>
    <ul><li class="product"><button type="button" class="gc-tryon-btn gc-tryon-btn--card" data-product-id="43" data-product-type="variable">Card</button></li></ul>`;
}

function load(overrides: Record<string, unknown> = {}) {
  (window as unknown as { grindctrlTryOn: unknown }).grindctrlTryOn = {
    restUrl: 'https://shop.example.com/wp-json/grindctrl/v1/',
    storeApi: 'https://shop.example.com/wp-json/wc/store/v1/',
    storeApiNonce: 'stale',
    checkoutUrl: 'https://shop.example.com/checkout/',
    locale: 'en',
    ...overrides,
  };
  (0, eval)(readFileSync(path.join(process.cwd(), 'public/widget/v1/tryon-engine.js'), 'utf8'));
  (0, eval)(SOURCE);
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const click = (selector: string) => (document.querySelector(selector) as HTMLElement).click();

const listeners: Array<[EventTarget, string, EventListenerOrEventListenerObject]> = [];

beforeEach(() => {
  window.history.replaceState({}, '', '/');
  window.localStorage.clear();
  // The script binds document and window listeners on load; drop them per test.
  for (const target of [document, window] as EventTarget[]) {
    const add = target.addEventListener.bind(target);
    vi.spyOn(target, 'addEventListener').mockImplementation((type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) => {
      if (listener) listeners.push([target, type, listener]);
      add(type, listener, options);
    });
  }
  calls = [];
  handler = () => json({ embedUrl: EMBED });
  delete (window as unknown as Record<string, unknown>).__grindctrlTryOnWoo;
  delete (window as unknown as Record<string, unknown>).GRINDCTRL_TRYON_ENGINE;
  document.getElementById('gc-tryon-woo-css')?.remove();
  vi.stubGlobal('fetch', (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    return Promise.resolve(handler(url, init));
  });
});
afterEach(() => {
  for (const [target, type, listener] of listeners.splice(0)) target.removeEventListener(type, listener);
  vi.restoreAllMocks();
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

describe('tryon-woo.js', () => {
  it('asks the plugin route for a context with the picked variation and opens the embed in a sheet', async () => {
    page('variable');
    load();
    (document.querySelector('[name="variation_id"]') as HTMLInputElement).value = '77';
    click('form .gc-tryon-btn');
    await tick();

    expect(calls[0].url).toBe('https://shop.example.com/wp-json/grindctrl/v1/tryon-context');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ product_id: 42, variation_id: 77 });
    expect(calls[0].init.credentials).toBe('same-origin');
    const frame = document.querySelector('.gc-tryon-sheet iframe') as HTMLIFrameElement;
    const frameUrl = new URL(frame.src);
    expect(Number(frameUrl.searchParams.get('gc_opened_at'))).toBeGreaterThan(0);
    frameUrl.searchParams.delete('gc_opened_at');
    expect(frameUrl.href).toBe(EMBED);
    expect(document.querySelector('.gc-tryon-sheet')).toHaveAttribute('role', 'dialog');
    expect(document.querySelector('.gc-tryon-sheet__close')).toHaveAttribute('aria-label', 'Close');
  });

  it('forwards the preview link token and keeps it for navigation to a product page', async () => {
    const token = 'test-signed-preview-token.value';
    window.history.replaceState({}, '', `/?gc_preview=${token}`);
    page('simple');
    load();
    window.history.replaceState({}, '', '/product/tee');
    click('form .gc-tryon-btn');
    await tick();
    expect(JSON.parse(String(calls[0].init.body))).toMatchObject({ preview: token });
  });

  it('reveals the exhausted store test entry only for a preview token', () => {
    page('simple');
    const button = document.querySelector('form .gc-tryon-btn') as HTMLButtonElement;
    button.classList.add('gc-tryon-btn--preview');
    button.style.display = 'none';
    load();
    expect(button).toHaveClass('gc-tryon-btn--preview');
    expect(button.style.display).toBe('none');
    expect(calls).toHaveLength(0);
  });

  it('remembers the home-page preview link even when no storefront loader is present there', async () => {
    const token = 'test-signed-preview-token.value';
    window.history.replaceState({}, '', `/?gc_preview=${token}`);
    expect(PREVIEW_CAPTURE).not.toBe('');
    (0, eval)(PREVIEW_CAPTURE);
    window.history.replaceState({}, '', '/product/tee');
    page('simple');
    load();
    click('form .gc-tryon-btn');
    await tick();
    expect(JSON.parse(String(calls[0].init.body))).toMatchObject({ preview: token });
  });

  it('reveals the exhausted store test entry from a saved preview token', () => {
    page('simple');
    const button = document.querySelector('form .gc-tryon-btn') as HTMLButtonElement;
    button.classList.add('gc-tryon-btn--preview');
    button.style.display = 'none';
    window.localStorage.setItem('gc_preview', JSON.stringify({ token: 'test-signed-preview-token.value', savedAt: Date.now() }));
    load();
    expect(button).not.toHaveClass('gc-tryon-btn--preview');
    expect(button.style.display).toBe('');
  });

  it('forwards the preview token when the test sheet asks for public size options', async () => {
    page('simple');
    const token = 'test-signed-preview-token.value';
    window.localStorage.setItem('gc_preview', JSON.stringify({ token, savedAt: Date.now() }));
    load();
    click('form .gc-tryon-btn');
    await tick();
    const frame = document.querySelector('iframe') as HTMLIFrameElement;
    handler = () => json({ product: { options: [], variants: [] } });
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'grindctrl-tryon:product-request' }, origin: 'https://grindctrl.cloud', source: frame.contentWindow }));
    await tick();
    expect(new URL(calls.at(-1)!.url).searchParams.get('preview')).toBe(token);
  });

  it('does not forward an expired saved preview token', async () => {
    page('simple');
    window.localStorage.setItem('gc_preview', JSON.stringify({ token: 'test-signed-preview-token.value', savedAt: Date.now() - 24 * 60 * 60 * 1000 }));
    load();
    click('form .gc-tryon-btn');
    await tick();
    expect(JSON.parse(String(calls[0].init.body))).not.toHaveProperty('preview');
  });

  it('opens a variable product without a choice, using the product image', async () => {
    page('variable');
    load();
    click('form .gc-tryon-btn');
    await tick();
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ product_id: 42, variation_id: 0 });
    expect(document.querySelector('.gc-tryon-note')).toBeNull();
    expect(document.querySelector('.gc-tryon-sheet iframe')).not.toBeNull();
  });

  it('asks for a size in the sheet when nothing was chosen at add to cart', async () => {
    page('variable');
    load();
    click('form .gc-tryon-btn');
    await tick();
    const frame = document.querySelector('.gc-tryon-sheet iframe') as HTMLIFrameElement;
    const posted = vi.spyOn(frame.contentWindow!, 'postMessage').mockImplementation(() => {});
    window.dispatchEvent(new MessageEvent('message', {
      data: { type: 'grindctrl-tryon:add-to-cart' }, origin: 'https://grindctrl.cloud', source: frame.contentWindow,
    }));
    await tick();
    expect(calls.some((call) => call.url.endsWith('cart/add-item'))).toBe(false);
    expect(posted).toHaveBeenCalledWith(
      { type: 'grindctrl-tryon:cart-result', ok: false, message: 'Choose a size above, then add it to the cart.' },
      'https://grindctrl.cloud',
    );
  });

  it('does not read the product page form for a catalog card', async () => {
    page('variable');
    load();
    (document.querySelector('[name="variation_id"]') as HTMLInputElement).value = '77';
    click('.gc-tryon-btn--card');
    await tick();
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ product_id: 43, variation_id: 0 });
  });

  it('answers the sheet product request and adds only a chosen variation of that product', async () => {
    page('variable');
    load();
    (document.querySelector('[name="variation_id"]') as HTMLInputElement).value = '77';
    click('form .gc-tryon-btn');
    await tick();
    const frame = document.querySelector('.gc-tryon-sheet iframe') as HTMLIFrameElement;
    const posted = vi.spyOn(frame.contentWindow!, 'postMessage').mockImplementation(() => {});
    const product = {
      options: ['Size'], currency: 'EGP', variants: [
        { id: 77, title: 'M', options: ['M'], available: true, price: 32500, attributes: [{ attribute: 'pa_size', value: 'm' }] },
        { id: 78, title: 'L', options: ['L'], available: true, price: 32500, attributes: [{ attribute: 'pa_size', value: 'l' }] },
      ],
    };
    handler = (url) => url.includes('tryon-product') ? json({ product }) : json({ items: [] });
    const send = (data: unknown) => window.dispatchEvent(new MessageEvent('message', {
      data, origin: 'https://grindctrl.cloud', source: frame.contentWindow,
    }));
    send({ type: 'grindctrl-tryon:product-request' });
    await tick();
    expect(posted).toHaveBeenCalledWith({ type: 'grindctrl-tryon:product', product, variant: 77 }, 'https://grindctrl.cloud');
    send({ type: 'grindctrl-tryon:add-to-cart', variantId: '78' });
    await tick();
    expect(JSON.parse(String(calls.at(-1)!.init.body))).toEqual({ id: 78, quantity: 1, variation: [{ attribute: 'pa_size', value: 'l' }] });
    const adds = calls.filter((call) => call.url.endsWith('cart/add-item')).length;
    send({ type: 'grindctrl-tryon:add-to-cart', variantId: '999' });
    await tick();
    expect(calls.filter((call) => call.url.endsWith('cart/add-item'))).toHaveLength(adds);
    expect(posted).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'grindctrl-tryon:cart-result', ok: false }), 'https://grindctrl.cloud');
  });

  it('keeps plain REST query routes intact when loading product options', async () => {
    page('simple');
    load({ restUrl: 'https://shop.example.com/?rest_route=/grindctrl/v1/', storeApi: 'https://shop.example.com/?rest_route=/wc/store/v1/' });
    click('form .gc-tryon-btn');
    await tick();
    const frame = document.querySelector('iframe') as HTMLIFrameElement;
    handler = () => json({ product: { options: [], variants: [] } });
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'grindctrl-tryon:product-request' }, origin: 'https://grindctrl.cloud', source: frame.contentWindow }));
    await tick();
    const url = new URL(calls.at(-1)!.url);
    expect(url.searchParams.get('rest_route')).toBe('/grindctrl/v1/tryon-product');
    expect(url.searchParams.get('product_id')).toBe('42');
  });

  it.each(['out_of_looks', 'paused'])('removes the button when the store cannot start a look now (%s)', async (code) => {
    page('simple');
    load();
    handler = () => json({ error: code }, 409);
    click('form .gc-tryon-btn');
    await tick();
    expect(document.querySelector('form .gc-tryon-btn')).toBeNull();
    expect(document.querySelector('.gc-tryon-sheet')).toBeNull();
  });

  it('shows a retry when the context is unavailable and refuses an embed that is not https', async () => {
    page('simple');
    load();
    handler = () => json({ embedUrl: 'http://grindctrl.cloud/embed/try-on' });
    click('form .gc-tryon-btn');
    await tick();
    expect(document.querySelector('.gc-tryon-note')).toHaveTextContent('could not be started');
    expect(document.querySelector('.gc-tryon-sheet')).toBeNull();
  });

  it('adds the tried variation through the Store API, refreshes a stale nonce once, and tells the embed', async () => {
    page('variable');
    load();
    (document.querySelector('[name="variation_id"]') as HTMLInputElement).value = '77';
    click('form .gc-tryon-btn');
    await tick();
    const frame = document.querySelector('.gc-tryon-sheet iframe') as HTMLIFrameElement;
    const posted = vi.spyOn(frame.contentWindow!, 'postMessage').mockImplementation(() => {});
    let adds = 0;
    handler = (url) => {
      if (url.endsWith('cart/add-item')) return ++adds === 1 ? json({ message: 'nonce' }, 403) : json({ items: [] });
      return json({}, 200, { Nonce: 'fresh' });
    };

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'grindctrl-tryon:add-to-cart' },
        origin: 'https://grindctrl.cloud',
        source: frame.contentWindow,
      }),
    );
    await tick();
    await tick();
    await tick();

    const adding = calls.filter((call) => call.url.endsWith('cart/add-item'));
    expect(adding).toHaveLength(2);
    expect(new Headers(adding[0].init.headers).get('Nonce')).toBe('stale');
    expect(new Headers(adding[1].init.headers).get('Nonce')).toBe('fresh');
    expect(JSON.parse(String(adding[1].init.body))).toEqual({
      id: 77,
      quantity: 1,
      variation: [{ attribute: 'pa_size', value: 'm' }],
    });
    expect(posted).toHaveBeenCalledWith({ type: 'grindctrl-tryon:cart-result', ok: true, variantTitle: '' }, 'https://grindctrl.cloud');
  });

  it('ignores messages from other windows or origins', async () => {
    page('simple');
    load();
    click('form .gc-tryon-btn');
    await tick();
    const frame = document.querySelector('.gc-tryon-sheet iframe') as HTMLIFrameElement;
    handler = () => json({ items: [] });
    const before = calls.length;
    window.dispatchEvent(
      new MessageEvent('message', { data: { type: 'grindctrl-tryon:add-to-cart' }, origin: 'https://evil.test', source: frame.contentWindow }),
    );
    window.dispatchEvent(
      new MessageEvent('message', { data: { type: 'grindctrl-tryon:add-to-cart' }, origin: 'https://grindctrl.cloud', source: window }),
    );
    await tick();
    expect(calls.length).toBe(before);
  });

  it('answers a failed add with the store message as plain text', async () => {
    page('simple');
    load();
    click('form .gc-tryon-btn');
    await tick();
    const frame = document.querySelector('.gc-tryon-sheet iframe') as HTMLIFrameElement;
    const posted = vi.spyOn(frame.contentWindow!, 'postMessage').mockImplementation(() => {});
    handler = () => json({ message: '<b>Out</b> of stock' }, 400);
    window.dispatchEvent(
      new MessageEvent('message', { data: { type: 'grindctrl-tryon:add-to-cart' }, origin: 'https://grindctrl.cloud', source: frame.contentWindow }),
    );
    await tick();
    await tick();
    expect(posted).toHaveBeenCalledWith(
      { type: 'grindctrl-tryon:cart-result', ok: false, message: 'Out of stock' },
      'https://grindctrl.cloud',
    );
  });

  it('uses Arabic copy and right-to-left direction for an Arabic store', async () => {
    page('variable');
    load({ locale: 'ar' });
    (document.querySelector('[name="variation_id"]') as HTMLInputElement).value = '77';
    click('form .gc-tryon-btn');
    await tick();
    const sheet = document.querySelector('.gc-tryon-sheet') as HTMLElement;
    expect(sheet.dir).toBe('rtl');
    expect(sheet.querySelector('.gc-tryon-sheet__close')).toHaveAttribute('aria-label', 'إغلاق');
  });

  it('does nothing without the page settings', () => {
    document.body.innerHTML = '<button class="gc-tryon-btn" data-product-id="1">x</button>';
    delete (window as unknown as Record<string, unknown>).grindctrlTryOn;
    (0, eval)(SOURCE);
    click('.gc-tryon-btn');
    expect(calls).toHaveLength(0);
  });
});

describe('tryon-woo.js on the shared hosted engine', () => {
  function loadWithoutEngine() {
    (window as unknown as { grindctrlTryOn: unknown }).grindctrlTryOn = {
      restUrl: 'https://shop.example.com/wp-json/grindctrl/v1/', storeApi: 'https://shop.example.com/wp-json/wc/store/v1/', locale: 'en',
    };
    const current = document.createElement('script');
    current.src = 'https://grindctrl.cloud/widget/v1/tryon-woo.js';
    vi.spyOn(document, 'currentScript', 'get').mockReturnValue(current);
    (0, eval)(SOURCE);
    return document.querySelector('script[src*="tryon-engine"]') as HTMLScriptElement;
  }

  it('loads the versioned engine beside itself and mounts the Woo adapter once it arrives', async () => {
    page('simple');
    const engine = loadWithoutEngine();
    expect(engine.src).toBe('https://grindctrl.cloud/widget/v1/tryon-engine.js?v=1.2.0');
    click('form .gc-tryon-btn');
    expect(calls).toHaveLength(0);
    (0, eval)(readFileSync(path.join(process.cwd(), 'public/widget/v1/tryon-engine.js'), 'utf8'));
    engine.dispatchEvent(new Event('load'));
    click('form .gc-tryon-btn');
    await tick();
    expect(calls[0].url).toBe('https://shop.example.com/wp-json/grindctrl/v1/tryon-context');
    expect(document.querySelector('.gc-tryon-sheet iframe')).not.toBeNull();
  });

  it('takes its buttons away when the engine cannot load, instead of leaving them dead', () => {
    page('simple');
    loadWithoutEngine().dispatchEvent(new Event('error'));
    document.querySelectorAll<HTMLElement>('.gc-tryon-btn').forEach((button) => expect(button.style.display).toBe('none'));
  });

  it('does not pick up a paste-injected button on the same page', async () => {
    page('simple');
    document.body.insertAdjacentHTML('beforeend', '<button type="button" class="gc-tryon-btn" data-product-id="9" data-gc-paste="1">Paste</button>');
    load();
    click('[data-gc-paste]');
    await tick();
    expect(calls).toHaveLength(0);
  });
});
