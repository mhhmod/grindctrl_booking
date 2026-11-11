// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const source = readFileSync('public/widget/v1/tryon-engine.js', 'utf8');
const globals = window as unknown as Record<string, unknown>;
const beacon = vi.fn<(url: string, data: string) => boolean>(() => true);
const fetcher = vi.fn<typeof fetch>();
const listeners: Array<[EventTarget, string, EventListenerOrEventListenerObject]> = [];
type Engine = {
  mount: (adapter: Record<string, unknown>) => { refresh: () => void; place: (settings: unknown) => void };
  bootPick: (origin: string) => void;
  preview: (node: Element, position: string, look?: Record<string, unknown> | null) => HTMLElement | null;
  endPreview: (keep: boolean) => void;
};
const engine = () => globals.GRINDCTRL_TRYON_ENGINE as Engine;
const TOKEN = '22222222-2222-4222-8222-222222222222.' + (Date.now() + 20 * 60_000) + '.' + 'm'.repeat(43);
const PAGE = '<main><h1 id="title">Blue dress</h1><div class="price">350 EGP</div><select id="size"><option>M</option></select>' +
  '<form action="/cart/add"><button id="buy">Add to cart</button></form><p class="fit">Fits true to size</p></main>';

function adapter(overrides: Record<string, unknown> = {}) {
  return { signalKey: 'public-key', embedOrigin: 'https://grindctrl.cloud', injectButton: true,
    detectProduct: () => ({ id: 'dress', title: 'Dress' }), placement: () => ({ node: document.querySelector('#buy'), mode: 'after' }),
    placementTarget: () => document.querySelector('#buy'), lookKey: () => 'dress', buttonLabel: 'Try on', ...overrides };
}
const button = () => document.querySelector<HTMLElement>('.gc-tryon-btn')!;
const sentFacts = () => JSON.parse(String(beacon.mock.calls[0][1]));

beforeEach(() => {
  vi.useFakeTimers();
  beacon.mockClear(); fetcher.mockReset();
  delete globals.GRINDCTRL_TRYON_ENGINE; delete globals.GRINDCTRL_PICK_CONFIG;
  window.sessionStorage.clear();
  document.documentElement.removeAttribute('dir'); document.documentElement.lang = 'en';
  document.head.innerHTML = ''; document.body.innerHTML = PAGE;
  window.history.replaceState(null, '', '/products/dress');
  for (const target of [document, window]) {
    const add = target.addEventListener.bind(target);
    vi.spyOn(target, 'addEventListener').mockImplementation((type, listener, options) => { if (listener) listeners.push([target, type, listener]); add(type, listener, options); });
  }
  vi.stubGlobal('navigator', Object.create(navigator, { sendBeacon: { value: beacon } }));
  vi.stubGlobal('fetch', fetcher);
  (0, eval)(source);
});
afterEach(() => {
  for (const [target, type, listener] of listeners.splice(0)) target.removeEventListener(type, listener);
  vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});

