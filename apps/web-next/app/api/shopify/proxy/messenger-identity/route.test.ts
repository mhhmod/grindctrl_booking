// @vitest-environment node
import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { rateLimitMock } = vi.hoisted(() => ({ rateLimitMock: vi.fn() }));

vi.mock('@/lib/ratelimit', () => {
  const limiter = (name: string) => ({ limit: (id: string) => rateLimitMock(name, id) });
  return {
    publicApiRatelimit: limiter('publicApi'),
    proxyVisitorRatelimit: limiter('proxyVisitor'),
    proxyShopReadRatelimit: limiter('proxyShopRead'),
    proxyShopMintRatelimit: limiter('proxyShopMint'),
    clientIp: () => 'test-ip',
  };
});

import { GET } from './route';

const SECRET = 'shopify-app-secret';
const SID = '2b1e0c5e-8f2a-4c1d-9b7e-3f6a1d2c4b5a';

function signedRequest(extra: Record<string, string> = {}) {
  const params = new URLSearchParams({
    sid: SID,
    shop: 'demo.myshopify.com',
    path_prefix: '/apps/grindctrl',
    timestamp: String(Math.floor(Date.now() / 1000)),
    logged_in_customer_id: '',
    ...extra,
  });
  const pairs = Array.from(params.entries()).map(([key, value]) => `${key}=${value}`).sort();
  params.set('signature', createHmac('sha256', SECRET).update(pairs.join('')).digest('hex'));
  return new NextRequest(`https://app.example.com/api/shopify/proxy/messenger-identity?${params}`);
}

/* Phase zero item 3: Store Chat's identity call arrives from Shopify's
   address too, so it is counted per shop and per loader session. */
describe('GET /api/shopify/proxy/messenger-identity rate limit key', () => {
  beforeEach(() => {
    process.env.SHOPIFY_API_KEY = 'test-only-client-id';
    process.env.SHOPIFY_API_SECRET = SECRET;
    rateLimitMock.mockReset().mockResolvedValue({ success: true, reset: Date.now() + 10_000 });
  });

  afterEach(() => {
    delete process.env.SHOPIFY_API_KEY;
    delete process.env.SHOPIFY_API_SECRET;
  });

  it('counts a signed request against its shop and the loader session', async () => {
    const response = await GET(signedRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ authenticated: false });
    expect(rateLimitMock.mock.calls).toEqual([
      ['proxyVisitor', `mi:demo.myshopify.com:${SID}`],
      ['proxyShopRead', 'mi:demo.myshopify.com'],
    ]);
  });

  it('keys an unsigned request by address and refuses it', async () => {
    const forged = signedRequest();
    forged.nextUrl.searchParams.set('signature', '0'.repeat(64));
    const response = await GET(new NextRequest(forged.nextUrl));
    expect(response.status).toBe(401);
    expect(rateLimitMock.mock.calls).toEqual([['publicApi', 'mi:test-ip']]);
  });

  it('answers 429 when the shop ceiling is spent', async () => {
    rateLimitMock.mockImplementation(async (name: string) => ({
      success: name !== 'proxyShopRead',
      reset: Date.now() + 10_000,
    }));
    const response = await GET(signedRequest());
    expect(response.status).toBe(429);
  });
});
