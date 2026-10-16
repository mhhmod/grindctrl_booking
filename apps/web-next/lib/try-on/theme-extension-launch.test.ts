// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fireEvent, waitFor } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* Phase zero item 1 / contract N34: the product-page block reads the
   config's launch answer and stays out of the page unless try-on is live. */
const productAsset = readFileSync(
  path.resolve(process.cwd(), '../grindctrl-tryon/extensions/tryon-block/assets/tryon.js'),
  'utf8',
);

const BLOCK = `
  <div class="gc-tryon-root gc-tryon-root--pending"
    data-product="premium-ringer-tee"
    data-title="Premium tee"
    data-garment="//cdn.shopify.com/s/files/garment.png"
    data-variant="123"
    data-shop="demo.myshopify.com"
    data-locale="en">
    <button type="button" class="gc-tryon-btn gc-tryon-btn--loading" aria-busy="true">
      <span class="gc-tryon-label">Try it on</span>
    </button>
  </div>`;

function stubFetch(config: unknown, contextStatus = 200) {
  const calls: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.includes('/apps/grindctrl/config')) {
      return config === null
        ? new Response('{}', { status: 503 })
        : new Response(JSON.stringify(config), { status: 200 });
    }
    return new Response(JSON.stringify({ error: 'out_of_looks' }), { status: contextStatus });
  }));
  return calls;
}

describe('Try-On product block launch answer', () => {
  beforeEach(() => {
    document.body.innerHTML = BLOCK;
  });

  afterEach(() => {
    delete (window as { Shopify?: unknown }).Shopify;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('starts out of the layout, not as an invisible gap', () => {
    stubFetch({ tryOn: 'live', reason: null });
    const css = readFileSync(
      path.resolve(process.cwd(), '../grindctrl-tryon/extensions/tryon-block/assets/tryon.css'),
      'utf8',
    );
    expect(css).toMatch(/\.gc-tryon-root--pending\s*\{\s*display:\s*none;/);
    expect(css).not.toContain('visibility: hidden');
  });

  it('removes the block entirely when try-on is hidden', async () => {
    stubFetch({ tryOn: 'hidden', reason: 'out_of_looks', buttonLabel: 'Try it on' });
    window.eval(productAsset);

    await waitFor(() => expect(document.querySelector('.gc-tryon-root')).toBeNull());
    expect(document.querySelector('.gc-tryon-btn')).toBeNull();
  });

  it('reads the older available field from a server without tryOn', async () => {
    stubFetch({ available: false });
    window.eval(productAsset);

    await waitFor(() => expect(document.querySelector('.gc-tryon-root')).toBeNull());
  });

  it('reveals the styled button when try-on is live', async () => {
    stubFetch({ tryOn: 'live', reason: null, buttonLabel: 'Try it on with AI' });
    window.eval(productAsset);

    const root = document.querySelector('.gc-tryon-root')!;
    await waitFor(() => expect(root.classList.contains('gc-tryon-root--pending')).toBe(false));
    expect(root.querySelector('.gc-tryon-label')).toHaveTextContent('Try it on with AI');
    expect(root.querySelector('.gc-tryon-btn')).not.toHaveAttribute('aria-busy');
  });

  it('keeps today’s defaults when the config cannot be read', async () => {
    stubFetch(null);
    window.eval(productAsset);

    const root = document.querySelector('.gc-tryon-root')!;
    await waitFor(() => expect(root.classList.contains('gc-tryon-root--pending')).toBe(false));
    expect(document.querySelector('.gc-tryon-btn')).not.toBeNull();
  });

  it('still shows the block in the theme editor so the merchant can place it', async () => {
    (window as { Shopify?: unknown }).Shopify = { designMode: true };
    stubFetch({ tryOn: 'hidden', reason: 'out_of_looks' });
    window.eval(productAsset);

    const root = document.querySelector('.gc-tryon-root')!;
    await waitFor(() => expect(root.classList.contains('gc-tryon-root--pending')).toBe(false));
    expect(document.body.contains(root)).toBe(true);
  });

  /* Phase zero item 3: the server keys these calls by shop and this id,
     since they reach it from Shopify's address. */
  it('sends one stored anonymous visitor id on the config and context calls', async () => {
    localStorage.clear();
    const calls = stubFetch({ tryOn: 'live', reason: null }, 409);
    window.eval(productAsset);
    const root = document.querySelector('.gc-tryon-root')!;
    await waitFor(() => expect(root.classList.contains('gc-tryon-root--pending')).toBe(false));
    fireEvent.click(document.querySelector('.gc-tryon-btn')!);
    await waitFor(() => expect(calls.some((url) => url.includes('try-on-context'))).toBe(true));

    const stored = localStorage.getItem('gc_tryon_vid');
    expect(stored).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
    const ids = calls.map((url) => new URL(url, 'https://shop.example').searchParams.get('vid'));
    expect(ids).toEqual([stored, stored]);
  });

  it('takes the button away when the looks ran out after the page loaded', async () => {
    const calls = stubFetch({ tryOn: 'live', reason: null }, 409);
    window.eval(productAsset);
    const root = document.querySelector('.gc-tryon-root')!;
    await waitFor(() => expect(root.classList.contains('gc-tryon-root--pending')).toBe(false));

    fireEvent.click(document.querySelector('.gc-tryon-btn')!);

    await waitFor(() => expect(document.querySelector('.gc-tryon-root')).toBeNull());
    expect(calls.some((url) => url.includes('/apps/grindctrl/try-on-context'))).toBe(true);
    expect(document.querySelector('[role="alert"]')).toBeNull();
    expect(document.querySelector('iframe')).toBeNull();
  });
});
