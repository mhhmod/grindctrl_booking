// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fireEvent, waitFor } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* The v16 try-on sheet (02-try-on.md), for a store whose v16_tryon flag is
   on: the try-on opens over the page instead of inline, closes every way a
   shopper expects, keeps the look while closed, and adds to the cart
   without leaving the look. */
const productAsset = readFileSync(
  path.resolve(process.cwd(), '../grindctrl-tryon/extensions/tryon-block/assets/tryon.js'),
  'utf8',
);

const PAGE = `
  <main id="theme-main">
    <section class="shopify-section">
      <form action="/cart/add" method="post">
        <input type="hidden" name="id" value="456">
      </form>
      <div class="gc-tryon-root gc-tryon-root--pending"
        data-product="layla-abaya"
        data-title="Layla Embroidered Abaya"
        data-garment="//cdn.shopify.com/s/files/garment.png"
        data-variant="123"
        data-shop="demo.myshopify.com"
        data-locale="en">
        <button type="button" class="gc-tryon-btn gc-tryon-btn--loading" aria-busy="true">
          <span class="gc-tryon-label">Try it on</span>
        </button>
      </div>
    </section>
  </main>
  <span data-cart-count>0</span>`;

function stubFetch(features: string[], productJson: unknown = { variants: [{ id: 123, title: 'Sand / S' }, { id: 456, title: 'Black / M' }] }) {
  const calls: Array<{ url: string; body?: string }> = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, body: typeof init?.body === 'string' ? init.body : undefined });
      if (url.includes('/apps/grindctrl/config')) {
        return new Response(JSON.stringify({ tryOn: 'live', reason: null, radiusPx: 12, features }), { status: 200 });
      }
      if (url === '/products/layla-abaya.js') {
        return productJson === null ? new Response('', { status: 500 }) : new Response(JSON.stringify(productJson), { status: 200 });
      }
      if (url.includes('/apps/grindctrl/try-on-context')) {
        const nonce = new URL(url, 'https://shop.example').searchParams.get('nonce');
        return new Response(JSON.stringify({ token: 'signed-context', nonce }), { status: 200 });
      }
      if (url === '/cart/add.js') {
        return new Response(JSON.stringify({ items: [{ id: 456, variant_title: 'Black / M' }] }), { status: 200 });
      }
      if (url === '/cart.js') return new Response(JSON.stringify({ item_count: 3 }), { status: 200 });
      return new Response('{}', { status: 404 });
    }),
  );
  return calls;
}

async function openSheet() {
  window.eval(productAsset);
  const root = document.querySelector('.gc-tryon-root')!;
  await waitFor(() => expect(root.classList.contains('gc-tryon-root--pending')).toBe(false));
  const button = document.querySelector<HTMLButtonElement>('.gc-tryon-btn')!;
  fireEvent.click(button);
  await waitFor(() => expect(document.querySelector('.gc-tryon-sheet')).not.toBeNull());
  const sheet = document.querySelector<HTMLElement>('.gc-tryon-sheet')!;
  const frame = sheet.querySelector('iframe')!;
  return { root, button, sheet, frame };
}

function fromFrame(frame: HTMLIFrameElement, data: unknown) {
  window.dispatchEvent(new MessageEvent('message', { data, origin: 'https://grindctrl.cloud', source: frame.contentWindow }));
}