describe('engine placement per mode', () => {
  it('auto: where the adapter finds the Buy button, as before', async () => {
    engine().mount(adapter({ buttonSettings: { placement: 'auto' } }));
    expect(document.querySelector('#buy')!.nextElementSibling).toBe(button());
    await vi.advanceTimersByTimeAsync(0);
    expect(sentFacts()).toEqual({ key: 'public-key', kind: 'product_page', productDetected: true, placement: 'inline' });
  });

  it.each([['before', 'previousElementSibling'], ['after', 'nextElementSibling']] as const)('spot: %s the chosen element', async (position, sibling) => {
    engine().mount(adapter({ buttonSettings: { placement: 'spot', spot: { selector: '#size', position } } }));
    expect(document.querySelector('#size')![sibling]).toBe(button());
    await vi.advanceTimersByTimeAsync(0);
    expect(sentFacts()).toEqual({ key: 'public-key', kind: 'product_page', productDetected: true, placement: 'inline' });
  });

  // Live bug 2026-11-11: a spot saved on the price's <bdi> put the button inside
  // the price line, which pushed a phone page sideways.
  it('spot on text inside a line: placed after the whole line, never inside it', () => {
    document.querySelector('.price')!.innerHTML = '<span class="amount"><bdi>350 EGP</bdi></span>';
    engine().mount(adapter({ buttonSettings: { placement: 'spot', spot: { selector: '.price bdi', position: 'after' } } }));
    expect(button().parentElement).toBe(document.querySelector('main'));
    expect(document.querySelector('.price')!.nextElementSibling).toBe(button());
  });

  it('spot: the first shown of up to three matches', () => {
    document.querySelector('main')!.insertAdjacentHTML('afterbegin', '<p class="fit" hidden>Hidden</p>');
    engine().mount(adapter({ buttonSettings: { placement: 'spot', spot: { selector: 'p.fit', position: 'after' } } }));
    expect(button().previousElementSibling!.textContent).toBe('Fits true to size');
  });

  it.each([
    ['not on the page', '#gone'],
    ['matching more than three elements', 'main > *'],
    ['not a valid selector', 'div[[['],
  ])('spot %s: falls back to automatic and reports spotMissing once', async (_, selector) => {
    engine().mount(adapter({ buttonSettings: { placement: 'spot', spot: { selector, position: 'after' } } }));
    expect(document.querySelector('#buy')!.nextElementSibling).toBe(button());
    await vi.advanceTimersByTimeAsync(0);
    expect(beacon).toHaveBeenCalledTimes(1);
    expect(sentFacts()).toEqual({ key: 'public-key', kind: 'product_page', productDetected: true, placement: 'inline', spotMissing: true });
  });

  it('floating: a fixed pill on the body, reported as floating', async () => {
    engine().mount(adapter({ buttonSettings: { placement: 'floating' } }));
    expect(button().parentElement).toBe(document.body);
    expect(button().classList.contains('gc-tryon-btn--float')).toBe(true);
    expect(button().classList.contains('gc-tryon-btn--float-end')).toBe(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(sentFacts().placement).toBe('floating');
  });

  it('floating sits at the bottom start corner with a 16px gutter above the safe area, hidden under the open sheet', () => {
    engine().mount(adapter({ buttonSettings: { placement: 'floating' } }));
    const css = document.getElementById('gc-tryon-woo-css')!.textContent!;
    expect(css).toContain('.gc-tryon-btn--float{position:fixed;z-index:2147481999;inset-block-end:calc(16px + env(safe-area-inset-bottom,0px));inset-inline-start:16px;');
    expect(css).toContain('.gc-tryon-open .gc-tryon-btn--float{visibility:hidden}');
  });

  it.each([
    // [page direction, chat bubble corner, pill takes the end corner]
    ['ltr', 'pos-br', false],
    ['ltr', 'pos-bl', true],
    ['rtl', 'pos-bl', false],
    ['rtl', 'pos-br', true],
  ] as const)('floating in %s with the chat bubble at %s: end corner %s', (dir, corner, end) => {
    document.documentElement.dir = dir;
    document.body.insertAdjacentHTML('beforeend', `<button data-gc-chat-launcher class="${corner}"></button>`);
    engine().mount(adapter({ buttonSettings: { placement: 'floating' } }));
    expect(button().classList.contains('gc-tryon-btn--float-end')).toBe(end);
    const launcher = document.querySelector<HTMLElement>('[data-gc-chat-launcher]')!;
    expect(launcher.getAttribute('style')).toBeNull();
  });

  it('moves the plugin-printed Woo button to the chosen spot, or floats it, and leaves it on automatic', async () => {
    const woo = '<button class="gc-tryon-btn" data-product-id="42" data-gc-page="1">Try it on</button>';
    document.querySelector('form')!.insertAdjacentHTML('afterend', woo);
    engine().mount(adapter({ injectButton: false, buttonSettings: { placement: 'spot', spot: { selector: 'h1#title', position: 'after' } } }));
    expect(document.querySelector('#title')!.nextElementSibling).toBe(button());
    await vi.advanceTimersByTimeAsync(0);
    expect(sentFacts().placement).toBe('inline');
  });

  it('reports a missing spot for the Woo button and keeps it where the plugin printed it', async () => {
    document.querySelector('form')!.insertAdjacentHTML('afterend', '<button class="gc-tryon-btn" data-product-id="42" data-gc-page="1">Try</button>');
    engine().mount(adapter({ injectButton: false, buttonSettings: { placement: 'spot', spot: { selector: '#gone', position: 'after' } } }));
    expect(document.querySelector('form')!.nextElementSibling).toBe(button());
    await vi.advanceTimersByTimeAsync(0);
    expect(sentFacts()).toMatchObject({ placement: 'inline', spotMissing: true });
  });

  it('placementLater: the Woo button works at once, moves when the placement arrives, and reports only then', async () => {
    document.querySelector('form')!.insertAdjacentHTML('afterend', '<button class="gc-tryon-btn" data-product-id="42" data-gc-page="1">Try</button>');
    const handle = engine().mount(adapter({ injectButton: false, placementLater: true }));
    await vi.advanceTimersByTimeAsync(0);
    expect(beacon).not.toHaveBeenCalled();
    expect(document.querySelector('form')!.nextElementSibling).toBe(button());
    handle.place({ placement: 'spot', spot: { selector: '.fit', position: 'before' } });
    expect(document.querySelector('.fit')!.previousElementSibling).toBe(button());
    await vi.advanceTimersByTimeAsync(0);
    expect(sentFacts()).toEqual({ key: 'public-key', kind: 'product_page', productDetected: true, placement: 'inline' });
    // Once only.
    handle.place({ placement: 'floating' });
    expect(button().parentElement).not.toBe(document.body);
  });

  it('floats the Woo button when floating is chosen', async () => {
    document.querySelector('form')!.insertAdjacentHTML('afterend', '<button class="gc-tryon-btn" data-product-id="42" data-gc-page="1">Try</button>');
    engine().mount(adapter({ injectButton: false, buttonSettings: { placement: 'floating' } }));
    expect(button().parentElement).toBe(document.body);
    await vi.advanceTimersByTimeAsync(0);
    expect(sentFacts().placement).toBe('floating');
  });
});

describe('edit mode boot (gc_pick)', () => {
  it('does nothing for shoppers', () => {
    engine().bootPick('https://grindctrl.cloud');
    expect(fetcher).not.toHaveBeenCalled();
    expect(document.querySelector('[data-gc-pick]')).toBeNull();
  });

  it('takes the link out of the address, keeps it with a claim for this tab, verifies, then loads the versioned editor', async () => {
    window.history.replaceState(null, '', `/products/dress?color=blue&gc_pick=${TOKEN}`);
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, preset: null, button: { buttonLabel: 'Try it on' } }), { status: 200 }));
    engine().bootPick('https://grindctrl.cloud');
    expect(window.location.search).toBe('?color=blue');
    const saved = JSON.parse(window.sessionStorage.getItem('gc_pick')!);
    expect(saved.token).toBe(TOKEN);
    expect(saved.claim).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('https://grindctrl.cloud/api/try-on/pick/verify');
    expect(init).toMatchObject({ method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer' });
    expect(JSON.parse(String(init!.body))).toEqual({ token: TOKEN, claim: saved.claim, locale: 'en' });
    await vi.advanceTimersByTimeAsync(0);
    const script = document.head.querySelector<HTMLScriptElement>('script[src*="pick-spot.js"]')!;
    expect(script.src).toMatch(/^https:\/\/grindctrl\.cloud\/widget\/v1\/pick-spot\.js\?v=[0-9a-f]{12}$/);
    expect(globals.GRINDCTRL_PICK_CONFIG).toMatchObject({ token: TOKEN, claim: saved.claim, appOrigin: 'https://grindctrl.cloud' });
  });

  it('reuses the tab claim on the next page of the same tab', () => {
    window.sessionStorage.setItem('gc_pick', JSON.stringify({ token: TOKEN, claim: 'k'.repeat(43) }));
    fetcher.mockReturnValueOnce(new Promise(() => {}));
    engine().bootPick('https://grindctrl.cloud');
    expect(JSON.parse(String(fetcher.mock.calls[0][1]!.body)).claim).toBe('k'.repeat(43));
  });

  it.each([['en', 'This link has expired. Open Pick a spot again from your dashboard.'], ['ar', 'انتهت صلاحية هذا الرابط. افتح «اختر المكان» مرة أخرى من لوحة التحكم.']])(
    'shows the expired message (%s) for a used or expired link, and forgets it', async (lang, text) => {
      document.documentElement.lang = lang;
      window.history.replaceState(null, '', `/products/dress?gc_pick=${TOKEN}`);
      fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ code: 'expired' }), { status: 410 }));
      engine().bootPick('https://grindctrl.cloud');
      await vi.advanceTimersByTimeAsync(0);
      const host = document.querySelector('[data-gc-pick]')!;
      expect(host.shadowRoot!.textContent).toContain(text);
      expect(window.sessionStorage.getItem('gc_pick')).toBeNull();
      expect(document.head.querySelector('script[src*="pick-spot.js"]')).toBeNull();
    });

  it('never calls the server for a link past its expiry', () => {
    const old = TOKEN.replace(/\.\d{13}\./, '.' + (Date.now() - 1000) + '.');
    window.history.replaceState(null, '', `/products/dress?gc_pick=${old}`);
    engine().bootPick('https://grindctrl.cloud');
    expect(fetcher).not.toHaveBeenCalled();
    expect(document.querySelector('[data-gc-pick]')).not.toBeNull();
  });

  it('retries a dropped connection once before giving up', async () => {
    window.history.replaceState(null, '', `/products/dress?gc_pick=${TOKEN}`);
    fetcher.mockRejectedValueOnce(new TypeError('offline')).mockRejectedValueOnce(new TypeError('offline'));
    engine().bootPick('https://grindctrl.cloud');
    await vi.advanceTimersByTimeAsync(1600);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(document.querySelector('[data-gc-pick]')).not.toBeNull();
  });
});

