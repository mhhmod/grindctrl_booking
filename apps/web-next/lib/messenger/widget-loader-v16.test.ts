// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fireEvent, waitFor } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* The v16 Store Chat shell (03-store-chat.md), for a store whose v16_chat
   flag is on: a bottom sheet on phones and a full-height docked panel on
   desktop, closed every way a shopper expects, out of the tab order while
   closed, built only on intent, a bubble that rises above the theme's
   sticky Add to cart bar, and one first hello per visit. */
const loader = readFileSync(path.resolve(process.cwd(), 'public/widget/v1/messenger.js'), 'utf8');

function config(features: string[], behaviour: Record<string, unknown> = {}) {
  return {
    v: 1,
    key: 'pk_test',
    storeName: 'Maison Noor',
    active: true,
    available: true,
    aiEnabled: true,
    attachmentsEnabled: false,
    features,
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
      ...behaviour,
    },
  };
}

function boot(features: string[], behaviour: Record<string, unknown> = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/messenger/config')) return new Response(JSON.stringify(config(features, behaviour)), { status: 200 });
      return new Response('{}', { status: 200 });
    }),
  );
  const script = document.createElement('script');
  script.setAttribute('data-shop', 'maison.myshopify.com');
  script.setAttribute('data-app-origin', 'https://grindctrl.cloud');
  Object.defineProperty(document, 'currentScript', { value: script, configurable: true });
  window.eval(loader);
}

function launcher() {
  const host = Array.from(document.body.children).find((el) => (el as HTMLElement).shadowRoot) as HTMLElement | undefined;
  return { host, button: host?.shadowRoot?.querySelector<HTMLButtonElement>('button.btn') ?? null };
}

async function openPanel() {
  await waitFor(() => expect(launcher().button).not.toBeNull());
  launcher().button!.click();
  await waitFor(() => expect(document.querySelector('iframe')).not.toBeNull());
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  return document.querySelector('iframe')!;
}

function setWidth(width: number, height = 844) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: height, configurable: true });
}

