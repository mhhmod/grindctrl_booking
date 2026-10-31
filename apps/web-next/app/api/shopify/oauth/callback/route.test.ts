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
  storeShopToken: vi.fn(async (_input: unknown) => ({ accessToken: 'test-offline-token' })),
  requestToken: vi.fn(),
  recordTryOnShopSeen: vi.fn(async () => {}),
}));

vi.mock('@/lib/shopify/tokens', () => ({ acquireShopToken: mocks.storeShopToken, requestShopifyToken: mocks.requestToken }));
vi.mock('@/lib/shopify/shops', () => ({ recordTryOnShopSeen: mocks.recordTryOnShopSeen }));

import { GET } from './route';
import { OAUTH_STATE_COOKIE, OAUTH_APP_COOKIE } from '@/lib/shopify/oauth';
import { SHOPIFY_ADMIN_API_VERSION } from '@/lib/shopify/admin';

const HOST = 'https://grindctrl.cloud';
const STAGING = 'https://shopify-m1-dev.grindctrl.cloud';
const OWNER = 'gid://shopify/AppInstallation/123';
const fetchMock = vi.fn<typeof fetch>();

function graphqlResponse(data: unknown) {
  return new Response(JSON.stringify({ data }));
}

function signedRequest() {
  const pairs = ['shop=demo.myshopify.com', 'code=test-code', 'state=test-state'];
  const hmac = createHmac('sha256', 'test-secret').update([...pairs].sort().join('&')).digest('hex');
  return callbackRequest(`?${pairs.join('&')}&hmac=${hmac}`, 'test-state');
}

function callbackRequest(query: string, cookieState?: string) {
  const request = new NextRequest(`${HOST}/api/shopify/oauth/callback${query}`, {
    headers: { host: 'grindctrl.cloud', 'x-forwarded-proto': 'https' },
  });
  if (cookieState) request.cookies.set(OAUTH_STATE_COOKIE, cookieState);
  return request;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('SHOPIFY_APPS', '');
  vi.stubEnv('SHOPIFY_API_SECRET', 'test-secret');
  vi.stubEnv('SHOPIFY_API_KEY', 'test-client-id');
  vi.stubEnv('NEXT_PUBLIC_APP_URL', `${STAGING}/shopify/app/test-client-id?ignored=1`);
  fetchMock.mockReset();
  fetchMock.mockResolvedValueOnce(graphqlResponse({ currentAppInstallation: { id: OWNER, metafield: null } }));
  fetchMock.mockResolvedValueOnce(graphqlResponse({ metafieldsSet: { metafields: [{ id: 'gid://shopify/Metafield/1' }], userErrors: [] } }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
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
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never reveals which of the three checks rejected the callback', async () => {
    const misconfigured = await GET(callbackRequest('?shop=grindctrl.myshopify.com&code=abc'));
    vi.stubEnv('SHOPIFY_API_SECRET', '');
    const unconfigured = await GET(callbackRequest('?shop=grindctrl.myshopify.com&code=abc'));

    // Same URL either way — a precise reason tells a prober what to defeat.
    expect(misconfigured.headers.get('location')).toBe(unconfigured.headers.get('location'));
  });
});

describe('installation app origin', () => {
  it.each([HOST, STAGING])('writes the configured %s origin with the acquired installation token', async origin => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', `${origin}/shopify/app/test-client-id?ignored=1`);
    const request = signedRequest();
    request.headers.set('x-forwarded-host', 'other.grindctrl.cloud');
    const response = await GET(request);
    expect(response.headers.get('location')).toContain('orders=connected');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [endpoint, init] = fetchMock.mock.calls[1];
    expect(endpoint).toBe(`https://demo.myshopify.com/admin/api/${SHOPIFY_ADMIN_API_VERSION}/graphql.json`);
    expect(init?.headers).toMatchObject({ 'X-Shopify-Access-Token': 'test-offline-token' });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).query).toContain('currentAppInstallation');
    const body = JSON.parse(String(init?.body));
    expect(body.query).toContain('metafieldsSet');
    expect(body.variables).toEqual({ metafields: [{
      ownerId: OWNER, namespace: 'grindctrl', key: 'app_origin', type: 'url', value: origin,
    }] });
  });

  it('skips the mutation when the installation already has this origin', async () => {
    fetchMock.mockReset().mockResolvedValueOnce(graphqlResponse({
      currentAppInstallation: { id: OWNER, metafield: { value: STAGING } },
    }));
    expect((await GET(signedRequest())).headers.get('location')).toContain('orders=connected');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(['network', 'graphql', 'userErrors', 'missingInstallation', 'missingResult'])(
    'keeps the install connected and logs only safe fields on %s failure', async failure => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      fetchMock.mockReset();
      if (failure === 'missingInstallation') {
        fetchMock.mockResolvedValueOnce(graphqlResponse({ currentAppInstallation: null }));
      } else {
        fetchMock.mockResolvedValueOnce(graphqlResponse({ currentAppInstallation: { id: OWNER, metafield: null } }));
        if (failure === 'network') fetchMock.mockRejectedValueOnce(new Error('test-offline-token'));
        if (failure === 'graphql') fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ errors: [{ message: 'test-offline-token' }] })));
        if (failure === 'userErrors') fetchMock.mockResolvedValueOnce(graphqlResponse({ metafieldsSet: { metafields: [], userErrors: [{ message: 'test-offline-token' }] } }));
        if (failure === 'missingResult') fetchMock.mockResolvedValueOnce(graphqlResponse({ metafieldsSet: null }));
      }
      const response = await GET(signedRequest());
      expect(response.headers.get('location')).toContain('orders=connected');
      expect(response.cookies.get(OAUTH_STATE_COOKIE)?.value).toBe('');
      expect(response.cookies.get(OAUTH_APP_COOKIE)?.value).toBe('');
      expect(warn.mock.calls).toEqual([['[shopify] app origin sync failed', {
        shopDomain: 'demo.myshopify.com', stage: failure === 'missingInstallation' ? 'installation_lookup' : 'metafield_write',
      }]]);
    },
  );

  it.each(['', 'http://localhost:3000', 'garbage', 'https://user:password@example.com'])(
    'does not publish invalid server configuration: %s', async value => {
      vi.stubEnv('NEXT_PUBLIC_APP_URL', value);
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect((await GET(signedRequest())).headers.get('location')).toContain('orders=connected');
      expect(fetchMock).not.toHaveBeenCalled();
      expect(warn.mock.calls).toEqual([['[shopify] app origin sync failed', {
        shopDomain: 'demo.myshopify.com', stage: 'configuration',
      }]]);
    },
  );

  it('does not publish an origin when token acquisition fails', async () => {
    mocks.storeShopToken.mockRejectedValueOnce(new Error('exchange failed'));
    expect((await GET(signedRequest())).headers.get('location')).toContain('orders=failed');
    expect(fetchMock).not.toHaveBeenCalled();
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
