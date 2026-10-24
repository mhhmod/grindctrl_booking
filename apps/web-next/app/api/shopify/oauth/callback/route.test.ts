// @vitest-environment node
import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* Where this callback sends the merchant is the whole point of the flow, and
   it was wrong. Both outcomes redirected to /dashboard/install — a design
   mock that is not in the dashboard nav, hands out a placeholder site key
   (`gc_your_site_key_here`) beside a script URL that 404s in production, and
   reads no query parameter at all. A merchant who clicked "Grant order
   access" was shown installation instructions for a widget that does not
   exist, and was never told whether the grant had succeeded or failed. */

const mocks = vi.hoisted(() => ({
  storeShopToken: vi.fn(async (_input: unknown) => {}),
  requestToken: vi.fn(),
  recordTryOnShopSeen: vi.fn(async () => {}),
}));

vi.mock('@/lib/shopify/tokens', () => ({ acquireShopToken: mocks.storeShopToken, requestShopifyToken: mocks.requestToken }));
vi.mock('@/lib/shopify/shops', () => ({ recordTryOnShopSeen: mocks.recordTryOnShopSeen }));

import { GET } from './route';
import { OAUTH_STATE_COOKIE, OAUTH_APP_COOKIE } from '@/lib/shopify/oauth';

const HOST = 'https://grindctrl.cloud';

function callbackRequest(query: string, cookieState?: string) {
  const request = new NextRequest(`${HOST}/api/shopify/oauth/callback${query}`, {
    headers: { host: 'grindctrl.cloud', 'x-forwarded-proto': 'https' },
  });
  if (cookieState) request.cookies.set(OAUTH_STATE_COOKIE, cookieState);
  return request;
}

beforeEach(() => {
  vi.stubEnv('SHOPIFY_API_SECRET', 'test-secret');
  vi.stubEnv('SHOPIFY_API_KEY', 'test-client-id');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('GET /api/shopify/oauth/callback', () => {
  it('returns a refused merchant to the button they pressed, saying it failed', async () => {
    // No state cookie: the first check this request cannot pass.
    const response = await GET(
      callbackRequest('?shop=grindctrl.myshopify.com&code=abc&state=nope'),
    );

    const location = response.headers.get('location') ?? '';
    expect(location).toBe(`${HOST}/dashboard/store-chat?tab=behaviour&orders=failed`);

    // The old destination told them nothing and offered a snippet that 404s.
    expect(location).not.toContain('/dashboard/install');
  });

  it('never reveals which of the three checks rejected the callback', async () => {
    const misconfigured = await GET(callbackRequest('?shop=grindctrl.myshopify.com&code=abc'));
    vi.stubEnv('SHOPIFY_API_SECRET', '');
    const unconfigured = await GET(callbackRequest('?shop=grindctrl.myshopify.com&code=abc'));

    // Same URL either way — a precise reason tells a prober what to defeat.
    expect(misconfigured.headers.get('location')).toBe(unconfigured.headers.get('location'));
  });
});

it('exchanges a valid callback with the app bound to the authorization cookie', async () => {
  vi.stubEnv('SHOPIFY_APPS', JSON.stringify([{clientId:'app-b',secret:'secret-b'}]));
  const pairs=['shop=demo.myshopify.com','code=test-code','state=test-state'];
  const hmac=createHmac('sha256','secret-b').update([...pairs].sort().join('&')).digest('hex');
  const request=callbackRequest(`?${pairs.join('&')}&hmac=${hmac}`,'test-state');
  request.cookies.set(OAUTH_APP_COOKIE,'app-b');
  const response=await GET(request);
  expect(response.headers.get('location')).toContain('orders=connected');
  const args=vi.mocked(mocks.storeShopToken).mock.calls.at(-1)?.[0] as unknown as {
    appClientId:string;shopDomain:string;exchange:()=>Promise<unknown>;force:boolean;
  };
  expect(args).toMatchObject({appClientId:'app-b',shopDomain:'demo.myshopify.com',force:true});
  await args.exchange();
  expect(mocks.requestToken).toHaveBeenCalledWith('demo.myshopify.com',expect.objectContaining({
    client_id:'app-b',client_secret:'secret-b',code:'test-code',expiring:1,
  }));
});
