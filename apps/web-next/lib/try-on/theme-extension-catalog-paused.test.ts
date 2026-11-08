// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

/* The merchant's Try-On button switch on collection pages. Its own file:
   the script registers a page-wide click listener every time it runs. */
const catalogAsset = readFileSync(
  path.resolve(process.cwd(), '../grindctrl-tryon/extensions/tryon-block/assets/tryon-catalog.js'),
  'utf8',
);

describe('Try-On catalogue pills with the button switched off', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('adds no pills and no styles, and shows no error', async () => {
    document.head.innerHTML = '';
    document.body.innerHTML = `
      <ul><li class="grid__item"><a href="/products/linen-abaya"><img src="https://cdn.shopify.com/a.jpg" alt="Linen abaya"></a></li></ul>`;
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ tryOn: 'hidden', reason: 'paused', available: false }))));
    window.eval(catalogAsset);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(document.querySelectorAll('.gc-cat-btn')).toHaveLength(0);
    expect(document.getElementById('gc-cat-styles')).toBeNull();
    expect(document.querySelector('[role="alert"]')).toBeNull();
  });

  it('adds no pills while Try-On is live but the card pill switch is off', async () => {
    document.head.innerHTML = '';
    document.body.innerHTML = `
      <ul><li class="grid__item"><a href="/products/linen-abaya"><img src="https://cdn.shopify.com/a.jpg" alt="Linen abaya"></a></li></ul>`;
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ tryOn: 'live', reason: null, available: true, showCardPill: false }))));
    window.eval(catalogAsset);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(document.querySelectorAll('.gc-cat-btn')).toHaveLength(0);
    expect(document.getElementById('gc-cat-styles')).toBeNull();
  });
});
