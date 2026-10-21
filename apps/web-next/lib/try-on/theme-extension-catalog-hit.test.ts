// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { waitFor } from '@testing-library/dom';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

/* A tap is the pill's only when no fixed or sticky layer sits above it. On
   the live demo store, tapping the chat bubble on a phone opened the try-on
   of the product card beneath it: the pill was found by point through the
   bubble, and the capture listener stopped the tap before the bubble saw
   it. Its own file, because the script registers a page-wide click listener
   every time it runs. jsdom has no layout, so each test says what the
   browser would find at the tapped point. */
const catalogAsset = readFileSync(
  path.resolve(process.cwd(), '../grindctrl-tryon/extensions/tryon-block/assets/tryon-catalog.js'),
  'utf8',
);

const GRID = `
  <ul>
    <li class="grid__item">
      <div class="card__media"><a href="/products/linen-abaya"><img src="https://cdn.shopify.com/a.jpg" alt="Linen abaya"></a></div>
      <a class="card__link" href="/products/linen-abaya" style="position:absolute;inset:0"></a>
    </li>
  </ul>`;

function tapAt(target: Element, stack: Element[]) {
  (document as Document & { elementsFromPoint: (x: number, y: number) => Element[] }).elementsFromPoint = () => stack;
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true, clientX: 300, clientY: 780 }));
}

describe('Try-On catalogue pills and the layers above them', () => {
  beforeAll(async () => {
    document.head.innerHTML = '';
    document.body.innerHTML = GRID;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('/apps/grindctrl/config')) {
        return new Response(JSON.stringify({ tryOn: 'live', reason: null, catalogLabel: 'Try on' }), { status: 200 });
      }
      return new Promise<Response>(() => {});
    }));
    window.eval(catalogAsset);
    await waitFor(() => expect(document.querySelectorAll('.gc-cat-btn')).toHaveLength(1));
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('lets a tap on the chat bubble above a pill reach the bubble', () => {
    const pill = document.querySelector('.gc-cat-btn')!;
    const bubbleHost = document.createElement('div');
    bubbleHost.style.cssText = 'position:fixed;bottom:20px;right:16px';
    const bubble = document.createElement('button');
    bubbleHost.appendChild(bubble);
    document.body.appendChild(bubbleHost);
    const opened = vi.fn();
    bubble.addEventListener('click', opened);

    tapAt(bubble, [bubbleHost, pill, pill.closest('li')!, document.body, document.documentElement]);

    expect(opened).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.gc-cat-overlay')).toBeNull();
    bubbleHost.remove();
  });

  it('lets a tap on a sticky Add to cart bar above a pill reach the bar', () => {
    const pill = document.querySelector('.gc-cat-btn')!;
    const bar = document.createElement('div');
    bar.style.cssText = 'position:sticky;bottom:0';
    const add = document.createElement('button');
    bar.appendChild(add);
    document.body.appendChild(bar);
    const added = vi.fn();
    add.addEventListener('click', added);

    tapAt(add, [add, bar, pill, pill.closest('li')!, document.body, document.documentElement]);

    expect(added).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.gc-cat-overlay')).toBeNull();
    bar.remove();
  });

  it("still opens the pill through the theme's invisible card link", async () => {
    const pill = document.querySelector('.gc-cat-btn')!;
    const cardLink = document.querySelector('.card__link')!;
    const followed = vi.fn();
    cardLink.addEventListener('click', followed);

    tapAt(cardLink, [cardLink, pill, pill.closest('li')!, document.body, document.documentElement]);

    await waitFor(() => expect(document.querySelector('.gc-cat-overlay')).not.toBeNull());
    expect(followed).not.toHaveBeenCalled();
  });
});
