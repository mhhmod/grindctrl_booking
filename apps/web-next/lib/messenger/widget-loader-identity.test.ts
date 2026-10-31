// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { waitFor } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* Phase zero item 15, the signed-in shopper's token. The loader asks the
   App Proxy for a token whenever a customer is signed in, email or not,
   sends only the session id, keeps the token with the customer it was
   issued for, and never lets it speak for anyone else: not after a logout,
   not for the next customer on the same browser, not once it has run out.
   The token reaches the panel over postMessage, never in its address. */
const loader = readFileSync(path.resolve(process.cwd(), 'public/widget/v1/messenger.js'), 'utf8');
const TOKEN_KEY = 'gc_msgr_token_maison.myshopify.com';
const APP = 'https://grindctrl.cloud';

const config = {
  v: 1,
  key: 'pk_test',
  storeName: 'Maison Noor',
  active: true,
  available: true,
  aiEnabled: true,
  attachmentsEnabled: false,
  features: [],
  team: null,
  appearance: { position: 'bottom-right', accentColor: '#222222', launcherIcon: 'chat', launcherLabel: { en: 'Chat', ar: 'محادثة' }, launcherSizePx: 56, radiusStyle: 'soft', languageMode: 'en' },
  behaviour: { greetingEnabled: false, greetingDelaySeconds: 0, greeting: { en: 'Hi', ar: 'مرحبا' }, proactiveEnabled: false, targetingMode: 'all', excludePatterns: [] },
};

let identityAnswer: () => Promise<Response>;
let fetchMock: ReturnType<typeof vi.fn>;