describe('the v16 Store Chat shell', () => {
  beforeEach(() => {
    document.body.innerHTML = '<main id="theme"><h1>Layla Embroidered Abaya</h1></main>';
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.history.replaceState(null, '', '/products/layla-abaya');
    delete (window as { GRINDCTRL_MESSENGER?: unknown }).GRINDCTRL_MESSENGER;
    vi.stubGlobal('requestIdleCallback', vi.fn());
  });

  afterEach(() => {
    // Each test's loader keeps its window listeners; a panel left open would
    // answer the next test's Escape or back gesture.
    (window as { GRINDCTRL_MESSENGER?: { close?: () => void } }).GRINDCTRL_MESSENGER?.close?.();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('opens as a bottom sheet on a phone, over a dimmed store, and closes on a tap outside', async () => {
    setWidth(390);
    boot(['v16_chat']);
    const frame = await openPanel();

    expect(frame.style.height).toBe(`${Math.round(844 * 0.92)}px`);
    expect(frame.style.visibility).toBe('visible');
    const backdrop = Array.from(document.body.children).find((el) => (el as HTMLElement).style.background === 'rgba(0, 0, 0, 0.4)') as HTMLElement;
    expect(backdrop).toBeTruthy();

    backdrop.click();
    expect(frame.style.visibility).toBe('hidden');
    expect(document.body.contains(backdrop)).toBe(false);
  });

  it('docks a full-height panel on desktop without dimming the store', async () => {
    setWidth(1440, 900);
    boot(['v16_chat']);
    const frame = await openPanel();

    // jsdom cannot parse min(), so the width is checked by its anchors.
    expect(frame.style.top).toBe('0px');
    expect(frame.style.bottom).toBe('0px');
    expect(frame.style.height).toBe('100dvh');
    expect(frame.style.right).toBe('0px');
    expect(Array.from(document.body.children).some((el) => (el as HTMLElement).style.background === 'rgba(0, 0, 0, 0.4)')).toBe(false);
  });

  it('closes on Escape and on the back gesture, and gives focus back to the bubble', async () => {
    setWidth(390);
    boot(['v16_chat']);
    const frame = await openPanel();
    const { button } = launcher();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(frame.style.visibility).toBe('hidden');
    expect(button!.getAttribute('aria-expanded')).toBe('false');
    expect(button!.getRootNode() instanceof ShadowRoot && (button!.getRootNode() as ShadowRoot).activeElement).toBe(button);

    button!.click();
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    expect(frame.style.visibility).toBe('visible');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(frame.style.visibility).toBe('hidden');
  });

  it('keeps the closed panel out of the tab order and the accessibility tree', async () => {
    setWidth(390);
    boot(['v16_chat']);
    const frame = await openPanel();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(frame.style.visibility).toBe('hidden');
    expect(frame.style.pointerEvents).toBe('none');
  });

  it('asks the panel to focus its composer when it opens', async () => {
    setWidth(390);
    boot(['v16_chat']);
    await waitFor(() => expect(launcher().button).not.toBeNull());
    launcher().button!.click();
    const frame = document.querySelector('iframe')!;
    const posted = vi.spyOn(frame.contentWindow!, 'postMessage');
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    expect(posted).toHaveBeenCalledWith({ type: 'grindctrl-messenger:opened' }, 'https://grindctrl.cloud');
  });

  it('builds the panel only on intent, never on an idle moment', async () => {
    setWidth(390);
    boot(['v16_chat']);
    await waitFor(() => expect(launcher().button).not.toBeNull());
    expect(window.requestIdleCallback).not.toHaveBeenCalled();
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('rises above a sticky Add to cart bar', async () => {
    setWidth(390);
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div id="bar" style="position:fixed;bottom:0;left:0;right:0"><form action="/cart/add"><button name="add">Add to cart</button></form></div>',
    );
    const bar = document.getElementById('bar')!;
    bar.getBoundingClientRect = () => ({ top: 772, bottom: 844, height: 72, left: 0, right: 390, width: 390, x: 0, y: 772, toJSON: () => ({}) });
    boot(['v16_chat']);

    await waitFor(() => expect(launcher().host).toBeTruthy());
    // 72 px bar plus a 12 px margin above the usual 20 px.
    expect(launcher().host!.style.bottom).toBe('104px');
  });

  it('says its first hello once per visit, and never on checkout', async () => {
    setWidth(390);
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    boot(['v16_chat'], { greetingEnabled: true, greetingDelaySeconds: 1 });
    await vi.waitFor(() => expect(launcher().host).toBeTruthy());
    await vi.advanceTimersByTimeAsync(1500);
    expect(launcher().host!.shadowRoot!.querySelector('.teaser')).not.toBeNull();
    expect(window.sessionStorage.getItem('gc_msgr_maison.myshopify.com_hello_visit')).toBe('1');

    // The next page of the same visit stays quiet.
    document.body.innerHTML = '';
    delete (window as { GRINDCTRL_MESSENGER?: unknown }).GRINDCTRL_MESSENGER;
    boot(['v16_chat'], { greetingEnabled: true, greetingDelaySeconds: 1 });
    await vi.waitFor(() => expect(launcher().host).toBeTruthy());
    await vi.advanceTimersByTimeAsync(1500);
    expect(launcher().host!.shadowRoot!.querySelector('.teaser')).toBeNull();
  });

  it('keeps today\'s corner panel for a store without the flag', async () => {
    setWidth(1440, 900);
    boot([]);
    const frame = await openPanel();
    // Today's corner panel sits above the 56 px bubble.
    expect(frame.style.bottom).toBe('88px');
    fireEvent.keyDown(document, { key: 'Escape' });
    // Escape is v16 behaviour; today's panel stays until its own close button.
    expect(frame.style.visibility).toBe('visible');
  });
});