describe('the v16 try-on sheet', () => {
  beforeEach(() => {
    document.body.innerHTML = PAGE;
    window.history.replaceState(null, '', '/products/layla-abaya');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.documentElement.style.overflow = '';
  });

  it('opens the try-on over the page, with the camera and the variant the shopper picked', async () => {
    const calls = stubFetch(['v16_tryon']);
    const { root, sheet, frame } = await openSheet();

    expect(sheet.parentElement).toBe(document.body);
    expect(sheet).toHaveAttribute('role', 'dialog');
    expect(sheet).toHaveAttribute('aria-modal', 'true');
    expect(sheet).toHaveAttribute('aria-label', 'Layla Embroidered Abaya');
    expect(sheet.hidden).toBe(false);
    expect(root.querySelector('iframe')).toBeNull();
    expect(frame.getAttribute('allow')).toBe('camera');
    expect(frame.src).toContain('variant=456');
    expect(frame.src).toContain('sheet=1');
    expect(new URL(frame.src).searchParams.get('variantTitle')).toBe('Black / M');
    expect(calls.find((call) => call.url.includes('try-on-context'))?.url).toContain('variant=456');
    expect(sheet.querySelector('.gc-tryon-sheet__close')).toHaveAttribute('aria-label', 'Close');
    expect(sheet.style.getPropertyValue('--gc-sheet-radius')).toBe('12px');
  });

  it('keeps the store out of reach while open, and gives focus back on close', async () => {
    stubFetch(['v16_tryon']);
    const { button, sheet, frame } = await openSheet();

    expect(document.activeElement).toBe(frame);
    expect((document.getElementById('theme-main') as HTMLElement & { inert: boolean }).inert).toBe(true);
    expect(document.documentElement.style.overflow).toBe('hidden');

    fireEvent.click(sheet.querySelector('.gc-tryon-sheet__close')!);

    expect(sheet.hidden).toBe(true);
    expect((document.getElementById('theme-main') as HTMLElement & { inert: boolean }).inert).toBe(false);
    expect(document.documentElement.style.overflow).toBe('');
    expect(document.activeElement).toBe(button);
  });

  it('closes on the backdrop, on Escape, on the back gesture and when the try-on asks', async () => {
    stubFetch(['v16_tryon']);
    const { button, sheet, frame } = await openSheet();

    fireEvent.click(sheet.querySelector('.gc-tryon-sheet__backdrop')!);
    expect(sheet.hidden).toBe(true);

    fireEvent.click(button);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(sheet.hidden).toBe(true);

    fireEvent.click(button);
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(sheet.hidden).toBe(true);

    fireEvent.click(button);
    fromFrame(frame, { type: 'grindctrl-tryon:close' });
    expect(sheet.hidden).toBe(true);
  });

  it('keeps the same try-on when reopened, so a look is never thrown away', async () => {
    stubFetch(['v16_tryon']);
    const { button, sheet, frame } = await openSheet();
    fireEvent.click(sheet.querySelector('.gc-tryon-sheet__close')!);
    fireEvent.click(button);

    expect(sheet.hidden).toBe(false);
    expect(document.querySelectorAll('.gc-tryon-sheet')).toHaveLength(1);
    expect(sheet.querySelector('iframe')).toBe(frame);
  });

  it('adds the picked variant without leaving, says what it added and refreshes the cart count', async () => {
    const calls = stubFetch(['v16_tryon']);
    const { frame } = await openSheet();
    const posted = vi.spyOn(frame.contentWindow!, 'postMessage');
    const href = window.location.href;

    fromFrame(frame, { type: 'grindctrl-tryon:add-to-cart' });

    await waitFor(() =>
      expect(posted).toHaveBeenCalledWith(
        { type: 'grindctrl-tryon:cart-result', ok: true, variantTitle: 'Black / M' },
        'https://grindctrl.cloud',
      ),
    );
    expect(JSON.parse(calls.find((call) => call.url === '/cart/add.js')!.body!)).toEqual({ items: [{ id: 456, quantity: 1 }] });
    await waitFor(() => expect(document.querySelector('[data-cart-count]')).toHaveTextContent('3'));
    expect(window.location.href).toBe(href);
  });

  it("hands the sheet the store's own product, in the shopper's currency", async () => {
    stubFetch(['v16_tryon'], {
      options: [{ name: 'Colour', position: 1, values: ['Black', 'Sand'] }, 'Size'],
      variants: [
        { id: 456, title: 'Black / M', option1: 'Black', option2: 'M', option3: null, available: true, price: 325000 },
        { id: 457, title: 'Black / L', option1: 'Black', option2: 'L', option3: null, available: false, price: 325000 },
      ],
    });
    (window as { Shopify?: unknown }).Shopify = { currency: { active: 'EGP' } };
    const { frame } = await openSheet();
    const posted = vi.spyOn(frame.contentWindow!, 'postMessage');

    fromFrame(frame, { type: 'grindctrl-tryon:product-request' });

    await waitFor(() => expect(posted).toHaveBeenCalled());
    expect(posted).toHaveBeenCalledWith(
      {
        type: 'grindctrl-tryon:product',
        variant: '456',
        product: {
          options: ['Colour', 'Size'],
          currency: 'EGP',
          variants: [
            { id: 456, title: 'Black / M', options: ['Black', 'M'], available: true, price: 325000 },
            { id: 457, title: 'Black / L', options: ['Black', 'L'], available: false, price: 325000 },
          ],
        },
      },
      'https://grindctrl.cloud',
    );
    delete (window as { Shopify?: unknown }).Shopify;
  });

  it('adds the size picked on the look, but only a variant of this product', async () => {
    const calls = stubFetch(['v16_tryon']);
    const { frame } = await openSheet();
    const posted = vi.spyOn(frame.contentWindow!, 'postMessage');
    const adds = () => calls.filter((call) => call.url === '/cart/add.js').map((call) => JSON.parse(call.body!).items[0].id);

    fromFrame(frame, { type: 'grindctrl-tryon:add-to-cart', variantId: '123' });
    await waitFor(() => expect(adds()).toEqual([123]));

    fromFrame(frame, { type: 'grindctrl-tryon:add-to-cart', variantId: '999' });
    await waitFor(() => expect(adds()).toEqual([123, 456]));
    fromFrame(frame, { type: 'grindctrl-tryon:add-to-cart', variantId: '1 OR 1' });
    await waitFor(() => expect(adds()).toEqual([123, 456, 456]));
    await waitFor(() => expect(posted).toHaveBeenCalledTimes(3));
  });

  it('swipes closed from the handle, and springs back from a short pull', async () => {
    stubFetch(['v16_tryon']);
    const { sheet } = await openSheet();
    const bar = sheet.querySelector('.gc-tryon-sheet__bar')!;

    fireEvent.pointerDown(bar, { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(bar, { clientY: 140, pointerId: 1 });
    fireEvent.pointerUp(bar, { clientY: 140, pointerId: 1 });
    expect(sheet.hidden).toBe(false);

    fireEvent.pointerDown(bar, { clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(bar, { clientY: 260, pointerId: 1 });
    expect(sheet.hidden).toBe(true);
  });

  it("opens with the product alone when the store's product names cannot be read", async () => {
    stubFetch(['v16_tryon'], null);
    const { frame } = await openSheet();
    expect(frame.src).toContain('variant=456');
    expect(frame.src).not.toContain('variantTitle');
  });

  it('opens inline, as today, for a store without the flag', async () => {
    stubFetch([]);
    window.eval(productAsset);
    const root = document.querySelector('.gc-tryon-root')!;
    await waitFor(() => expect(root.classList.contains('gc-tryon-root--pending')).toBe(false));
    fireEvent.click(document.querySelector('.gc-tryon-btn')!);

    await waitFor(() => expect(root.querySelector('iframe')).not.toBeNull());
    expect(document.querySelector('.gc-tryon-sheet')).toBeNull();
    expect(root.querySelector('iframe')!.src).toContain('variant=123');
    expect(root.querySelector('iframe')!.src).not.toContain('sheet=1');
    expect(root.querySelector('iframe')!.src).not.toContain('variantTitle');
  });
});
