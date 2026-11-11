// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { validSpotSelector } from './placement';

const engineSource = readFileSync('public/widget/v1/tryon-engine.js', 'utf8');
const pickSource = readFileSync('public/widget/v1/pick-spot.js', 'utf8');
const globals = window as unknown as Record<string, unknown>;
const fetcher = vi.fn<typeof fetch>();
const forget = vi.fn();
const listeners: Array<[EventTarget, string, EventListenerOrEventListenerObject, unknown]> = [];
type Pick = { buildSelector: (node: Element) => string; selectable: (node: Element) => boolean; cancel: () => void };

const PAGE = `
  <header><a href="/products/other">Other dress</a><nav><a href="/collections/all">Shop</a></nav></header>
  <main>
    <h1 id="title">فستان ورد أزرق</h1>
    <div class="price">350 EGP</div>
    <form action="/cart/add"><button id="buy" name="add" class="btn">Add to cart</button></form>
    <p class="fit">Fits true to size</p>
    <span class="tiny" data-small>i</span>
    <ul class="specs"><li class="spec">Cotton</li><li class="spec">Blue</li><li class="spec">Midi</li><li class="spec">Belt</li></ul>
    <div class="related"><a href="/products/red">Red dress</a></div>
  </main>
  <footer><a href="/pages/about">About</a></footer>`;

const pick = () => globals.GRINDCTRL_PICK_SPOT as Pick;
const chrome = () => document.querySelector('[data-gc-pick]')?.shadowRoot ?? null;
const q = <T extends Element = HTMLElement>(selector: string) => chrome()!.querySelector<T>(selector)!;
const text = (selector: string) => q(selector).textContent;
const tryOn = () => document.querySelector<HTMLElement>('.gc-tryon-btn')!;
const buttonNamed = (name: string) => Array.from(chrome()!.querySelectorAll('button')).find((b) => b.textContent === name)!;
const hover = (node: Element) => node.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, composed: true }));
const tap = (node: Element) => node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));
const key = (k: string, shiftKey = false) => document.dispatchEvent(new KeyboardEvent('keydown', { key: k, shiftKey, bubbles: true, cancelable: true }));
const width = (px: number) => Object.defineProperty(window, 'innerWidth', { configurable: true, value: px });

function boot(options: { page?: string; lang?: string; preset?: object | null; button?: boolean } = {}) {
  document.documentElement.lang = options.lang ?? 'en';
  document.body.innerHTML = options.page ?? PAGE;
  (0, eval)(engineSource);
  if (options.button !== false && document.querySelector('#buy')) {
    (globals.GRINDCTRL_TRYON_ENGINE as { mount: (a: object) => void }).mount({
      injectButton: true, detectProduct: () => ({ id: 'dress' }), placement: () => ({ node: document.querySelector('form'), mode: 'after' }),
      lookKey: () => 'dress', buttonLabel: 'Try it on',
    });
  }
  globals.GRINDCTRL_PICK_CONFIG = { token: 'tok', claim: 'c'.repeat(43), appOrigin: 'https://grindctrl.cloud', preset: options.preset ?? null,
    look: { buttonLabel: 'Try it on' }, forget };
  (0, eval)(pickSource);
}

beforeEach(() => {
  vi.useFakeTimers();
  fetcher.mockReset(); forget.mockReset();
  for (const name of ['GRINDCTRL_TRYON_ENGINE', 'GRINDCTRL_PICK_CONFIG', 'GRINDCTRL_PICK_SPOT']) delete globals[name];
  document.head.innerHTML = '';
  width(1280);
  window.history.replaceState(null, '', '/products/dress');
  for (const target of [document, window]) {
    const add = target.addEventListener.bind(target);
    vi.spyOn(target, 'addEventListener').mockImplementation((type, listener, opts) => { if (listener) listeners.push([target, type, listener, opts]); add(type, listener, opts); });
  }
  // jsdom lays nothing out: every element is 300 x 40, data-small ones 20 x 20.
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const small = this.hasAttribute('data-small');
    return { x: 40, y: 200, left: 40, top: 200, right: small ? 60 : 340, bottom: small ? 220 : 240, width: small ? 20 : 300, height: small ? 20 : 40, toJSON: () => ({}) } as DOMRect;
  });
  vi.stubGlobal('fetch', fetcher);
});
afterEach(() => {
  for (const [target, type, listener, opts] of listeners.splice(0)) target.removeEventListener(type, listener, opts as boolean);
  vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});

