// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

/* GET /api/shopify/claim/start mints a short-lived claim token for the shop
   named by a verified Shopify session token — never by the query string or
   body, which anyone loading the URL directly controls. The security
   property under test: only someone who opened this store's Shopify admin
   (proven by a valid session token) can get a token that lets /claim adopt
   that store. */

const verifySessionTokenMock = vi.fn();
vi.mock('@/lib/shopify/session-token', () => ({
  verifySessionToken: (...args: unknown[]) => verifySessionTokenMock(...args),
}));

const ensureShopOwnedSiteMock = vi.fn();
vi.mock('@/lib/messenger/shop-provisioning', () => ({
  ensureShopOwnedSite: (...args: unknown[]) => ensureShopOwnedSiteMock(...args),
}));

const signClaimTokenMock = vi.fn();
vi.mock('@/lib/shopify/claim-token', async () => {
  const actual = await vi.importActual<typeof import('@/lib/shopify/claim-token')>(
    '@/lib/shopify/claim-token',
  );
  return { ...actual, signClaimToken: (...args: unknown[]) => signClaimTokenMock(...args) };
});

import { GET } from './route';

function req(url: string, headers?: Record<string, string>) {
  return new NextRequest(new Request(url, { headers }));
}

describe('GET /api/shopify/claim/start', () => {
  afterEach(() => {
    vi.resetAllMocks();
    delete process.env.SHOPIFY_API_SECRET;
  });

  it('returns 401 and never provisions when the authorization header is missing', async () => {
    process.env.SHOPIFY_API_SECRET = 'secret';

    const response = await GET(req('https://app.example.com/api/shopify/claim/start'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: 'unauthorized' });
    expect(verifySessionTokenMock).not.toHaveBeenCalled();
    expect(ensureShopOwnedSiteMock).not.toHaveBeenCalled();
  });

  it('returns 401 and never provisions when the session token is invalid', async () => {
    process.env.SHOPIFY_API_SECRET = 'secret';
    verifySessionTokenMock.mockReturnValue(null);

    const response = await GET(
      req('https://app.example.com/api/shopify/claim/start', { authorization: 'Bearer bad-token' }),
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: 'unauthorized' });
    expect(verifySessionTokenMock).toHaveBeenCalledWith('bad-token');
    expect(ensureShopOwnedSiteMock).not.toHaveBeenCalled();
  });

  it('provisions and mints a token for the shop from the SESSION TOKEN, ignoring a query-string shop', async () => {
    process.env.SHOPIFY_API_SECRET = 'secret';
    verifySessionTokenMock.mockReturnValue({ shop: 'demo.myshopify.com' });
    ensureShopOwnedSiteMock.mockResolvedValue({ id: 'site-1' });
    signClaimTokenMock.mockReturnValue('signed-claim-token');

    const response = await GET(
      req('https://app.example.com/api/shopify/claim/start?shop=evil.myshopify.com', {
        authorization: 'Bearer good-token',
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ token: 'signed-claim-token' });
    // The whole point: the shop that gets provisioned and signed is the one
    // proven by the session token, never the one an attacker can put in a URL.
    expect(ensureShopOwnedSiteMock).toHaveBeenCalledWith('demo.myshopify.com');
    expect(ensureShopOwnedSiteMock).not.toHaveBeenCalledWith('evil.myshopify.com');
    expect(signClaimTokenMock).toHaveBeenCalledWith('secret', 'demo.myshopify.com');
  });

  it('strips a lowercase "bearer " prefix too', async () => {
    process.env.SHOPIFY_API_SECRET = 'secret';
    verifySessionTokenMock.mockReturnValue({ shop: 'demo.myshopify.com' });
    ensureShopOwnedSiteMock.mockResolvedValue({ id: 'site-1' });
    signClaimTokenMock.mockReturnValue('signed-claim-token');

    const response = await GET(
      req('https://app.example.com/api/shopify/claim/start', { authorization: 'bearer good-token' }),
    );

    expect(response.status).toBe(200);
    expect(verifySessionTokenMock).toHaveBeenCalledWith('good-token');
  });

  it('returns 503 with no token when ensureShopOwnedSite throws', async () => {
    process.env.SHOPIFY_API_SECRET = 'secret';
    verifySessionTokenMock.mockReturnValue({ shop: 'demo.myshopify.com' });
    ensureShopOwnedSiteMock.mockRejectedValue(new Error('db down'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await GET(
      req('https://app.example.com/api/shopify/claim/start', { authorization: 'Bearer good-token' }),
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ error: 'unavailable' });
    expect(body.token).toBeUndefined();
    expect(signClaimTokenMock).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('returns 503 when SHOPIFY_API_SECRET is not configured', async () => {
    // Deliberately not set.
    const response = await GET(
      req('https://app.example.com/api/shopify/claim/start', { authorization: 'Bearer good-token' }),
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ error: 'not_configured' });
    expect(verifySessionTokenMock).not.toHaveBeenCalled();
    expect(ensureShopOwnedSiteMock).not.toHaveBeenCalled();
  });
});
