// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getShopToken = vi.hoisted(() => vi.fn());
const adminGraphql = vi.hoisted(() => vi.fn());

vi.mock('@/lib/shopify/tokens', () => ({ getShopToken }));
vi.mock('@/lib/shopify/admin', () => ({ adminGraphql }));

import { getShopOwnerEmail } from './shop-owner';

describe('getShopOwnerEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null without calling Shopify when the shop token is missing', async () => {
    getShopToken.mockResolvedValue(null);

    await expect(getShopOwnerEmail('demo.myshopify.com')).resolves.toBeNull();

    expect(getShopToken).toHaveBeenCalledWith('demo.myshopify.com');
    expect(adminGraphql).not.toHaveBeenCalled();
  });

  it('returns the owner email from Shopify', async () => {
    getShopToken.mockResolvedValue({ accessToken: 'shop-token', scopes: '' });
    adminGraphql.mockResolvedValue({ shop: { email: 'Owner@Example.com' } });

    await expect(getShopOwnerEmail('demo.myshopify.com')).resolves.toBe('Owner@Example.com');

    expect(adminGraphql).toHaveBeenCalledWith({
      shopDomain: 'demo.myshopify.com',
      accessToken: 'shop-token',
      query: 'query ShopOwnerEmail { shop { email } }',
    });
  });

  it('returns null when the Shopify lookup fails', async () => {
    getShopToken.mockResolvedValue({ accessToken: 'shop-token', scopes: '' });
    adminGraphql.mockRejectedValue(new Error('Shopify unavailable'));

    await expect(getShopOwnerEmail('demo.myshopify.com')).resolves.toBeNull();
  });
});
