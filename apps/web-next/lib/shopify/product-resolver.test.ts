// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getShopToken = vi.hoisted(() => vi.fn());
const adminGraphql = vi.hoisted(() => vi.fn());

vi.mock('./tokens', () => ({ getShopToken }));
vi.mock('./admin', () => ({ adminGraphql }));

import {
  clearStorefrontProductResolverCache,
  ProductResolutionError,
  resolveStorefrontProduct,
  STOREFRONT_PRODUCT_CACHE_TTL_MS,
  TRYON_PRODUCT_BY_HANDLE_QUERY,
  TRYON_VARIANT_BY_ID_QUERY,
} from './product-resolver';

const SHOP = 'demo.myshopify.com';

function variantResponse(
  handle = 'premium-ringer-tee',
  garmentUrl = 'https://cdn.shopify.com/s/files/garment.png',
  fallbackUrl = 'https://cdn.shopify.com/s/files/fallback.png',
) {
  return {
    productVariant: {
      id: 'gid://shopify/ProductVariant/123',
      legacyResourceId: '123',
      media: { nodes: [{ image: { url: garmentUrl } }] },
      product: {
        id: 'gid://shopify/Product/99',
        handle,
        featuredMedia: { image: { url: fallbackUrl } },
      },
    },
  };
}

