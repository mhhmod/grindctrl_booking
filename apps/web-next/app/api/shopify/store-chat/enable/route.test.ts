// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authenticateMock, ensureShopOwnedSiteMock, setMessengerEnabledForSiteMock } = vi.hoisted(() => ({
  authenticateMock: vi.fn(),
  ensureShopOwnedSiteMock: vi.fn(),
  setMessengerEnabledForSiteMock: vi.fn(),
}));

vi.mock('@/lib/shopify/session-token', () => ({ authenticateShopifyRequest: authenticateMock }));
vi.mock('@/lib/messenger/shop-provisioning', () => ({ ensureShopOwnedSite: ensureShopOwnedSiteMock }));
vi.mock('@/lib/messenger/actions-core', () => ({ setMessengerEnabledForSite: setMessengerEnabledForSiteMock }));
vi.mock('@/lib/messenger/shop-tenancy', () => ({ shopProfileId: (domain: string) => `shop-${domain}` }));

import { POST } from './route';

function req(body: unknown): NextRequest {
  return new NextRequest(
    new Request('https://grindctrl.cloud/api/shopify/store-chat/enable', {
      method: 'POST',
      headers: { authorization: 'Bearer tok' },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('POST /api/shopify/store-chat/enable', () => {
  it('returns 401 without a valid session token', async () => {
    authenticateMock.mockReturnValue(null);
    const res = await POST(req({ enabled: true }));
    expect(res.status).toBe(401);
  });

  it('toggles status for the token-resolved site', async () => {
    authenticateMock.mockReturnValue({ shop: 'demo.myshopify.com' });
    ensureShopOwnedSiteMock.mockResolvedValue({ id: 'site-real' });
    setMessengerEnabledForSiteMock.mockResolvedValue({ ok: true });

    const res = await POST(req({ enabled: true }));

    expect(setMessengerEnabledForSiteMock).toHaveBeenCalledWith({ id: 'site-real' }, 'shop-demo.myshopify.com', true);
    expect(res.status).toBe(200);
  });

  it('coerces a non-boolean enabled to false', async () => {
    authenticateMock.mockReturnValue({ shop: 'demo.myshopify.com' });
    ensureShopOwnedSiteMock.mockResolvedValue({ id: 'site-real' });
    setMessengerEnabledForSiteMock.mockResolvedValue({ ok: true });

    await POST(req({ enabled: 'yes' }));
    expect(setMessengerEnabledForSiteMock).toHaveBeenCalledWith({ id: 'site-real' }, 'shop-demo.myshopify.com', false);
  });
});
