// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

/* GET /api/shopify/session-bootstrap ensures a shop has a stored, correctly-
   scoped Admin API token by exchanging the already-verified App Bridge
   session token for one -- no redirect. This is the fix for the bug where
   no shop, ever, had a token stored: nothing previously triggered any kind
   of exchange automatically on install. */

const verifySessionTokenMock = vi.fn();
vi.mock('@/lib/shopify/session-token', () => ({
  verifySessionToken: (...args: unknown[]) => verifySessionTokenMock(...args),
}));

const getShopTokenMock = vi.fn();
const storeShopTokenMock = vi.fn();
vi.mock('@/lib/shopify/tokens', () => ({
  getShopToken: (...args: unknown[]) => getShopTokenMock(...args),
  storeShopToken: (...args: unknown[]) => storeShopTokenMock(...args),
  hasRequiredScopes: (scopes: string) =>
    ['read_products', 'read_orders', 'write_app_proxy'].every((scope) =>
      scopes.split(',').map((s) => s.trim()).includes(scope),
    ),
}));

const rateLimitMock = vi.fn();
vi.mock('@/lib/ratelimit', () => ({
  publicApiRatelimit: { limit: (...args: unknown[]) => rateLimitMock(...args) },
  clientIp: () => 'test-ip',
}));

import { GET } from './route';

function req(url: string, headers?: Record<string, string>) {
  return new NextRequest(new Request(url, { headers }));
}

describe('GET /api/shopify/session-bootstrap', () => {
  beforeEach(() => {
    process.env.SHOPIFY_API_SECRET = 'secret';
    process.env.SHOPIFY_API_KEY = 'client-id';
    rateLimitMock.mockResolvedValue({ success: true, reset: Date.now() + 10_000 });
    getShopTokenMock.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
    delete process.env.SHOPIFY_API_SECRET;
    delete process.env.SHOPIFY_API_KEY;
  });

  it('returns 401 without exchanging when the authorization header is missing', async () => {
    const response = await GET(req('https://app.example.com/api/shopify/session-bootstrap'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: 'unauthorized' });
    expect(getShopTokenMock).not.toHaveBeenCalled();
  });

  it('returns 401 without exchanging when the session token is invalid', async () => {
    verifySessionTokenMock.mockReturnValue(null);

    const response = await GET(
      req('https://app.example.com/api/shopify/session-bootstrap', { authorization: 'Bearer bad' }),
    );

    expect(response.status).toBe(401);
    expect(getShopTokenMock).not.toHaveBeenCalled();
  });

  it('skips the exchange when a sufficiently-scoped token already exists', async () => {
    verifySessionTokenMock.mockReturnValue({ shop: 'demo.myshopify.com' });
    getShopTokenMock.mockResolvedValue({
      accessToken: 'existing',
      scopes: 'read_products,read_orders,write_app_proxy',
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET(
      req('https://app.example.com/api/shopify/session-bootstrap', { authorization: 'Bearer good' }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, provisioned: 'existing' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(storeShopTokenMock).not.toHaveBeenCalled();
  });

  it('re-exchanges when the existing token is missing a required scope', async () => {
    verifySessionTokenMock.mockReturnValue({ shop: 'demo.myshopify.com' });
    getShopTokenMock.mockResolvedValue({ accessToken: 'stale', scopes: 'read_products' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ access_token: 'fresh-token', scope: 'read_products,read_orders,write_app_proxy' }),
          { status: 200 },
        ),
      ),
    );

    const response = await GET(
      req('https://app.example.com/api/shopify/session-bootstrap', { authorization: 'Bearer good' }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, provisioned: 'exchanged' });
    expect(storeShopTokenMock).toHaveBeenCalledWith({
      shopDomain: 'demo.myshopify.com',
      accessToken: 'fresh-token',
      scopes: 'read_products,read_orders,write_app_proxy',
    });
  });

  it('exchanges the verified session token against Shopify with the correct grant, then stores the result', async () => {
    verifySessionTokenMock.mockReturnValue({ shop: 'demo.myshopify.com' });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ access_token: 'granted-token', scope: 'read_products,read_orders,write_app_proxy' }), {
          status: 200,
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET(
      req('https://app.example.com/api/shopify/session-bootstrap', { authorization: 'Bearer the-id-token' }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, provisioned: 'exchanged' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://demo.myshopify.com/admin/oauth/access_token');
    expect(init.method).toBe('POST');
    const sentBody = JSON.parse(init.body as string);
    expect(sentBody).toEqual({
      client_id: 'client-id',
      client_secret: 'secret',
      grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
      subject_token: 'the-id-token',
      subject_token_type: 'urn:ietf:params:oauth:token-type:id_token',
      requested_token_type: 'urn:shopify:params:oauth:token-type:offline-access-token',
    });

    expect(storeShopTokenMock).toHaveBeenCalledWith({
      shopDomain: 'demo.myshopify.com',
      accessToken: 'granted-token',
      scopes: 'read_products,read_orders,write_app_proxy',
    });
  });

  it('returns 502 without storing when Shopify rejects the exchange', async () => {
    verifySessionTokenMock.mockReturnValue({ shop: 'demo.myshopify.com' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 400 })));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await GET(
      req('https://app.example.com/api/shopify/session-bootstrap', { authorization: 'Bearer good' }),
    );
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toEqual({ error: 'exchange_failed' });
    expect(storeShopTokenMock).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('returns 502 when the exchange call itself throws (network failure)', async () => {
    verifySessionTokenMock.mockReturnValue({ shop: 'demo.myshopify.com' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await GET(
      req('https://app.example.com/api/shopify/session-bootstrap', { authorization: 'Bearer good' }),
    );

    expect(response.status).toBe(502);
    expect(storeShopTokenMock).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('returns 503 when storing the exchanged token fails', async () => {
    verifySessionTokenMock.mockReturnValue({ shop: 'demo.myshopify.com' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ access_token: 'tok', scope: 'read_products' }), { status: 200 })),
    );
    storeShopTokenMock.mockRejectedValue(new Error('encryption key missing'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await GET(
      req('https://app.example.com/api/shopify/session-bootstrap', { authorization: 'Bearer good' }),
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ error: 'store_failed' });
    consoleError.mockRestore();
  });

  it('returns 503 when SHOPIFY_API_SECRET is not configured, without verifying the token', async () => {
    delete process.env.SHOPIFY_API_SECRET;

    const response = await GET(
      req('https://app.example.com/api/shopify/session-bootstrap', { authorization: 'Bearer good' }),
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ error: 'not_configured' });
    expect(verifySessionTokenMock).not.toHaveBeenCalled();
  });

  it('returns 429 and never exchanges when the caller is rate-limited', async () => {
    rateLimitMock.mockResolvedValue({ success: false, reset: Date.now() + 30_000 });

    const response = await GET(
      req('https://app.example.com/api/shopify/session-bootstrap', { authorization: 'Bearer good' }),
    );

    expect(response.status).toBe(429);
    expect(verifySessionTokenMock).not.toHaveBeenCalled();
  });
});
