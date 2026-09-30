import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  consume: vi.fn(),
  owner: vi.fn(),
  ensureSite: vi.fn(),
  transfer: vi.fn(),
}));

vi.mock('@/lib/shopify/session-token', () => ({ authenticateShopifyRequest: mocks.authenticate }));
vi.mock('@/lib/shopify/shop-links', () => ({
  consumeShopLinkCode: mocks.consume,
  getShopOwnerClerkUserId: mocks.owner,
}));
vi.mock('@/lib/messenger/provisioning', () => ({
  ensureMessengerSite: mocks.ensureSite,
  transferShopSite: mocks.transfer,
}));
vi.mock('@/lib/messenger/shop-tenancy', () => ({
  StoreOwnedByAnotherAccountError: class StoreOwnedByAnotherAccountError extends Error {},
}));

import { POST } from './route';
import { StoreOwnedByAnotherAccountError } from '@/lib/messenger/shop-tenancy';

function post(body: unknown) {
  return POST(new Request('https://grindctrl.cloud/api/shopify/admin/link', {
    method: 'POST',
    body: JSON.stringify(body),
  }) as never);
}

describe('POST /api/shopify/admin/link', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.authenticate.mockReturnValue({ shop: 'shop.myshopify.com' });
    mocks.owner.mockResolvedValue('user_owner');
    mocks.ensureSite.mockResolvedValue({ id: 'site' });
  });

  it('rejects a request without a Shopify session', async () => {
    mocks.authenticate.mockReturnValue(null);
    expect((await post({ code: 'ABCD' })).status).toBe(401);
    expect(mocks.consume).not.toHaveBeenCalled();
  });

  it('links Try-On and adopts Store Chat for the same account in one step', async () => {
    mocks.consume.mockResolvedValue('linked');
    const res = await post({ code: 'ABCD-EFGH' });
    expect(await res.json()).toEqual({ outcome: 'linked', storeChat: 'adopted' });
    expect(mocks.consume).toHaveBeenCalledWith('ABCD-EFGH', 'shop.myshopify.com', { replace: false });
    expect(mocks.ensureSite).toHaveBeenCalledWith('user_owner', 'shop.myshopify.com', 'shop.myshopify.com');
  });

  it('passes replace only when explicitly true', async () => {
    mocks.consume.mockResolvedValue('linked');
    await post({ code: 'ABCD', replace: true });
    expect(mocks.consume).toHaveBeenLastCalledWith('ABCD', 'shop.myshopify.com', { replace: true });
    await post({ code: 'ABCD', replace: 'yes' });
    expect(mocks.consume).toHaveBeenLastCalledWith('ABCD', 'shop.myshopify.com', { replace: false });
  });

  it('moves Store Chat to the linked account on a re-link', async () => {
    mocks.consume.mockResolvedValue('linked');
    mocks.transfer.mockResolvedValue(true);
    const res = await post({ code: 'ABCD', replace: true });
    expect(await res.json()).toEqual({ outcome: 'linked', storeChat: 'adopted' });
    expect(mocks.transfer).toHaveBeenCalledWith('shop.myshopify.com', 'user_owner');
    expect(mocks.ensureSite).toHaveBeenCalledWith('user_owner', 'shop.myshopify.com', 'shop.myshopify.com');
  });

  it('never moves Store Chat on a first link', async () => {
    mocks.consume.mockResolvedValue('linked');
    await post({ code: 'ABCD' });
    expect(mocks.transfer).not.toHaveBeenCalled();
  });

  it('keeps the link when Store Chat belongs to another account', async () => {
    mocks.consume.mockResolvedValue('linked');
    mocks.ensureSite.mockRejectedValue(new StoreOwnedByAnotherAccountError('x'));
    expect(await (await post({ code: 'ABCD' })).json()).toEqual({ outcome: 'linked', storeChat: 'owned_elsewhere' });
  });

  it('does not touch Store Chat when the code is not accepted', async () => {
    mocks.consume.mockResolvedValue('expired');
    expect(await (await post({ code: 'ABCD' })).json()).toEqual({ outcome: 'expired' });
    expect(mocks.ensureSite).not.toHaveBeenCalled();
  });
});
