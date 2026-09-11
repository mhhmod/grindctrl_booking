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

    await ensureShopToken();

    expect(fetchMock).toHaveBeenCalledWith('/api/shopify/session-bootstrap', {
      headers: { authorization: 'Bearer session-token' },
    });
  });

  it('propagates a failure to get the session token, so the caller can retry later', async () => {
    getShopifySessionToken.mockRejectedValue(new Error('App Bridge not ready'));

    await expect(ensureShopToken()).rejects.toThrow('App Bridge not ready');
  });
});