describe('selector builder', () => {
  it('prefers a stable id, then semantic attributes, then a short class path', () => {
    boot({ page: `<main>
      <button id="AddToCart">A</button>
      <div id="ProductInfo-template--1234567__main"><p class="lead">Lead</p></div>
      <div data-product-form><span>x</span></div>
      <form action="/cart/add"><input name="quantity"></form>
      <button name="add-to-cart" class="b-1">B</button>
      <section class="buy-box"><div class="row"><a class="cta">C</a></div></section>
      <section class="info"><div class="row"><a class="cta">D</a></div></section>
    </main>` });
    const b = pick().buildSelector;
    expect(b(document.querySelector('#AddToCart')!)).toBe('#AddToCart');
    // A generated id is skipped.
    expect(b(document.querySelector('p.lead')!)).toBe('p.lead');
    expect(b(document.querySelector('[data-product-form]')!)).toBe('div[data-product-form]');
    expect(b(document.querySelector('form')!)).toBe('form[action*="cart"]');
    expect(b(document.querySelector('[name="add-to-cart"]')!)).toBe('button[name="add-to-cart"]');
    // Two identical links: each is named through its own section, a unique match beating a shared one.
    expect(b(document.querySelectorAll('a.cta')[0])).toBe('section.buy-box > div.row > a.cta');
    expect(b(document.querySelectorAll('a.cta')[1])).toBe('section.info > div.row > a.cta');
  });

  it('reaches a stable ancestor at any distance without exceeding five levels', () => {
    const branch = (id: string) => `<section id="${id}"><div><div><div><div><div><span class="t">x</span></div></div></div></div></div></section>`;
    boot({ page: `<main>${branch('first')}${branch('second')}</main>` });
    const selector = pick().buildSelector(document.querySelectorAll('span.t')[1]);
    expect(selector).toBe('#second span.t');
    expect(validSpotSelector(selector)).toBe(true);
  });

  it('gives up rather than match more than three elements, or another element first', () => {
    boot();
    expect(pick().buildSelector(document.querySelectorAll('li.spec')[3])).toBe('');
    const twins = '<div><div><span class="t">a</span></div></div>';
    document.querySelector('main')!.insertAdjacentHTML('beforeend', twins + twins);
    const spans = document.querySelectorAll('span.t');
    expect(pick().buildSelector(spans[0])).toBe('span.t');
    expect(pick().buildSelector(spans[1])).toBe('');
  });

  it('only ever builds selectors the server accepts', () => {
    boot();
    for (const node of Array.from(document.querySelectorAll('main *'))) {
      const selector = pick().buildSelector(node);
      if (selector) expect(validSpotSelector(selector), selector).toBe(true);
    }
  });
});

