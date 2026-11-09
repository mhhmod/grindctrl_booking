// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signStorefrontContext, signTryOnAttempt, signTryOnSession, verifyTryOnSession } from '@/lib/try-on/storefront-context';
import { demoTurnstileBinding } from '@/lib/paste/turnstile';
import type { DemoLookCounter } from '@/lib/try-on/demo-allowance';

const m = vi.hoisted(() => ({ rate: vi.fn(), active: vi.fn(), generate: vi.fn(), fetch: vi.fn<typeof fetch>(),
  allowance: vi.fn(), ip: { value: '203.0.113.5' }, mode: { value: 'live' } }));
vi.mock('@/lib/ratelimit', () => ({ publicApiRatelimit: { configured: true, limit: m.rate }, clientIp: () => m.ip.value }));
vi.mock('@/lib/shopify/tokens', () => ({ isActiveTenant: m.active }));
vi.mock('@/lib/try-on/service', async (original) => ({ ...await original<object>(), generateTryOn: m.generate, getTryOnMode: () => m.mode.value }));
vi.mock('@/lib/try-on/demo-allowance', async (original) => ({ ...await original<object>(), claimDemoLook: m.allowance }));
import { POST } from './route';
import { POST as attemptPost } from '../attempt/route';
const { claimDemoLook } = await vi.importActual<typeof import('@/lib/try-on/demo-allowance')>('@/lib/try-on/demo-allowance');

const CORE_SECRET = 'test-only-independent-core-signing-key-2026';
const SHOPIFY_SECRET = 'test-shopify-secret';
const PASS_SECRET = '1x0000000000000000000000000000000AA';
const FAIL_SECRET = '2x0000000000000000000000000000000AA';
const PHOTO = 'data:image/png;base64,iVBORw0KGgo=';
const GARMENT = 'https://cdn.shopify.com/s/files/garment.png';
const NONCE = 'abcdefghijklmnopqrstuvwx';
let nonceCounter = 0;

/** The demo's daily sets as Redis would hold them, keyed exactly as the script is. */
function memoryCounter(): DemoLookCounter & { calls: number } {
  const sets = new Map<string, Set<string>>();
  const spent = new Map<string, number>();
  const count: DemoLookCounter = async ([networkKey, spentKey], member, perNetwork, budget) => {
    counter.calls += 1;
    const set = sets.get(networkKey) ?? new Set<string>();
    sets.set(networkKey, set);
    if (set.has(member)) return 1;
    if (set.size >= perNetwork) return 2;
    if ((spent.get(spentKey) ?? 0) >= budget) return 3;
    set.add(member);
    spent.set(spentKey, (spent.get(spentKey) ?? 0) + 1);
    return 1;
  };
  const counter = Object.assign(count, { calls: 0 });
  return counter;
}
let counter = memoryCounter();

