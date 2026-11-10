// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const source = readFileSync('public/widget/v1/tryon-engine.js', 'utf8');
const globals = window as unknown as Record<string, unknown>;
const beacon = vi.fn<(url: string, data: string) => boolean>(() => true);
const fetcher = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }));
const listeners: Array<[EventTarget, string, EventListenerOrEventListenerObject]> = [];
let saveData = false;
function engine() { return globals.GRINDCTRL_TRYON_ENGINE as { mount: (adapter: Record<string, unknown>) => { refresh: () => void } }; }
function adapter(overrides: Record<string, unknown> = {}) {
  return { signalKey: 'public-key', embedOrigin: 'https://grindctrl.cloud', followsPage: true, injectButton: true,
    detectProduct: () => ({ id: 'dress', title: 'Dress' }), placement: () => ({ node: document.querySelector('#buy'), mode: 'after' }),
    placementTarget: () => document.querySelector('#buy'), lookKey: () => 'dress', buttonLabel: 'Try on', ...overrides };
}
beforeEach(() => {
  vi.useFakeTimers(); saveData = false; beacon.mockClear(); beacon.mockReturnValue(true); fetcher.mockClear();
  delete globals.GRINDCTRL_TRYON_ENGINE;
  document.head.innerHTML = ''; document.body.innerHTML = '<button id="buy">Add to cart</button>';
  for (const target of [document, window]) {
    const add = target.addEventListener.bind(target);
    vi.spyOn(target, 'addEventListener').mockImplementation((type, listener, options) => { if (listener) listeners.push([target, type, listener]); add(type, listener, options); });
  }
  vi.stubGlobal('navigator', Object.create(navigator, { connection: { value: { get saveData() { return saveData; } } }, sendBeacon: { value: beacon } }));
  vi.stubGlobal('fetch', fetcher);
  (0, eval)(source);
});
afterEach(() => {
  for (const [target, type, listener] of listeners.splice(0)) target.removeEventListener(type, listener);
  vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});
const payload = () => JSON.parse(String(beacon.mock.calls[0][1]));
describe('hosted engine health beacon', () => {
  it.each([['after', 'inline'], ['float', 'floating']])('reports %s after mount, once even across remounts', async (mode, placement) => {
    const a = adapter({ placement: () => ({ node: document.querySelector('#buy'), mode }) });
    const handle = engine().mount(a);
    expect(document.querySelector('.gc-tryon-btn')).not.toBeNull(); expect(beacon).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(0);
    expect(payload()).toEqual({ key: 'public-key', kind: 'product_page', productDetected: true, placement });
    handle.refresh(); engine().mount(a); await vi.advanceTimersByTimeAsync(0);
    expect(beacon).toHaveBeenCalledTimes(1);
  });
  it('sends nothing on Save-Data, including a change before the deferred task runs', async () => {
    engine().mount(adapter()); saveData = true; await vi.advanceTimersByTimeAsync(0);
    expect(beacon).not.toHaveBeenCalled(); expect(fetcher).not.toHaveBeenCalled();
    delete globals.GRINDCTRL_TRYON_ENGINE; (0, eval)(source); document.querySelector('.gc-tryon-btn')?.remove();
    engine().mount(adapter()); await vi.advanceTimersByTimeAsync(0); expect(beacon).not.toHaveBeenCalled();
  });
  it('sends detection failure only when the paste adapter identified a product page', async () => {
    engine().mount(adapter({ injectButton: false, productMissing: true }));
    await vi.advanceTimersByTimeAsync(0);
    expect(payload()).toEqual({ key: 'public-key', kind: 'product_page', productDetected: false });
  });
  it('does not report a missing product on an ordinary content page', async () => {
    engine().mount(adapter({ injectButton: false, productMissing: false }));
    await vi.advanceTimersByTimeAsync(0); expect(beacon).not.toHaveBeenCalled();
  });
  it('counts distinct mounted product pills after the listing mount', async () => {
    document.body.innerHTML = '<div id="a"></div><div id="b"></div><div id="c"></div>';
    engine().mount(adapter({ injectButton: false, injectCards: true, findCards: () => ['a', 'b', 'c'].map((id, i) => ({ host: document.getElementById(id), productId: i === 2 ? 'p0' : 'p' + i })) }));
    expect(document.querySelectorAll('.gc-tryon-pill')).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(0);
    expect(payload()).toEqual({ key: 'public-key', kind: 'listing', pills: 2 });
  });
  it('reports native Woo buttons and native catalog pills through the same engine', async () => {
    document.body.innerHTML = '<button class="gc-tryon-btn gc-tryon-btn--card" data-product-id="42">Try</button><button class="gc-tryon-btn gc-tryon-btn--card" data-product-id="42">Try</button>';
    engine().mount(adapter({ injectButton: false })); await vi.advanceTimersByTimeAsync(0);
    expect(payload()).toEqual({ key: 'public-key', kind: 'listing', pills: 1 });
  });
  it('falls back to credential-free keepalive fetch without waiting, with silent errors', async () => {
    beacon.mockReturnValue(false); fetcher.mockRejectedValueOnce(new Error('offline'));
    engine().mount(adapter()); await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledWith('https://grindctrl.cloud/api/store/signals', expect.objectContaining({ method: 'POST', keepalive: true, credentials: 'omit', mode: 'no-cors' }));
  });
});