function boot(attrs: Record<string, string> = {}) {
  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/api/messenger/config')) return new Response(JSON.stringify(config), { status: 200 });
    if (url.startsWith((attrs['data-proxy-path'] || '/apps/grindctrl') + '/messenger-identity')) return identityAnswer();
    return new Response('{}', { status: 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
  const script = document.createElement('script');
  script.setAttribute('data-shop', 'maison.myshopify.com');
  script.setAttribute('data-app-origin', APP);
  for (const [name, value] of Object.entries(attrs)) script.setAttribute(name, value);
  Object.defineProperty(document, 'currentScript', { value: script, configurable: true });
  window.eval(loader);
}

function identityCalls() {
  return fetchMock.mock.calls.map((c) => String(c[0])).filter((u) => u.startsWith('/apps/grindctrl/messenger-identity'));
}

function stored() {
  const raw = window.localStorage.getItem(TOKEN_KEY);
  return raw ? (JSON.parse(raw) as { t: string; c: string; at: number }) : null;
}

async function openPanel() {
  const host = () => Array.from(document.body.children).find((el) => (el as HTMLElement).shadowRoot) as HTMLElement | undefined;
  await waitFor(() => expect(host()?.shadowRoot?.querySelector('button.btn')).toBeTruthy());
  host()!.shadowRoot!.querySelector<HTMLButtonElement>('button.btn')!.click();
  await waitFor(() => expect(document.querySelector('iframe')).not.toBeNull());
  // Let the open's frame run before a test ends and the page is cleared.
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  return document.querySelector('iframe')!;
}

function askForIdentity(frame: HTMLIFrameElement) {
  const posted = vi.spyOn(frame.contentWindow!, 'postMessage');
  window.dispatchEvent(new MessageEvent('message', { data: { type: 'grindctrl-messenger:identity-request' }, source: frame.contentWindow }));
  return posted;
}

describe('the signed-in shopper token (item 15)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.localStorage.clear();
    window.sessionStorage.clear();
    delete (window as { GRINDCTRL_MESSENGER?: unknown }).GRINDCTRL_MESSENGER;
    vi.stubGlobal('requestIdleCallback', vi.fn());
    identityAnswer = async () => new Response(JSON.stringify({ authenticated: true, token: 'tok-for-1001' }), { status: 200 });
  });

  afterEach(() => {
    (window as { GRINDCTRL_MESSENGER?: { close?: () => void } }).GRINDCTRL_MESSENGER?.close?.();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  it('uses a distinct configured B proxy path instead of falling back to A',async()=>{
    boot({'data-customer-id':'1001','data-proxy-path':'/apps/grindctrl-public'});
    await waitFor(()=>expect(fetchMock.mock.calls.some(c=>String(c[0]).startsWith('/apps/grindctrl-public/messenger-identity?'))).toBe(true));
    expect(identityCalls()).toHaveLength(0);
  });
  it('does not fetch with an unsafe configured proxy path',()=>{
    boot({'data-customer-id':'1001','data-proxy-path':'https://evil.example'});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('asks the App Proxy with the session alone, and keeps the token with its customer', async () => {
    boot({ 'data-customer-id': '1001', 'data-customer-email': 'salma@example.com', 'data-customer-name': 'Salma A' });

    await waitFor(() => expect(stored()?.t).toBe('tok-for-1001'));
    const [call] = identityCalls();
    expect(call).toMatch(/^\/apps\/grindctrl\/messenger-identity\?sid=[A-Za-z0-9_-]+$/);
    expect(stored()?.c).toBe('1001');
  });

  it('asks for a customer who signed up with a phone and has no email', async () => {
    boot({ 'data-customer-id': '1001' });
    await waitFor(() => expect(identityCalls()).toHaveLength(1));
  });

  it('hands the panel the token over postMessage, never in its address', async () => {
    boot({ 'data-customer-id': '1001' });
    await waitFor(() => expect(stored()?.t).toBe('tok-for-1001'));

    const frame = await openPanel();
    expect(frame.src).toContain('identity=1');
    expect(frame.src).not.toContain('tok-for-1001');
    expect(frame.src).not.toContain('shopperToken');

    const posted = askForIdentity(frame);
    expect(posted).toHaveBeenCalledWith({ type: 'grindctrl-messenger:identify', token: 'tok-for-1001' }, APP);
  });

  it('drops the token after a logout, and tells the panel nothing is coming', async () => {
    window.localStorage.setItem(TOKEN_KEY, JSON.stringify({ t: 'tok-for-1001', c: '1001', at: Date.now() }));
    boot();

    const frame = await openPanel();
    expect(stored()).toBeNull();
    expect(identityCalls()).toHaveLength(0);
    expect(frame.src).not.toContain('identity=1');
    expect(askForIdentity(frame)).toHaveBeenCalledWith({ type: 'grindctrl-messenger:identify', token: null }, APP);
  });

  it("never sends the last customer's token for the next one on the same browser", async () => {
    window.localStorage.setItem(TOKEN_KEY, JSON.stringify({ t: 'tok-for-1001', c: '1001', at: Date.now() }));
    identityAnswer = async () => new Response(JSON.stringify({ authenticated: true, token: 'tok-for-2002' }), { status: 200 });
    boot({ 'data-customer-id': '2002' });

    await waitFor(() => expect(stored()).toEqual(expect.objectContaining({ t: 'tok-for-2002', c: '2002' })));
    const frame = await openPanel();
    const posted = askForIdentity(frame);
    expect(posted).toHaveBeenCalledWith({ type: 'grindctrl-messenger:identify', token: 'tok-for-2002' }, APP);
    expect(posted).not.toHaveBeenCalledWith(expect.objectContaining({ token: 'tok-for-1001' }), APP);
  });

  it('replaces a bare token from an older loader, and one that has run out', async () => {
    window.localStorage.setItem(TOKEN_KEY, 'tok-old-format');
    boot({ 'data-customer-id': '1001' });
    await waitFor(() => expect(stored()?.t).toBe('tok-for-1001'));

    document.body.innerHTML = '';
    delete (window as { GRINDCTRL_MESSENGER?: unknown }).GRINDCTRL_MESSENGER;
    window.localStorage.setItem(TOKEN_KEY, JSON.stringify({ t: 'tok-stale', c: '1001', at: Date.now() - 12 * 60 * 60 * 1000 }));
    identityAnswer = async () => new Response(JSON.stringify({ authenticated: true, token: 'tok-fresh' }), { status: 200 });
    boot({ 'data-customer-id': '1001' });
    await waitFor(() => expect(stored()?.t).toBe('tok-fresh'));
  });

  it('keeps a fresh token for the same customer without asking again', async () => {
    window.localStorage.setItem(TOKEN_KEY, JSON.stringify({ t: 'tok-for-1001', c: '1001', p:'/apps/grindctrl', at: Date.now() }));
    boot({ 'data-customer-id': '1001' });

    const frame = await openPanel();
    expect(identityCalls()).toHaveLength(0);
    expect(askForIdentity(frame)).toHaveBeenCalledWith({ type: 'grindctrl-messenger:identify', token: 'tok-for-1001' }, APP);
  });
  it('reacquires B identity after a proxy publisher cutover instead of reusing A cache',async()=>{
    window.localStorage.setItem(TOKEN_KEY,JSON.stringify({t:'token-a',c:'1001',p:'/apps/grindctrl',at:Date.now()}));
    identityAnswer=async()=>new Response(JSON.stringify({authenticated:true,token:'token-b'}));
    boot({'data-customer-id':'1001','data-proxy-path':'/apps/grindctrl-public'});
    await waitFor(()=>expect(stored()).toEqual(expect.objectContaining({t:'token-b',p:'/apps/grindctrl-public'})));
    expect(identityCalls()).toHaveLength(0);
    expect(fetchMock.mock.calls.some(c=>String(c[0]).startsWith('/apps/grindctrl-public/messenger-identity?'))).toBe(true);
  });
  it('reverifies cached identity with unknown legacy app-path provenance',async()=>{
    window.localStorage.setItem(TOKEN_KEY,JSON.stringify({t:'unknown-app-token',c:'1001',at:Date.now()}));
    boot({'data-customer-id':'1001'});
    await waitFor(()=>expect(stored()).toEqual(expect.objectContaining({t:'tok-for-1001',p:'/apps/grindctrl'})));
    expect(identityCalls()).toHaveLength(1);
  });

  it('lets a waiting panel go when the App Proxy gives no token', async () => {
    let answer!: (r: Response) => void;
    identityAnswer = () => new Promise<Response>((resolve) => (answer = resolve));
    boot({ 'data-customer-id': '1001' });
    await waitFor(() => expect(identityCalls()).toHaveLength(1));

    const frame = await openPanel();
    expect(frame.src).toContain('identity=1');
    const posted = askForIdentity(frame);
    // Still answering: the panel keeps waiting.
    expect(posted).not.toHaveBeenCalled();

    answer(new Response(JSON.stringify({ authenticated: false }), { status: 200 }));
    await waitFor(() => expect(posted).toHaveBeenCalledWith({ type: 'grindctrl-messenger:identify', token: null }, APP));
    expect(stored()).toBeNull();
  });
});