describe('live preview', () => {
  it('moves the real button above or below, then puts it back on cancel', () => {
    engine().mount(adapter());
    const real = button();
    const fit = document.querySelector('.fit')!;
    expect(engine().preview(fit, 'before')).toBe(real);
    expect(fit.previousElementSibling).toBe(real);
    engine().preview(fit, 'after');
    expect(fit.nextElementSibling).toBe(real);
    // The page re-rendering does not pull it back while previewing.
    engine().endPreview(false);
    expect(document.querySelector('#buy')!.nextElementSibling).toBe(real);
  });

  it('keeps the button at the saved spot', () => {
    engine().mount(adapter());
    engine().preview(document.querySelector('#title')!, 'after');
    engine().endPreview(true);
    expect(document.querySelector('#title')!.nextElementSibling).toBe(button());
  });

  it('makes a button in the owner look where the page has none, and removes it on cancel', () => {
    vi.stubGlobal('CSS', { supports: () => true });
    const made = engine().preview(document.querySelector('.price')!, 'after', { buttonLabel: 'جرّبها', accentBg: 'rgb(194, 65, 12)' });
    expect(made).not.toBeNull();
    expect(made!.textContent).toContain('جرّبها');
    expect(made!.style.getPropertyValue('--gc-bg')).toBe('rgb(194, 65, 12)');
    expect(document.querySelector('.price')!.nextElementSibling).toBe(made);
    // It never opens a look.
    made!.click();
    expect(document.querySelector('.gc-tryon-sheet')).toBeNull();
    engine().endPreview(false);
    expect(document.querySelector('.gc-tryon-btn')).toBeNull();
  });
});
