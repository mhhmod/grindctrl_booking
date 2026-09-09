// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  configured: true,
  publicLimit: vi.fn(),
  pollLimit: vi.fn(),
  loadSite: vi.fn(),
  loadSiteByDomain: vi.fn(),
  resolveSession: vi.fn(),
  settings: vi.fn(),
  entitlement: vi.fn(),
  resolveProduct: vi.fn(),
  provision: vi.fn(),
  job: vi.fn(),
  durableJob: vi.fn(),
  writeEvent: vi.fn(),
}));

vi.mock('@/lib/ratelimit', () => ({
  clientIp: () => '203.0.113.9',
  publicApiRatelimit: {
    get configured() { return mocks.configured; }, limit: mocks.publicLimit,
  },
  tryOnPollRatelimit: {
    get configured() { return mocks.configured; }, limit: mocks.pollLimit,
  },
  merchantReadRatelimit: null,
  merchantWriteRatelimit: null,
  rateLimitedResponse: () => new Response(null, { status: 429 }),
}));
vi.mock('@/lib/messenger/public-api', async (original) => ({
  ...await original<typeof import('@/lib/messenger/public-api')>(),
  loadPublicSite: mocks.loadSite,
  loadPublicSiteByDomain: mocks.loadSiteByDomain,
}));
vi.mock('@/lib/messenger/public-session', () => ({ resolveShopperSession: mocks.resolveSession }));
vi.mock('@/lib/messenger/conversations', async (original) => ({
  ...await original<typeof import('@/lib/messenger/conversations')>(), recordEvent: mocks.writeEvent,
}));
vi.mock('@/lib/try-on/settings', () => ({ getTryOnSettings: mocks.settings }));
vi.mock('@/lib/try-on/entitlement', () => ({ getShopEntitlement: mocks.entitlement }));
vi.mock('@/lib/shopify/product-resolver', async (original) => ({
  ...await original<typeof import('@/lib/shopify/product-resolver')>(), resolveStorefrontProduct: mocks.resolveProduct,
}));
vi.mock('@/lib/messenger/shop-provisioning', () => ({ ensureShopOwnedSite: mocks.provision }));
vi.mock('@/lib/try-on/service', () => ({ getJob: mocks.job }));
vi.mock('@/lib/try-on/persistence', () => ({ loadAuthorizedDurableTryOnJob: mocks.durableJob }));

import { POST as bootstrap } from './messenger/bootstrap/route';
import { GET as sync } from './messenger/sync/route';
import { POST as contact } from './messenger/contact/route';
import { POST as event, OPTIONS as eventOptions } from './messenger/event/route';
import { POST as feedback } from './messenger/feedback/route';
import { GET as messengerConfig } from './messenger/config/route';
import { POST as session } from './try-on/session/route';
import { POST as attempt } from './try-on/attempt/route';
import { GET as jobs } from './try-on/jobs/[jobId]/route';
import { GET as tryOnConfig, OPTIONS as tryOnOptions } from './try-on/config/route';
import { GET as proxyConfig } from './shopify/proxy/config/route';
import { GET as identity } from './shopify/proxy/messenger-identity/route';
import { GET as context } from './shopify/proxy/try-on-context/route';
import { GET as claim } from './shopify/claim/start/route';

const ORIGIN = 'https://store.example.com';
const routes = [
  { name: 'messenger bootstrap', run: bootstrap, prefix: 'mb:' },
  { name: 'messenger sync', run: sync, prefix: 'my:' },
  { name: 'messenger contact', run: contact, prefix: 'mc:' },
  { name: 'messenger event', run: event, prefix: 'me:', cors: ORIGIN },
  { name: 'messenger feedback', run: feedback, prefix: 'mf:' },
  { name: 'messenger config', run: messengerConfig, prefix: 'mconfig:', cors: ORIGIN },
  { name: 'try-on session', run: session, prefix: '' },
  { name: 'try-on attempt', run: attempt, prefix: '' },
  { name: 'try-on jobs', run: (request: NextRequest) => jobs(request, { params: Promise.resolve({ jobId: 'job-test' }) }), prefix: '', poll: true },
  { name: 'try-on config', run: tryOnConfig, prefix: 'tconfig:', cors: '*' },
  { name: 'Shopify proxy config', run: proxyConfig, prefix: 'pc:' },
  { name: 'Shopify proxy identity', run: identity, prefix: 'mi:' },
  { name: 'Shopify proxy context', run: context, prefix: 'tc:' },
  { name: 'Shopify claim start', run: claim, prefix: 'cs:' },
];

