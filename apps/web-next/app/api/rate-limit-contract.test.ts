// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), read: vi.fn(), write: vi.fn(), public: vi.fn(),
  configured: true, provision: vi.fn(), seen: vi.fn(), generate: vi.fn(),
  session: vi.fn(), loadSite: vi.fn(),
}));
vi.mock('@/lib/ratelimit', () => ({
  clientIp: () => '203.0.113.5',
  publicApiRatelimit: { get configured() { return mocks.configured; }, limit: mocks.public },
  merchantReadRatelimit: { get configured() { return mocks.configured; }, limit: mocks.read },
  merchantWriteRatelimit: { get configured() { return mocks.configured; }, limit: mocks.write },
}));
vi.mock('@/lib/shopify/session-token', () => ({ authenticateShopifyRequest: mocks.auth }));
vi.mock('@/lib/messenger/shop-provisioning', () => ({ ensureShopOwnedSite: mocks.provision }));
vi.mock('@/lib/shopify/shops', () => ({ recordTryOnShopSeen: mocks.seen }));
vi.mock('@/lib/try-on/service', async (original) => ({
  ...await original<typeof import('@/lib/try-on/service')>(), generateTryOn: mocks.generate,
}));
vi.mock('@/lib/messenger/public-session', () => ({ resolveShopperSession: mocks.session }));
vi.mock('@/lib/messenger/public-api', async (original) => ({
  ...await original<typeof import('@/lib/messenger/public-api')>(), loadPublicSite: mocks.loadSite,
}));

import { GET as settingsRead, POST as settingsWrite } from './shopify/admin/settings/route';
import { GET as state } from './shopify/store-chat/state/route';
import { POST as draft } from './shopify/store-chat/draft/route';
import { POST as publish } from './shopify/store-chat/publish/route';
import { POST as knowledge } from './shopify/store-chat/knowledge/route';
import { POST as enable } from './shopify/store-chat/enable/route';
import { POST as thread } from './shopify/store-chat/thread/route';
import { POST as generate } from './try-on/generate/route';
import { POST as attachment } from './messenger/attachment/route';
import { POST as send } from './messenger/send/route';

const merchantRoutes = [settingsRead, settingsWrite, state, draft, publish, knowledge, enable, thread];
const request = () => new NextRequest('https://grindctrl.cloud/api/test?shop=attacker.myshopify.com', {
  method: 'POST', body: JSON.stringify({ shop: 'attacker.myshopify.com' }),
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.configured = true;
  mocks.auth.mockReturnValue({ shop: 'verified.myshopify.com' });
  for (const limit of [mocks.read, mocks.write, mocks.public]) {
    limit.mockResolvedValue({ success: false, reset: Date.now() + 30000 });
  }
});

describe('merchant API guard coverage', () => {
  it.each(merchantRoutes)('blocks before database side effects and keys only verified shop (%#)', async (route) => {
    const response = await route(request());
    expect(response.status).toBe(429);
    expect(Number(response.headers.get('Retry-After'))).toBeGreaterThan(0);
    const calls = [...mocks.read.mock.calls, ...mocks.write.mock.calls];
    expect(calls).toEqual([['shop:verified.myshopify.com']]);
    expect(mocks.provision).not.toHaveBeenCalled();
    expect(mocks.seen).not.toHaveBeenCalled();
  });

  it.each(merchantRoutes)('leaves invalid credentials at 401 without charging a shop (%#)', async (route) => {
    mocks.auth.mockReturnValue(null);
    expect((await route(request())).status).toBe(401);
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.write).not.toHaveBeenCalled();
  });

  it.each(merchantRoutes)('fails safely when enforcement is unavailable (%#)', async (route) => {
    mocks.configured = false;
    const response = await route(request());
    expect(response.status).toBe(503);
    expect(response.headers.get('Retry-After')).toBe('30');
    expect(mocks.provision).not.toHaveBeenCalled();
    expect(mocks.seen).not.toHaveBeenCalled();
  });
});

describe('public provider guard coverage', () => {
  it.each([generate, send, attachment])('blocks missing enforcement before parsing/provider/storage work (%#)', async (route) => {
    mocks.configured = false;
    const response = await route(request());
    expect(response.status).toBe(503);
    expect(response.headers.get('Retry-After')).toBe('30');
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.loadSite).not.toHaveBeenCalled();
    expect(mocks.session).not.toHaveBeenCalled();
  });

  it.each([generate, send, attachment])('rejects timeout-success rather than running a provider (%#)', async (route) => {
    mocks.public.mockResolvedValue({ success: true, reason: 'timeout', reset: Date.now() + 5000 });
    const response = await route(request());
    expect(response.status).toBe(503);
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.loadSite).not.toHaveBeenCalled();
    expect(mocks.session).not.toHaveBeenCalled();
  });
});