describe('edit chrome', () => {
  it('draws a desktop toolbar in its own shadow root, above everything', () => {
    boot();
    const host = document.querySelector<HTMLElement>('[data-gc-pick]')!;
    expect(host.style.cssText).toContain('z-index: 2147483647');
    expect(host.shadowRoot).not.toBeNull();
    expect(text('.mark')).toBe('GRINDCTRL');
    expect(text('.instruction')).toBe('Click where the Try-On button should go');
    expect(buttonNamed('Cancel')).toBeTruthy();
    expect(q('.chrome').classList.contains('phone')).toBe(false);
  });

  it('desktop: hover highlights with a label tag; a click selects', () => {
    boot();
    hover(document.querySelector('#buy')!);
    expect(q('.outline').hidden).toBe(false);
    expect(text('.tag')).toBe('Button · Add to cart');
    tap(document.querySelector('#buy')!);
    expect(q('.callout').hidden).toBe(false);
    expect(text('.callout h2')).toBe('Put Try-On here?');
  });

  // Live bug 2026-11-11: choosing the price chose its inline <bdi>.
  it('choosing text inside a line chooses the whole line', () => {
    boot({ page: PAGE.replace('<div class="price">350 EGP</div>', '<div class="price"><span class="amount"><bdi>350 EGP</bdi></span></div>') });
    tap(document.querySelector('.price bdi')!);
    expect(q('.callout').hidden).toBe(false);
    expect(document.querySelector('.price')!.nextElementSibling).toBe(tryOn());
  });

  it('phone: a bottom bar; the first tap highlights, the second on the same element selects', () => {
    width(390);
    boot();
    expect(q('.chrome').classList.contains('phone')).toBe(true);
    expect(text('.instruction')).toBe('Tap where the Try-On button should go');
    const fit = document.querySelector('.fit')!;
    tap(fit);
    expect(q('.callout').hidden).toBe(true);
    expect(text('.tag')).toBe('Fits true to size');
    tap(document.querySelector('.price')!);
    expect(q('.callout').hidden).toBe(true);
    tap(document.querySelector('.price')!);
    expect(q('.callout').hidden).toBe(false);
  });

  it('phone: a scroll never selects', () => {
    width(390);
    boot();
    const fit = document.querySelector('.fit')!;
    tap(fit);
    fit.dispatchEvent(Object.assign(new Event('touchstart', { bubbles: true }), { touches: [{ clientX: 10, clientY: 300 }] }));
    fit.dispatchEvent(Object.assign(new Event('touchmove', { bubbles: true }), { touches: [{ clientX: 10, clientY: 200 }] }));
    tap(fit);
    expect(q('.callout').hidden).toBe(true);
  });

  it.each([
    ['the header', 'header a'],
    ['the footer', 'footer a'],
    ['another product', '.related a'],
    ['a tiny element', '.tiny'],
    ['the Try-On button itself', '.gc-tryon-btn'],
  ])('refuses %s with the tooltip', (_, selector) => {
    boot();
    tap(document.querySelector(selector)!);
    expect(q('.tip').hidden).toBe(false);
    expect(text('.tip')).toBe('Choose a spot on the product itself');
    expect(q('.callout').hidden).toBe(true);
    vi.advanceTimersByTime(3000);
    expect(q('.tip').hidden).toBe(true);
  });

  it('refuses an element no stable selector can name', () => {
    boot();
    tap(document.querySelectorAll('li.spec')[3]);
    expect(q('.callout').hidden).toBe(true);
    expect(q('.tip').hidden).toBe(false);
  });

  it('keeps the store page still: its links and buttons do nothing while choosing', () => {
    boot();
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    document.querySelector('#buy')!.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
  });

  it('keyboard: Tab moves between elements, Enter selects, Escape cancels', () => {
    boot();
    key('Tab');
    expect(q('.outline').hidden).toBe(false);
    const first = text('.tag');
    key('Tab');
    expect(text('.tag')).not.toBe(first);
    key('Tab', true);
    expect(text('.tag')).toBe(first);
    key('Enter');
    expect(q('.callout').hidden).toBe(false);
    key('Escape');
    expect(document.querySelector('[data-gc-pick]')).toBeNull();
    expect(forget).toHaveBeenCalled();
    // The real button is back where automatic placement put it.
    expect(document.querySelector('form')!.nextElementSibling).toBe(tryOn());
  });

  it('previews the real button below, then above, the chosen element; Pick another spot puts it back', () => {
    boot();
    const fit = document.querySelector('.fit')!;
    tap(fit);
    expect(fit.nextElementSibling).toBe(tryOn());
    expect(buttonNamed('Below').getAttribute('aria-pressed')).toBe('true');
    buttonNamed('Above').click();
    expect(fit.previousElementSibling).toBe(tryOn());
    expect(buttonNamed('Above').getAttribute('aria-pressed')).toBe('true');
    buttonNamed('Pick another spot').click();
    expect(q('.callout').hidden).toBe(true);
    expect(document.querySelector('form')!.nextElementSibling).toBe(tryOn());
  });

  it('saves the spot: spinner while saving, then the toast and Back to dashboard', async () => {
    let finish!: (res: Response) => void;
    fetcher.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    boot();
    tap(document.querySelector('.fit')!);
    buttonNamed('Above').click();
    buttonNamed('Save').click();
    expect(buttonNamed('Save').disabled).toBe(true);
    expect(q('.spinner')).not.toBeNull();
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('https://grindctrl.cloud/api/try-on/pick/save');
    expect(init).toMatchObject({ method: 'POST', credentials: 'omit' });
    expect(JSON.parse(String(init!.body))).toEqual({ token: 'tok', claim: 'c'.repeat(43), selector: 'p.fit', position: 'before',
      label: 'Fits true to size', pathHint: '/products/dress' });
    finish(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await vi.advanceTimersByTimeAsync(0);
    expect(text('.toolbar [role="status"]')).toBe('Saved. Try-On will appear here on all product pages.');
    const back = q<HTMLAnchorElement>('a.action');
    expect([back.textContent, back.href]).toEqual(['Back to dashboard', 'https://grindctrl.cloud/dashboard/try-on/setup#button-placement']);
    expect(forget).toHaveBeenCalled();
    // The button stays where it was saved.
    expect(document.querySelector('.fit')!.previousElementSibling).toBe(tryOn());
    // Back closes the tab the dashboard opened.
    const close = vi.spyOn(window, 'close').mockImplementation(() => {});
    back.click();
    expect(close).toHaveBeenCalled();
  });

  it('keeps the selection when saving fails, and retries', async () => {
    fetcher.mockRejectedValueOnce(new TypeError('offline')).mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    boot();
    tap(document.querySelector('.fit')!);
    buttonNamed('Save').click();
    await vi.advanceTimersByTimeAsync(0);
    expect(text('.message')).toBe("Couldn't save. Check your connection and try again.");
    expect(buttonNamed('Save').disabled).toBe(false);
    expect(document.querySelector('.fit')!.nextElementSibling).toBe(tryOn());
    buttonNamed('Save').click();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(text('.toolbar [role="status"]')).toBe('Saved. Try-On will appear here on all product pages.');
  });

  it('says the link expired when it was used or ran out', async () => {
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ code: 'expired' }), { status: 410 }));
    boot();
    tap(document.querySelector('.fit')!);
    buttonNamed('Save').click();
    await vi.advanceTimersByTimeAsync(0);
    expect(text('.message')).toBe('This link has expired. Open Pick a spot again from your dashboard.');
    expect(buttonNamed('Save').disabled).toBe(true);
    expect(forget).toHaveBeenCalled();
  });

  it('on a page with no product: says so and links up to three products, none from the header or other cards', () => {
    window.history.replaceState(null, '', '/');
    boot({ button: false, page: `<header><a href="/products/top">Top</a></header><main>
      <a href="/products/a">Dress A</a><a href="/products/b">Dress B</a><a href="/products/a">Dress A again</a>
      <a href="/products/c">Dress C</a><a href="/products/d">Dress D</a><a href="https://elsewhere.example/products/x">X</a></main>` });
    expect(text('.instruction')).toBe('Open any product page to choose the spot');
    const links = Array.from(chrome()!.querySelectorAll<HTMLAnchorElement>('.links a'));
    expect(links.map((a) => [a.textContent, new URL(a.href).pathname])).toEqual([['Dress A', '/products/a'], ['Dress B', '/products/b'], ['Dress C', '/products/c']]);
    // Nothing is chosen on such a page; its links work.
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    document.querySelector('main a')!.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(false);
  });

  it('speaks Arabic on an Arabic store, right to left', () => {
    boot({ lang: 'ar' });
    expect(q('.chrome').getAttribute('dir')).toBe('rtl');
    expect(text('.instruction')).toBe('انقر حيث تريد زر القياس');
    tap(document.querySelector('#title')!);
    expect(text('.callout h2')).toBe('تضع زر القياس هنا؟');
    expect(['فوق', 'تحت', 'حفظ', 'اختر مكانًا آخر', 'إلغاء'].every((name) => buttonNamed(name))).toBe(true);
  });

  it('opens with the advanced field selector already chosen', () => {
    boot({ preset: { selector: 'h1#title', position: 'before' } });
    expect(q('.callout').hidden).toBe(false);
    expect(document.querySelector('#title')!.previousElementSibling).toBe(tryOn());
  });

  it('shows the preview in the owner look on a page with no button yet', () => {
    boot({ button: false });
    tap(document.querySelector('.price')!);
    const made = document.querySelector('.price')!.nextElementSibling as HTMLElement;
    expect(made.classList.contains('gc-tryon-btn')).toBe(true);
    expect(made.textContent).toContain('Try it on');
    buttonNamed('Cancel').click();
    expect(document.querySelector('.gc-tryon-btn')).toBeNull();
  });
});