function demoAttempt(attemptNonce = `demo-attempt-nonce-${String(++nonceCounter).padStart(6, '0')}`) {
  const session = signTryOnSession(CORE_SECRET, { purpose: 'public-demo', productId: 'premium-ringer-tee' });
  const attempt = signTryOnAttempt(CORE_SECRET, { session: verifyTryOnSession(CORE_SECRET, session.token)!, attemptNonce });
  return { session, attempt };
}
function request(body: Record<string, unknown>, path = 'generate') {
  return new NextRequest(`https://grindctrl.cloud/api/try-on/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
async function demoLook(overrides: Record<string, unknown> = {}, attempt = demoAttempt()) {
  m.fetch.mockImplementation(async (_url, init) => Response.json({ success: new URLSearchParams(init?.body as URLSearchParams).get('secret') === PASS_SECRET,
    hostname: 'grindctrl.cloud', action: 'demo_tryon', cdata: demoTurnstileBinding(attempt.attempt.claims.requestKey) }));
  return POST(request({ sessionId: attempt.session.token, attemptId: attempt.attempt.token, productId: 'premium-ringer-tee',
    photoSource: 'upload', photoReference: 'uploaded-photo', photoData: PHOTO, turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX', ...overrides }));
}

beforeEach(() => {
  vi.resetAllMocks(); vi.stubGlobal('fetch', m.fetch);
  vi.stubEnv('GRINDCTRL_CAPABILITY_SECRET', CORE_SECRET);
  vi.stubEnv('SHOPIFY_API_KEY', 'test-only-client-id'); vi.stubEnv('SHOPIFY_API_SECRET', SHOPIFY_SECRET);
  vi.stubEnv('TURNSTILE_SECRET_KEY', PASS_SECRET); vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', '1x00000000000000000000AA');
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://grindctrl.cloud');
  vi.stubEnv('TRYON_DEMO_DAILY_BUDGET', '');
  m.ip.value = '203.0.113.5'; m.mode.value = 'live';
  m.rate.mockResolvedValue({ success: true, reset: Date.now() + 1000 }); m.active.mockResolvedValue(true);
  m.generate.mockResolvedValue({ jobId: 'job-1', status: 'completed', productId: 'premium-ringer-tee', resultImageUrl: 'data:image/png;base64,AA', meta: {} });
  counter = memoryCounter();
  m.allowance.mockImplementation((input) => claimDemoLook(input, counter));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('public demo attempt', () => {
  it('binds a live demo attempt to the demo Turnstile action', async () => {
    const session = signTryOnSession(CORE_SECRET, { purpose: 'public-demo', productId: 'premium-ringer-tee' });
    const response = await attemptPost(request({ sessionId: session.token, productId: 'premium-ringer-tee', attemptNonce: NONCE }, 'attempt'));
    const { data } = await response.json();
    expect(data.turnstile).toEqual({ siteKey: '1x00000000000000000000AA', action: 'demo_tryon', cData: expect.stringMatching(/^[a-f0-9]{64}$/) });
  });
  it('asks for no check in mock mode, where a demo look costs nothing', async () => {
    m.mode.value = 'mock';
    const session = signTryOnSession(CORE_SECRET, { purpose: 'public-demo', productId: 'premium-ringer-tee' });
    const { data } = await (await attemptPost(request({ sessionId: session.token, productId: 'premium-ringer-tee', attemptNonce: NONCE }, 'attempt'))).json();
    expect(data.turnstile).toBeUndefined();
  });
});

describe('public demo generation, before any provider work', () => {
  it('makes the look after a passed check and counts it once', async () => {
    expect((await demoLook()).status).toBe(200);
    expect(m.fetch).toHaveBeenCalledTimes(1);
    expect(new URLSearchParams(m.fetch.mock.calls[0][1]?.body as URLSearchParams).get('remoteip')).toBe('203.0.113.5');
    expect(m.generate).toHaveBeenCalledWith(expect.objectContaining({ purpose: 'public-demo', shop: null }), 'upload', PHOTO, undefined, undefined, expect.any(Object));
  });
  it('requires a token and refuses a failed check without spending an allowance', async () => {
    const missing = await demoLook({ turnstileToken: undefined });
    expect(missing.status).toBe(403);
    expect(await missing.json()).toMatchObject({ code: 'turnstile_required' });
    vi.stubEnv('TURNSTILE_SECRET_KEY', FAIL_SECRET);
    const failed = await demoLook();
    expect(failed.status).toBe(403);
    expect(await failed.json()).toMatchObject({ code: 'turnstile_failed' });
    expect(counter.calls).toBe(0);
    expect(m.generate).not.toHaveBeenCalled();
  });
  it('refuses a token minted for a pasted store look', async () => {
    const attempt = demoAttempt();
    m.fetch.mockResolvedValue(Response.json({ success: true, hostname: 'grindctrl.cloud', action: 'paste_tryon', cdata: demoTurnstileBinding(attempt.attempt.claims.requestKey) }));
    const response = await POST(request({ sessionId: attempt.session.token, attemptId: attempt.attempt.token, productId: 'premium-ringer-tee',
      photoSource: 'upload', photoReference: 'uploaded-photo', photoData: PHOTO, turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX' }));
    expect(response.status).toBe(403);
    expect(m.generate).not.toHaveBeenCalled();
  });
  it('fails closed without a Turnstile secret', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', '');
    expect((await demoLook()).status).toBe(503);
    expect(m.generate).not.toHaveBeenCalled();
  });
  it('allows three looks per network a day, keying IPv6 by its /64', async () => {
    const addresses = ['2001:db8:1:2::1', '2001:db8:1:2:aaaa::9', '2001:db8:1:2:ffff:ffff:ffff:ffff', '2001:db8:1:2::77'];
    const statuses: number[] = [];
    for (const address of addresses) { m.ip.value = address; statuses.push((await demoLook()).status); }
    expect(statuses).toEqual([200, 200, 200, 429]);
    m.ip.value = '2001:db8:1:3::1';
    expect((await demoLook()).status).toBe(200);
    expect(m.generate).toHaveBeenCalledTimes(4);
  });
  it('answers a reached limit with the friendly demo code and when to come back', async () => {
    for (let i = 0; i < 3; i += 1) await demoLook();
    const response = await demoLook();
    expect(response.status).toBe(429);
    expect(Number(response.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect(Number(response.headers.get('Retry-After'))).toBeLessThanOrEqual(86_400);
    expect(await response.json()).toEqual({ ok: false, code: 'demo_limit',
      message: 'You’ve reached today’s free demo looks. Install GRINDCTRL on your store to keep going.',
      error: 'You’ve reached today’s free demo looks. Install GRINDCTRL on your store to keep going.' });
  });
  it('retrying the same attempt is not a new look', async () => {
    const attempt = demoAttempt();
    for (let i = 0; i < 5; i += 1) expect((await demoLook({}, attempt)).status).toBe(200);
    expect((await demoLook()).status).toBe(200);
    expect((await demoLook()).status).toBe(200);
    expect((await demoLook()).status).toBe(429);
  });
  it('stops every network once the global daily budget is spent', async () => {
    vi.stubEnv('TRYON_DEMO_DAILY_BUDGET', '2');
    const statuses: number[] = [];
    for (const address of ['198.51.100.1', '198.51.100.2', '198.51.100.3']) { m.ip.value = address; statuses.push((await demoLook()).status); }
    expect(statuses).toEqual([200, 200, 429]);
    expect(m.generate).toHaveBeenCalledTimes(2);
  });
  it('fails closed when the allowance store cannot answer', async () => {
    m.allowance.mockImplementation((input) => claimDemoLook(input, async () => { throw new Error('redis down'); }));
    const response = await demoLook();
    expect(response.status).toBe(503);
    expect(m.generate).not.toHaveBeenCalled();
  });
});

describe('paid merchant looks are untouched', () => {
  it('runs a Shopify storefront look in live mode with no demo check or allowance', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', '');
    const context = signStorefrontContext(SHOPIFY_SECRET, { shop: 'proven.myshopify.com', productId: 'premium-ringer-tee', variantId: '123',
      productGid: 'gid://shopify/Product/99', variantGid: 'gid://shopify/ProductVariant/123', canonicalGarmentUrl: GARMENT, nonce: NONCE });
    const session = signTryOnSession(SHOPIFY_SECRET, { purpose: 'storefront', context: context.claims });
    const attempt = signTryOnAttempt(SHOPIFY_SECRET, { session: session.claims, attemptNonce: 'zyxwvutsrqponmlkjihgfedc' });
    for (let i = 0; i < 5; i += 1) {
      const response = await POST(request({ sessionId: session.token, attemptId: attempt.token, productId: 'premium-ringer-tee', variantId: '123',
        storefrontNonce: NONCE, garmentUrl: GARMENT, photoSource: 'upload', photoReference: 'uploaded-photo', photoData: PHOTO }));
      expect(response.status).toBe(200);
    }
    expect(m.fetch).not.toHaveBeenCalled();
    expect(m.allowance).not.toHaveBeenCalled();
    expect(m.generate).toHaveBeenCalledTimes(5);
  });
});
