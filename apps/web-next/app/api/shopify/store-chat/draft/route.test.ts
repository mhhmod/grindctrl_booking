// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { authenticateMock, ensureShopOwnedSiteMock, saveDraftSectionForSiteMock } = vi.hoisted(() => ({
  authenticateMock: vi.fn(),
  ensureShopOwnedSiteMock: vi.fn(),
  saveDraftSectionForSiteMock: vi.fn(),
}));

vi.mock('@/lib/shopify/session-token', () => ({ authenticateShopifyRequest: authenticateMock }));
vi.mock('@/lib/messenger/shop-provisioning', () => ({ ensureShopOwnedSite: ensureShopOwnedSiteMock }));
vi.mock('@/lib/messenger/actions-core', () => ({ saveDraftSectionForSite: saveDraftSectionForSiteMock }));

import { POST } from './route';

function req(body: unknown, headers?: Record<string, string>): NextRequest {
  return new NextRequest(
    new Request('https://grindctrl.cloud/api/shopify/store-chat/draft', {
      method: 'POST',
      headers: { authorization: 'Bearer tok', ...headers },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});
afterEach(() => {
  vi.resetAllMocks();
});

describe('POST /api/shopify/store-chat/draft', () => {
  it('returns 401 when the session token does not verify', async () => {
    authenticateMock.mockReturnValue(null);
    const res = await POST(req({ section: 'appearance', payload: {} }));
    expect(res.status).toBe(401);
    expect(ensureShopOwnedSiteMock).not.toHaveBeenCalled();
  });

  it('resolves the site from the verified shop, never from the body', async () => {
    authenticateMock.mockReturnValue({ shop: 'demo.myshopify.com' });
    ensureShopOwnedSiteMock.mockResolvedValue({ id: 'site-real' });
    saveDraftSectionForSiteMock.mockResolvedValue({ ok: true });

    const res = await POST(req({ siteId: 'attacker-supplied-id', section: 'appearance', payload: { accentColor: '#fff' } }));

    expect(ensureShopOwnedSiteMock).toHaveBeenCalledWith('demo.myshopify.com');
    expect(saveDraftSectionForSiteMock).toHaveBeenCalledWith({ id: 'site-real' }, 'appearance', { accentColor: '#fff' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('maps a failed save to a 400 with the result body', async () => {
    authenticateMock.mockReturnValue({ shop: 'demo.myshopify.com' });
    ensureShopOwnedSiteMock.mockResolvedValue({ id: 'site-real' });
    saveDraftSectionForSiteMock.mockResolvedValue({ ok: false, error: 'Unknown section.' });

    const res = await POST(req({ section: 'nope', payload: {} }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: 'Unknown section.' });
  });

  it('returns 503 when shop provisioning fails', async () => {
    authenticateMock.mockReturnValue({ shop: 'demo.myshopify.com' });
    ensureShopOwnedSiteMock.mockRejectedValue(new Error('db down'));

    const res = await POST(req({ section: 'appearance', payload: {} }));
    expect(res.status).toBe(503);
  });

  it('returns a generic 500 instead of leaking a raw infra error when the save itself throws', async () => {
    authenticateMock.mockReturnValue({ shop: 'demo.myshopify.com' });
    ensureShopOwnedSiteMock.mockResolvedValue({ id: 'site-real' });
    saveDraftSectionForSiteMock.mockRejectedValue(new Error('column "messenger_appearance" does not exist'));

    const res = await POST(req({ section: 'appearance', payload: {} }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: 'Action failed. Please try again.' });
  });
});