function request() {
  return new NextRequest('https://grindctrl.cloud/api/test?shop=attacker.myshopify.com&key=gc_test', {
    method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json' },
    body: JSON.stringify({ shop: 'attacker.myshopify.com', anonymousId: 'attacker-identity' }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.configured = true;
  mocks.publicLimit.mockResolvedValue({ success: true, reset: Date.now() + 60_000 });
  mocks.pollLimit.mockResolvedValue({ success: true, reset: Date.now() + 60_000 });
  mocks.loadSite.mockResolvedValue(null);
  mocks.loadSiteByDomain.mockResolvedValue(null);
  mocks.settings.mockResolvedValue({});
  mocks.entitlement.mockResolvedValue({ available: false });
});
afterEach(() => vi.restoreAllMocks());

describe.each(routes)('$name public enforcement', (route) => {
  it.each(['missing configuration', 'transport failure', 'SDK timeout-success', 'budget exhausted'])(
    'blocks %s before parsing, reading customer data or writing state', async (failure) => {
      const limit = route.poll ? mocks.pollLimit : mocks.publicLimit;
      if (failure === 'missing configuration') mocks.configured = false;
      if (failure === 'transport failure') limit.mockRejectedValue(new Error('private Redis credentials'));
      if (failure === 'SDK timeout-success') limit.mockResolvedValue({ success: true, reason: 'timeout', reset: Date.now() + 30_000 });
      if (failure === 'budget exhausted') limit.mockResolvedValue({ success: false, reset: Date.now() + 30_000 });
      const req = request();
      const parse = vi.spyOn(req, 'json');
      const response = await route.run(req);
      const exhausted = failure === 'budget exhausted';
      expect(response.status).toBe(exhausted ? 429 : 503);
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(Number(response.headers.get('Retry-After'))).toBeGreaterThan(0);
      expect(await response.json()).toMatchObject({
        ok: false, error: exhausted ? 'rate_limited' : 'unavailable',
        retryAfterSeconds: expect.any(Number),
      });
      expect(parse).not.toHaveBeenCalled();
      for (const sideEffect of [mocks.loadSite, mocks.loadSiteByDomain, mocks.resolveSession,
        mocks.settings, mocks.entitlement, mocks.resolveProduct, mocks.provision,
        mocks.job, mocks.durableJob, mocks.writeEvent]) {
        expect(sideEffect).not.toHaveBeenCalled();
      }
      if (failure === 'missing configuration') expect(limit).not.toHaveBeenCalled();
      else expect(limit.mock.calls).toEqual([[`${route.prefix}203.0.113.9`]]);
      expect(route.poll ? mocks.publicLimit : mocks.pollLimit).not.toHaveBeenCalled();
      expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('private Redis credentials');
      if (route.cors) {
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe(route.cors);
        expect(response.headers.get('Access-Control-Expose-Headers')).toContain('Retry-After');
        if (route.cors !== '*') expect(response.headers.get('Vary')).toContain('Origin');
      }
    },
  );
});

it('keeps CORS preflight available without Redis', async () => {
  mocks.configured = false;
  const eventResponse = eventOptions(request());
  const configResponse = await tryOnOptions();
  expect(eventResponse.status).toBe(204);
  expect(eventResponse.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
  expect(configResponse.status).toBe(204);
  expect(configResponse.headers.get('Access-Control-Allow-Origin')).toBe('*');
  expect(mocks.publicLimit).not.toHaveBeenCalled();
  expect(mocks.pollLimit).not.toHaveBeenCalled();
});

it('preserves successful public styling config and its CORS cache policy', async () => {
  mocks.settings.mockResolvedValue({ buttonLabel: 'Try it on', accentBg: '#111111' });
  const response = await tryOnConfig(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ buttonLabel: 'Try it on', accentBg: '#111111' });
  expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  expect(response.headers.get('Cache-Control')).toContain('public, max-age=60');
  expect(mocks.publicLimit).toHaveBeenCalledWith('tconfig:203.0.113.9');
  expect(mocks.settings).toHaveBeenCalledWith('attacker.myshopify.com');
});

it('does not let a warm proxy config cache bypass unavailable enforcement', async () => {
  const req = new NextRequest('https://grindctrl.cloud/api/shopify/proxy/config?shop=cache-probe.myshopify.com');
  const first = await proxyConfig(req);
  expect(first.status).toBe(200);
  expect(mocks.settings).toHaveBeenCalledTimes(1);
  mocks.configured = false;
  const unavailable = await proxyConfig(req);
  expect(unavailable.status).toBe(503);
  expect(unavailable.headers.get('Cache-Control')).toBe('no-store');
  expect(mocks.settings).toHaveBeenCalledTimes(1);
});
