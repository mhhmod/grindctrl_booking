// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

const getShopifySessionToken = vi.hoisted(() => vi.fn());
vi.mock('@/lib/shopify/app-bridge-client', () => ({ getShopifySessionToken }));

import { startShopifyClaim } from './auto-claim';

describe('startShopifyClaim', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('does not navigate when the store is already linked', async () => {
    getShopifySessionToken.mockResolvedValue('session-token');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ alreadyLinked: true }), {
        headers: { 'content-type': 'application/json' },
      }),
    );
    const navigate = vi.fn();

    await startShopifyClaim(navigate);

    expect(navigate).not.toHaveBeenCalled();
  });

  it('mints a claim with the session token and navigates the top frame', async () => {
    getShopifySessionToken.mockResolvedValue('session-token');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ token: 'claim token/with symbols' }), {
        headers: { 'content-type': 'application/json' },
      }),
    );
    const navigate = vi.fn();

    await startShopifyClaim(navigate);

    expect(fetchMock).toHaveBeenCalledWith('/api/shopify/claim/start', {
      headers: { authorization: 'Bearer session-token' },
    });
    expect(navigate).toHaveBeenCalledWith(
      'https://grindctrl.cloud/claim?token=claim%20token%2Fwith%20symbols',
    );
  });
});
