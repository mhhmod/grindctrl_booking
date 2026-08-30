// apps/web-next/app/api/shopify/store-chat/publish/route.test.ts
// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authenticateMock, ensureShopOwnedSiteMock, publishConfigForSiteMock } = vi.hoisted(() => ({
  authenticateMock: vi.fn(),
  ensureShopOwnedSiteMock: vi.fn(),
  publishConfigForSiteMock: vi.fn(),
}));

vi.mock('@/lib/shopify/session-token', () => ({ authenticateShopifyRequest: authenticateMock }));
vi.mock('@/lib/messenger/shop-provisioning', () => ({ ensureShopOwnedSite: ensureShopOwnedSiteMock }));
vi.mock('@/lib/messenger/actions-core', () => ({ publishConfigForSite: publishConfigForSiteMock }));
vi.mock('@/lib/messenger/shop-tenancy', () => ({ shopProfileId: (domain: string) => `shop-${domain}` }));

import { POST } from './route';

function req(): NextRequest {
  return new NextRequest(
    new Request('https://grindctrl.cloud/api/shopify/store-chat/publish', {
      method: 'POST',
      headers: { authorization: 'Bearer tok' },
    }),
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('POST /api/shopify/store-chat/publish', () => {
  it('returns 401 without a valid session token', async () => {
    authenticateMock.mockReturnValue(null);
    const res = await POST(req());
    expect(res.status).toBe(401);
  });

  it('publishes using the shop profile id as the audit actor', async () => {
    authenticateMock.mockReturnValue({ shop: 'demo.myshopify.com' });
    ensureShopOwnedSiteMock.mockResolvedValue({ id: 'site-real' });
    publishConfigForSiteMock.mockResolvedValue({ ok: true, message: 'Published — live on your store within a minute.' });

    const res = await POST(req());

    expect(publishConfigForSiteMock).toHaveBeenCalledWith({ id: 'site-real' }, 'shop-demo.myshopify.com');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, message: 'Published — live on your store within a minute.' });
  });

  it('maps "nothing to publish" to a 400', async () => {
    authenticateMock.mockReturnValue({ shop: 'demo.myshopify.com' });
    ensureShopOwnedSiteMock.mockResolvedValue({ id: 'site-real' });
    publishConfigForSiteMock.mockResolvedValue({ ok: false, error: 'Nothing to publish yet.' });

    const res = await POST(req());
    expect(res.status).toBe(400);
  });

  it('returns a generic 500 instead of leaking a raw infra error when publishing itself throws', async () => {
    authenticateMock.mockReturnValue({ shop: 'demo.myshopify.com' });
    ensureShopOwnedSiteMock.mockResolvedValue({ id: 'site-real' });
    publishConfigForSiteMock.mockRejectedValue(new Error('deadlock detected'));

    const res = await POST(req());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: 'Action failed. Please try again.' });
  });
});