describe('resolveStorefrontProduct', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearStorefrontProductResolverCache();
    getShopToken.mockResolvedValue({ accessToken: 'shop-token', scopes: 'read_products' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearStorefrontProductResolverCache();
  });

  it('resolves an exact variant against the proven shop', async () => {
    adminGraphql.mockResolvedValue(variantResponse());

    await expect(
      resolveStorefrontProduct({ shop: SHOP, handle: 'premium-ringer-tee', variantId: '123' }),
    ).resolves.toEqual({
      shop: SHOP,
      handle: 'premium-ringer-tee',
      productGid: 'gid://shopify/Product/99',
      variantGid: 'gid://shopify/ProductVariant/123',
      variantId: '123',
      garmentUrl: 'https://cdn.shopify.com/s/files/garment.png',
    });
    expect(getShopToken).toHaveBeenCalledWith(SHOP);
    expect(adminGraphql).toHaveBeenCalledWith({
      shopDomain: SHOP,
      accessToken: 'shop-token',
      query: TRYON_VARIANT_BY_ID_QUERY,
      variables: { id: 'gid://shopify/ProductVariant/123' },
    });
  });

  it('resolves an omitted variant deterministically from the product', async () => {
    adminGraphql.mockResolvedValue({
      product: {
        id: 'gid://shopify/Product/99',
        handle: 'premium-ringer-tee',
        featuredMedia: { image: { url: 'https://cdn.shopify.com/s/files/product.png' } },
        variants: {
          nodes: [{
            id: 'gid://shopify/ProductVariant/123',
            legacyResourceId: '123',
            media: { nodes: [] },
          }],
        },
      },
    });

    await expect(
      resolveStorefrontProduct({ shop: SHOP, handle: 'premium-ringer-tee' }),
    ).resolves.toMatchObject({
      productGid: 'gid://shopify/Product/99',
      variantGid: 'gid://shopify/ProductVariant/123',
      variantId: '123',
      garmentUrl: 'https://cdn.shopify.com/s/files/product.png',
    });
    expect(adminGraphql).toHaveBeenCalledWith(expect.objectContaining({
      query: TRYON_PRODUCT_BY_HANDLE_QUERY,
      variables: { identifier: { handle: 'premium-ringer-tee' } },
    }));
  });

  it('serves a short-lived cache hit without another Admin API request', async () => {
    adminGraphql.mockResolvedValue(variantResponse());
    const input = { shop: SHOP, handle: 'premium-ringer-tee', variantId: '123' };

    const first = await resolveStorefrontProduct(input);
    const second = await resolveStorefrontProduct(input);

    expect(second).toEqual(first);
    expect(getShopToken).toHaveBeenCalledTimes(2);
    expect(adminGraphql).toHaveBeenCalledTimes(1);
  });

  it('coalesces concurrent resolutions for the same canonical key', async () => {
    let finishResolution: ((value: ReturnType<typeof variantResponse>) => void) | undefined;
    adminGraphql.mockImplementationOnce(() => new Promise((resolve) => {
      finishResolution = resolve;
    }));
    const input = { shop: SHOP, handle: 'premium-ringer-tee', variantId: '123' };

    const first = resolveStorefrontProduct(input);
    const second = resolveStorefrontProduct(input);
    await vi.waitFor(() => expect(adminGraphql).toHaveBeenCalledTimes(1));
    finishResolution?.(variantResponse());

    await expect(Promise.all([first, second])).resolves.toEqual([
      expect.objectContaining({ variantGid: 'gid://shopify/ProductVariant/123' }),
      expect.objectContaining({ variantGid: 'gid://shopify/ProductVariant/123' }),
    ]);
    expect(adminGraphql).toHaveBeenCalledTimes(1);
  });

  it('refreshes authoritative product data after the cache TTL expires', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    adminGraphql.mockResolvedValue(variantResponse());
    const input = { shop: SHOP, handle: 'premium-ringer-tee', variantId: '123' };

    await resolveStorefrontProduct(input);
    now.mockReturnValue(1_000_000 + STOREFRONT_PRODUCT_CACHE_TTL_MS);
    await resolveStorefrontProduct(input);

    expect(adminGraphql).toHaveBeenCalledTimes(2);
  });

  it('does not cache failed Admin API resolutions', async () => {
    adminGraphql
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(variantResponse());
    const input = { shop: SHOP, handle: 'premium-ringer-tee', variantId: '123' };

    await expect(resolveStorefrontProduct(input)).rejects.toMatchObject({
      code: 'product_resolution_unavailable',
    });
    await expect(resolveStorefrontProduct(input)).resolves.toMatchObject({
      variantGid: 'gid://shopify/ProductVariant/123',
    });
    expect(adminGraphql).toHaveBeenCalledTimes(2);
  });

  it('rejects a variant that belongs to another product', async () => {
    adminGraphql.mockResolvedValue(variantResponse('other-product'));

    await expect(
      resolveStorefrontProduct({ shop: SHOP, handle: 'premium-ringer-tee', variantId: '123' }),
    ).rejects.toMatchObject({ code: 'variant_not_found' });
  });

  it('fails closed for a missing token, missing scope, or Admin API failure', async () => {
    for (const token of [null, { accessToken: 'shop-token', scopes: 'read_orders' }]) {
      getShopToken.mockResolvedValueOnce(token);
      await expect(
        resolveStorefrontProduct({ shop: SHOP, handle: 'premium-ringer-tee' }),
      ).rejects.toMatchObject({ code: 'product_resolution_unavailable' });
    }

    getShopToken.mockResolvedValueOnce({ accessToken: 'shop-token', scopes: 'read_products' });
    adminGraphql.mockRejectedValueOnce(new Error('network down'));
    await expect(
      resolveStorefrontProduct({ shop: SHOP, handle: 'premium-ringer-tee' }),
    ).rejects.toBeInstanceOf(ProductResolutionError);
  });

  it('rejects an untrusted or absent garment URL from the authoritative response', async () => {
    for (const garmentUrl of ['https://attacker.example/garment.png', '']) {
      adminGraphql.mockResolvedValueOnce(
        variantResponse('premium-ringer-tee', garmentUrl, garmentUrl),
      );
      await expect(
        resolveStorefrontProduct({ shop: SHOP, handle: 'premium-ringer-tee', variantId: '123' }),
      ).rejects.toMatchObject({ code: 'garment_unavailable' });
    }
  });
});
