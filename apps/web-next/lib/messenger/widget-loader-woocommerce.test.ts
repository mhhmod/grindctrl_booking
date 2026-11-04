// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { waitFor } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseCart } from '@/lib/messenger/cart';
import { parsePageProduct } from '@/components/messenger/v16/page-product';

/* Store Chat on a WooCommerce store: the GRINDCTRL plugin prints
   window.grindctrlWoo, and the loader reads the product from it and the
   cart from the store's own Store API, in the same shapes the panel takes
   from a Shopify store. */
const loader = readFileSync(path.resolve(process.cwd(), 'public/widget/v1/messenger.js'), 'utf8');

const config = {
  v: 1,
  key: 'gc_aaaaaaaa_bbbbbbbb_cccccccc',
  storeName: 'Dar Layla',
  active: true,
  available: true,
  aiEnabled: true,
  attachmentsEnabled: false,
  features: ['v16_chat'],
  team: null,
  appearance: {
    position: 'bottom-right',
    accentColor: '#222222',
    launcherIcon: 'chat',
    launcherLabel: { en: 'Chat', ar: 'محادثة' },
    launcherSizePx: 56,
    radiusStyle: 'soft',
    languageMode: 'en',
  },
  behaviour: {
    greetingEnabled: false,
    greetingDelaySeconds: 0,
    greeting: { en: 'Hi', ar: 'مرحبا' },
    proactiveEnabled: false,
    targetingMode: 'all',
    excludePatterns: [],
  },
};

const storeCart = {
  items: [
    {
      id: 72,
      name: 'Layla Abaya - Black, M',
      quantity: 2,
      permalink: 'https://dar-layla.test/product/layla-abaya/?attribute_pa_size=m',
      // A store set to 3 decimals: 1250.000 EGP each.
      prices: { price: '1250000', currency_code: 'EGP', currency_minor_unit: 3 },
    },
  ],
  totals: { total_price: '2500000', currency_code: 'EGP', currency_minor_unit: 3 },
};

let fetchMock: ReturnType<typeof vi.fn>;

function boot() {
  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/api/messenger/config')) return new Response(JSON.stringify(config), { status: 200 });
    if (url === `${window.location.origin}/wp-json/wc/store/v1/cart`) return new Response(JSON.stringify(storeCart), { status: 200 });
    return new Response('{}', { status: 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
  const script = document.createElement('script');
  script.setAttribute('data-key', config.key);
  script.setAttribute('data-app-origin', 'https://grindctrl.cloud');
  Object.defineProperty(document, 'currentScript', { value: script, configurable: true });
  window.eval(loader);
}

async function openPanel() {
  const host = () => Array.from(document.body.children).find((el) => (el as HTMLElement).shadowRoot) as HTMLElement | undefined;
  await waitFor(() => expect(host()?.shadowRoot?.querySelector('button.btn')).toBeTruthy());
  host()!.shadowRoot!.querySelector<HTMLButtonElement>('button.btn')!.click();
  await waitFor(() => expect(document.querySelector('iframe')).not.toBeNull());
  return document.querySelector('iframe')!;
}

function messagesOfType(spy: { mock: { calls: unknown[][] } }, type: string) {
  return spy.mock.calls.map((call) => call[0] as { type: string }).filter((message) => message.type === type);
}

describe('Store Chat on a WooCommerce store', () => {
  beforeEach(() => {
    document.body.innerHTML = '<main id="theme"></main>';
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.history.replaceState(null, '', '/product/layla-abaya/');
    delete (window as { GRINDCTRL_MESSENGER?: unknown }).GRINDCTRL_MESSENGER;
    vi.stubGlobal('requestIdleCallback', vi.fn());
    Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true });
    (window as { grindctrlWoo?: unknown }).grindctrlWoo = {
      platform: 'woocommerce',
      product: {
        id: 70,
        type: 'variable',
        name: 'Layla Abaya',
        url: 'https://dar-layla.test/product/layla-abaya/',
        image: 'https://dar-layla.test/wp-content/uploads/layla.jpg',
        price: '1250',
        currency: 'EGP',
        variations: [
          { id: 71, attributes: { attribute_pa_size: 's' }, image: null, price: '1250', in_stock: true },
          { id: 72, attributes: { attribute_pa_size: 'm' }, image: 'https://dar-layla.test/wp-content/uploads/layla-m.jpg', price: '1300.5', in_stock: true },
        ],
      },
      storeApi: `${window.location.origin}/wp-json/wc/store/v1/`,
      cartUrl: '/cart/',
      checkoutUrl: '/checkout/',
    };
  });

  afterEach(() => {
    (window as { GRINDCTRL_MESSENGER?: { close?: () => void } }).GRINDCTRL_MESSENGER?.close?.();
    delete (window as { grindctrlWoo?: unknown }).grindctrlWoo;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('hands the panel the product and the variation picked in the store form', async () => {
    document.body.insertAdjacentHTML(
      'beforeend',
      '<form class="variations_form cart"><input type="hidden" name="variation_id" value="72"></form>',
    );
    boot();
    const frame = await openPanel();
    const posted = vi.spyOn(frame.contentWindow!, 'postMessage');
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'grindctrl-messenger:ready' }, source: frame.contentWindow }));

    await waitFor(() => expect(messagesOfType(posted, 'grindctrl-messenger:page-product')).toHaveLength(1));
    const [message] = messagesOfType(posted, 'grindctrl-messenger:page-product') as unknown as Array<{ product: unknown }>;
    expect(parsePageProduct(message.product)).toEqual({
      handle: 'layla-abaya',
      title: 'Layla Abaya',
      imageUrl: 'https://dar-layla.test/wp-content/uploads/layla-m.jpg',
      variantId: '72',
      variantTitle: 'm',
      priceMinor: 130050,
      currency: 'EGP',
      tryOn: false,
    });
    expect(posted).toHaveBeenCalledWith(expect.anything(), 'https://grindctrl.cloud');
  });

  it("reads the cart from the store's Store API in the cart contract's units", async () => {
    boot();
    const frame = await openPanel();
    const posted = vi.spyOn(frame.contentWindow!, 'postMessage');
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'grindctrl-messenger:cart-request' }, source: frame.contentWindow }));

    await waitFor(() => expect(messagesOfType(posted, 'grindctrl-messenger:cart')).toHaveLength(1));
    const [message] = messagesOfType(posted, 'grindctrl-messenger:cart') as unknown as Array<{ cart: unknown }>;
    expect(parseCart(message.cart)).toEqual({
      totalMinor: 250000,
      currency: 'EGP',
      items: [{ handle: 'layla-abaya', variantId: '72', title: 'Layla Abaya - Black, M', quantity: 2, priceMinor: 125000 }],
    });
  });

  it('never reads a Store API root on another origin', async () => {
    (window as { grindctrlWoo?: { storeApi?: string } }).grindctrlWoo!.storeApi = 'https://elsewhere.example/wp-json/wc/store/v1/';
    boot();
    const frame = await openPanel();
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'grindctrl-messenger:cart-request' }, source: frame.contentWindow }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetchMock.mock.calls.map((call) => String(call[0])).some((url) => url.includes('elsewhere.example'))).toBe(false);
  });
});
