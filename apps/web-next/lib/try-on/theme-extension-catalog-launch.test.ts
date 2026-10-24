// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fireEvent, waitFor } from '@testing-library/dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

/* Phase zero item 1 / contract N34: the catalogue embed injects no pills
   unless the config says try-on is live. Its own file, because the script
   registers a page-wide click listener every time it runs. */
const catalogAsset = readFileSync(
  path.resolve(process.cwd(), '../grindctrl-tryon/extensions/tryon-block/assets/tryon-catalog.js'),
  'utf8',
);

const GRID = `
  <ul>
    <li class="grid__item"><a href="/products/linen-abaya"><img src="https://cdn.shopify.com/a.jpg" alt="Linen abaya"></a></li>
    <li class="grid__item"><a href="/products/crepe-abaya"><img src="https://cdn.shopify.com/b.jpg" alt="Crepe abaya"></a></li>
  </ul>`;

const fetched: string[] = [];

function stubFetch(config: unknown, contextStatus = 200) {
  fetched.length = 0;
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    fetched.push(url);
    if (url.includes('/apps/grindctrl/config')) {
      return new Response(JSON.stringify(config), { status: 200 });
    }
    return new Response(JSON.stringify({ error: 'out_of_looks' }), { status: contextStatus });
  }));
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('Try-On catalogue pills launch answer', () => {
  afterEach(() => {
    Object.defineProperty(document,'currentScript',{value:null,configurable:true});
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });


  it('adds no pills and no styles when try-on is hidden', async () => {
    document.head.innerHTML = '';
    document.body.innerHTML = GRID;
    stubFetch({ tryOn: 'hidden', reason: 'out_of_looks' });
    window.eval(catalogAsset);
    await settle();

    expect(document.querySelectorAll('.gc-cat-btn')).toHaveLength(0);
    expect(document.getElementById('gc-cat-styles')).toBeNull();

    // A grid the theme renders later stays bare too.
    document.querySelector('ul')!.insertAdjacentHTML(
      'beforeend',
      '<li class="grid__item"><a href="/products/silk-abaya"><img src="https://cdn.shopify.com/c.jpg" alt="Silk"></a></li>',
    );
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(document.querySelectorAll('.gc-cat-btn')).toHaveLength(0);
  });

  it('adds a pill per card when live, and removes them all when a look is refused', async () => {
    document.head.innerHTML = '';
    document.body.innerHTML = GRID;
    stubFetch({ tryOn: 'live', reason: null, catalogLabel: 'Try on' }, 409);
    window.eval(catalogAsset);

    await waitFor(() => expect(document.querySelectorAll('.gc-cat-btn')).toHaveLength(2));

    fireEvent.click(document.querySelector('.gc-cat-btn')!);

    await waitFor(() => expect(document.querySelectorAll('.gc-cat-btn')).toHaveLength(0));
    expect(document.querySelector('.gc-cat-overlay--open')).toBeNull();

    // Phase zero item 3: the same stored visitor id rides both calls.
    const stored = localStorage.getItem('gc_tryon_vid');
    expect(stored).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
    const mine = fetched.filter((url) => url.includes('/apps/grindctrl/'));
    expect(mine.length).toBeGreaterThanOrEqual(2);
    for (const url of mine) {
      expect(new URL(url, 'https://shop.example').searchParams.get('vid')).toBe(stored);
    }
    expect(document.querySelector('.gc-cat-overlay [role="alert"]')).toBeNull();
  });
  it('reads configuration from the explicitly selected B proxy',async()=>{
    document.body.innerHTML=GRID;
    const script=document.createElement('script');script.dataset.gcProxyPath='/apps/grindctrl-public';
    Object.defineProperty(document,'currentScript',{value:script,configurable:true});
    const fetch=vi.fn(async(_input:RequestInfo|URL)=>new Response(JSON.stringify({tryOn:'hidden'})));
    vi.stubGlobal('fetch',fetch);window.eval(catalogAsset);
    await settle();
    expect(String(fetch.mock.calls[0]?.[0])).toContain('/apps/grindctrl-public/config?');
  });
});
