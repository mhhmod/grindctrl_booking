// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

const getShopifySessionToken = vi.hoisted(() => vi.fn());
vi.mock('@/lib/shopify/app-bridge-client', () => ({ getShopifySessionToken }));

import { ensureShopToken } from './ensure-shop-token';

describe('ensureShopToken', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('calls the session-bootstrap route with the App Bridge session token', async () => {
    getShopifySessionToken.mockResolvedValue('session-token');
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    expect(await ensureShopToken()).toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledWith('/api/shopify/session-bootstrap', {
      headers: { authorization: 'Bearer session-token' },
    });
  });

  it('propagates a failure to get the session token, so the caller can retry later', async () => {
    getShopifySessionToken.mockRejectedValue(new Error('App Bridge not ready'));

    await expect(ensureShopToken()).rejects.toThrow('App Bridge not ready');
  });

  it('returns distribution-specific pricing metadata after bootstrap completes', async () => {
    getShopifySessionToken.mockResolvedValue('session-token');
    const appPricing = { distribution: 'public', pricingPlansUrl: null, plans: [] };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true, appClientId: 'public-app', appPricing })));
    expect(await ensureShopToken()).toEqual({ ok: true, appClientId: 'public-app', appPricing });
  });

  it('does not treat a failed bootstrap as successful plan metadata', async () => {
    getShopifySessionToken.mockResolvedValue('session-token');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 503 }));
    await expect(ensureShopToken()).rejects.toThrow('Shopify bootstrap failed');
  });
});
