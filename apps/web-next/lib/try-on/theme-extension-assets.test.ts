// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fireEvent, screen, waitFor } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const extensionRoot = path.resolve(
  process.cwd(),
  '../grindctrl-tryon/extensions/tryon-block/assets',
);
const productAsset = readFileSync(path.join(extensionRoot, 'tryon.js'), 'utf8');
const catalogAsset = readFileSync(path.join(extensionRoot, 'tryon-catalog.js'), 'utf8');

describe.each([
  ['product', productAsset],
  ['catalog', catalogAsset],
])('Shopify %s app origin', (surface, asset) => {
  afterEach(() => { document.body.innerHTML = ''; });

  it.each([
    [undefined, 'https://grindctrl.cloud'],
    ['', 'https://grindctrl.cloud'],
    ['https://shopify-m1-dev.grindctrl.cloud/path?ignored=1#fragment', 'https://shopify-m1-dev.grindctrl.cloud'],
    ['http://shopify-m1-dev.grindctrl.cloud', 'https://grindctrl.cloud'],
    ['garbage', 'https://grindctrl.cloud'],
    ['https://', 'https://grindctrl.cloud'],
  ])('resolves %s and uses %s for iframe and message traffic', async (configured, expected) => {
    // Each asset owns page listeners and observers, so give it its own window.
    const host = document.createElement('iframe');
    document.body.appendChild(host);
    const sandbox = host.contentWindow as Window & typeof globalThis;
    const doc = sandbox.document;
    doc.body.innerHTML = surface === 'product'
      ? `<div class="gc-tryon-root" data-product="tee" data-shop="demo.myshopify.com" data-variant="123">
          <button class="gc-tryon-btn">Try on</button>
        </div>`
      : '<ul><li class="grid__item"><a href="/products/tee"><img src="https://cdn.shopify.com/tee.jpg" alt="Tee"></a></li></ul>';
    const script = doc.createElement('script');
    script.dataset.gcShop = 'demo.myshopify.com';
    Object.defineProperty(doc, 'currentScript', { value: script, configurable: true });
    const config = surface === 'product' ? doc.querySelector<HTMLElement>('.gc-tryon-root')! : script;
    if (configured !== undefined) config.dataset.appOrigin = configured;
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'https://demo.myshopify.com');
      if (url.pathname.endsWith('/config')) return new Response(JSON.stringify({ tryOn: 'live' }));
      if (url.pathname.endsWith('/try-on-context')) {
        return new Response(JSON.stringify({ token: 'signed-context', nonce: url.searchParams.get('nonce') }));
      }
      return new Response('{}', { status: 403 });
    });
    sandbox.fetch = fetch;
    sandbox.eval(asset);
    const selector = surface === 'product' ? '.gc-tryon-btn' : '.gc-cat-btn';
    await waitFor(() => expect(doc.querySelector(selector)).not.toBeNull());
    fireEvent.click(doc.querySelector(selector)!);
    await waitFor(() => expect(doc.querySelector('iframe')).not.toBeNull());
    const frame = doc.querySelector('iframe')!;
    expect(new URL(frame.src).origin).toBe(expected);
    expect(new URL(frame.src).pathname).toBe('/embed/try-on');
    const postMessage = vi.spyOn(frame.contentWindow!, 'postMessage').mockImplementation(() => {});
    const callsBeforeMessage = fetch.mock.calls.length;
    const data = { type: 'grindctrl-tryon:add-to-cart' };
    const otherOrigin = expected === 'https://grindctrl.cloud' ? 'https://shopify-m1-dev.grindctrl.cloud' : 'https://grindctrl.cloud';
    sandbox.dispatchEvent(new sandbox.MessageEvent('message', { data, origin: otherOrigin, source: frame.contentWindow }));
    sandbox.dispatchEvent(new sandbox.MessageEvent('message', { data, origin: expected, source: sandbox }));
    expect(fetch).toHaveBeenCalledTimes(callsBeforeMessage);
    expect(postMessage).not.toHaveBeenCalled();
    sandbox.dispatchEvent(new sandbox.MessageEvent('message', { data, origin: expected, source: frame.contentWindow }));
    await waitFor(() => expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'grindctrl-tryon:cart-result', ok: false }), expected,
    ));
  });
});

describe('Shopify Liquid app origin wiring', () => {
  it.each(['messenger', 'tryon', 'tryon-catalog'])('passes an escaped HTTPS app-data origin to %s', block => {
    const liquid = readFileSync(path.join(extensionRoot, '../blocks', `${block}.liquid`), 'utf8');
    expect(liquid).toContain("app.metafields.grindctrl.app_origin.value | default: 'https://grindctrl.cloud'");
    expect(liquid).toContain('app_origin | slice: 0, 8');
    expect(liquid).toMatch(/unless app_origin_prefix == 'https:\/\/'[\s\S]*?assign app_origin = 'https:\/\/grindctrl.cloud'/);
    expect(liquid).toContain(block === 'messenger'
      ? 'src="{{ app_origin | escape }}/widget/v1/messenger.js"'
      : 'data-app-origin="{{ app_origin | escape }}"');
  });
});

describe('Shopify Try-On extension failure transport', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('shows a localized accessible product-page failure and retries proof minting', async () => {
    document.body.innerHTML = `
      <div class="gc-tryon-root"
        data-product="premium-ringer-tee"
        data-title="Premium tee"
        data-garment="//cdn.shopify.com/s/files/garment.png"
        data-variant="123"
        data-shop="demo.myshopify.com"
        data-locale="ar">
        <button type="button" class="gc-tryon-btn">
          <span class="gc-tryon-label">جرّبه</span>
        </button>
      </div>`;
    let contextRequests = 0;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('/apps/grindctrl/config')) {
        return new Response('{}', { status: 503 });
      }
      contextRequests += 1;
      return new Response('{}', { status: 401 });
    }));

    window.eval(productAsset);
    fireEvent.click(document.querySelector('.gc-tryon-btn')!);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('تعذّر التحقق من تجربة هذا المنتج');
    const retry = screen.getByRole('button', { name: 'إعادة محاولة التجربة' });
    fireEvent.click(retry);
    await waitFor(() => expect(contextRequests).toBe(2));
  });

  it('keeps catalog errors localized, assertive, retryable, and refresh-aware', () => {
    expect(catalogAsset).toContain("unavailable: 'Try-on could not be verified for this product.'");
    expect(catalogAsset).toContain("unavailable: 'تعذّر التحقق من تجربة هذا المنتج.'");
    expect(catalogAsset).toContain("loading.setAttribute('role', 'alert')");
    expect(catalogAsset).toContain("retry.className = 'gc-cat-retry'");
    expect(catalogAsset).toContain("data.type === 'grindctrl-tryon:refresh'");
    expect(catalogAsset).not.toContain("loading.textContent = 'Try-on is unavailable.'");
  });

  /* Phase zero item 9: the owner's preview link reaches both proxy calls. */
  it.each([
    ['product page', productAsset],
    ['catalogue', catalogAsset],
  ])('the %s script keeps the preview link and sends it with config and context', (_name, asset) => {
    expect(asset).toContain("get('gc_preview')");
    expect(asset).toContain("window.localStorage.setItem(PREVIEW_KEY");
    expect(asset).toContain("url += '&preview=' + encodeURIComponent(preview)");
    expect(asset).toContain('PREVIEW_TTL_MS = 24 * 60 * 60 * 1000');
  });
});
