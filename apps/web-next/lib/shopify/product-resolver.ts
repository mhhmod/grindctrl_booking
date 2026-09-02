import 'server-only';

import { adminGraphql } from './admin';
import { normalizeShopDomain } from './shop-authorization';
import { getShopToken } from './tokens';
import { isAllowedGarmentUrl } from '@/lib/try-on/image-runner';
import { validateProductId } from '@/lib/try-on/validator';
import { normalizeVariantId } from '@/lib/try-on/storefront-context';

/* The App Proxy proves which shop sent a request, but its product/variant
 * query parameters still originated in browser JS. Resolve those identifiers
 * against that shop's Admin API token before creating a billable capability. */

const PRODUCT_BY_HANDLE_QUERY = `#graphql
  query TryOnProductByHandle($identifier: ProductIdentifierInput!) {
    product: productByIdentifier(identifier: $identifier) {
      id
      handle
      featuredMedia {
        ... on MediaImage { image { url } }
      }
      variants(first: 1) {
        nodes {
          id
          legacyResourceId
          media(first: 1) {
            nodes { ... on MediaImage { image { url } } }
          }
        }
      }
    }
  }
`;

const VARIANT_BY_ID_QUERY = `#graphql
  query TryOnVariantById($id: ID!) {
    productVariant(id: $id) {
      id
      legacyResourceId
      media(first: 1) {
        nodes { ... on MediaImage { image { url } } }
      }
      product {
        id
        handle
        featuredMedia {
          ... on MediaImage { image { url } }
        }
      }
    }
  }
`;

type RawMedia = { image?: { url?: string | null } | null } | null;
type RawVariant = {
  id?: string | null;
  legacyResourceId?: string | number | null;
  media?: { nodes?: RawMedia[] | null } | null;
};
type RawProduct = {
  id?: string | null;
  handle?: string | null;
  featuredMedia?: RawMedia;
  variants?: { nodes?: RawVariant[] | null } | null;
};

export type ResolvedStorefrontProduct = {
  shop: string;
  handle: string;
  productGid: string;
  variantGid: string;
  variantId: string;
  garmentUrl: string;
};

export const STOREFRONT_PRODUCT_CACHE_TTL_MS = 15_000;
const STOREFRONT_PRODUCT_CACHE_MAX_ENTRIES = 100;

type ProductCacheEntry = {
  expiresAt: number;
  product: ResolvedStorefrontProduct;
};

/* Only authoritative, validated product data is cached. Shop access tokens are
 * checked on every request and never become part of either cache key or value. */
const resolvedProductCache = new Map<string, ProductCacheEntry>();
const inFlightResolutions = new Map<string, Promise<ResolvedStorefrontProduct>>();

export type ProductResolutionCode =
  | 'product_resolution_unavailable'
  | 'product_not_found'
  | 'variant_not_found'
  | 'garment_unavailable';

export class ProductResolutionError extends Error {
  constructor(readonly code: ProductResolutionCode) {
    super(code);
    this.name = 'ProductResolutionError';
  }
}

function hasReadProducts(scopes: string): boolean {
  return scopes.split(',').some((scope) => scope.trim() === 'read_products');
}

function resolutionCacheKey(shop: string, handle: string, variantId: string | null): string {
  return JSON.stringify([shop, handle, variantId]);
}

function cachedProduct(key: string, now = Date.now()): ResolvedStorefrontProduct | null {
  const entry = resolvedProductCache.get(key);
  if (!entry) return null;
  if (now >= entry.expiresAt) {
    resolvedProductCache.delete(key);
    return null;
  }
  return entry.product;
}

function cacheResolvedProduct(key: string, product: ResolvedStorefrontProduct): void {
  const now = Date.now();
  for (const [cachedKey, entry] of resolvedProductCache) {
    if (now >= entry.expiresAt) resolvedProductCache.delete(cachedKey);
  }
  while (resolvedProductCache.size >= STOREFRONT_PRODUCT_CACHE_MAX_ENTRIES) {
    const oldestKey = resolvedProductCache.keys().next().value;
    if (typeof oldestKey !== 'string') break;
    resolvedProductCache.delete(oldestKey);
  }
  resolvedProductCache.set(key, {
    expiresAt: now + STOREFRONT_PRODUCT_CACHE_TTL_MS,
    product: Object.freeze({ ...product }),
  });
}

export function clearStorefrontProductResolverCache(): void {
  resolvedProductCache.clear();
  inFlightResolutions.clear();
}

function canonicalGarmentUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || !isAllowedGarmentUrl(raw)) return null;
  try {
    const url = new URL(raw);
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function mediaUrl(media: RawMedia): string | null {
  return canonicalGarmentUrl(media?.image?.url);
}

function variantMediaUrl(variant: RawVariant | null | undefined): string | null {
  return mediaUrl(variant?.media?.nodes?.[0] ?? null);
}

function requireProductGid(value: unknown): string | null {
  return typeof value === 'string' && /^gid:\/\/shopify\/Product\/[1-9]\d*$/.test(value)
    ? value
    : null;
}

function requireVariantGid(value: unknown): string | null {
  return typeof value === 'string' && /^gid:\/\/shopify\/ProductVariant\/[1-9]\d*$/.test(value)
    ? value
    : null;
}

function mapResolved(input: {
  shop: string;
  handle: string;
  product: RawProduct;
  variant: RawVariant;
}): ResolvedStorefrontProduct {
  const productGid = requireProductGid(input.product.id);
  const variantGid = requireVariantGid(input.variant.id);
  const variantId = normalizeVariantId(String(input.variant.legacyResourceId ?? ''));
  if (!productGid || !variantGid || !variantId) {
    throw new ProductResolutionError('product_resolution_unavailable');
  }

  const garmentUrl =
    variantMediaUrl(input.variant) ?? mediaUrl(input.product.featuredMedia ?? null);
  if (!garmentUrl) throw new ProductResolutionError('garment_unavailable');

  return {
    shop: input.shop,
    handle: input.handle,
    productGid,
    variantGid,
    variantId,
    garmentUrl,
  };
}

async function resolveAuthoritativeProduct(input: {
  shop: string;
  handle: string;
  variantId: string | null;
  accessToken: string;
}): Promise<ResolvedStorefrontProduct> {
  try {
    if (input.variantId) {
      const data = await adminGraphql<{ productVariant?: (RawVariant & { product?: RawProduct | null }) | null }>({
        shopDomain: input.shop,
        accessToken: input.accessToken,
        query: VARIANT_BY_ID_QUERY,
        variables: { id: `gid://shopify/ProductVariant/${input.variantId}` },
      });
      const variant = data.productVariant;
      const product = variant?.product;
      if (!variant || !product || product.handle !== input.handle) {
        throw new ProductResolutionError('variant_not_found');
      }
      if (String(variant.legacyResourceId ?? '') !== input.variantId) {
        throw new ProductResolutionError('variant_not_found');
      }
      return mapResolved({ shop: input.shop, handle: input.handle, product, variant });
    }

    const data = await adminGraphql<{ product?: RawProduct | null }>({
      shopDomain: input.shop,
      accessToken: input.accessToken,
      query: PRODUCT_BY_HANDLE_QUERY,
      variables: { identifier: { handle: input.handle } },
    });
    const product = data.product;
    if (!product || product.handle !== input.handle) {
      throw new ProductResolutionError('product_not_found');
    }
    const variant = product.variants?.nodes?.[0];
    if (!variant) throw new ProductResolutionError('variant_not_found');
    return mapResolved({ shop: input.shop, handle: input.handle, product, variant });
  } catch (error) {
    if (error instanceof ProductResolutionError) throw error;
    throw new ProductResolutionError('product_resolution_unavailable');
  }
}

export async function resolveStorefrontProduct(input: {
  shop: unknown;
  handle: unknown;
  variantId?: unknown;
}): Promise<ResolvedStorefrontProduct> {
  const shop = normalizeShopDomain(input.shop);
  const handle = typeof input.handle === 'string' ? input.handle : '';
  if (!shop || !validateProductId(handle).ok) {
    throw new ProductResolutionError('product_not_found');
  }
  const variantId = normalizeVariantId(input.variantId);
  if (input.variantId !== undefined && input.variantId !== null && input.variantId !== '' && !variantId) {
    throw new ProductResolutionError('variant_not_found');
  }

  const token = await getShopToken(shop);
  if (!token || !hasReadProducts(token.scopes)) {
    throw new ProductResolutionError('product_resolution_unavailable');
  }

  const key = resolutionCacheKey(shop, handle, variantId);
  const cached = cachedProduct(key);
  if (cached) return cached;

  const pending = inFlightResolutions.get(key);
  if (pending) return pending;

  const resolution = resolveAuthoritativeProduct({
    shop,
    handle,
    variantId,
    accessToken: token.accessToken,
  });
  if (inFlightResolutions.size < STOREFRONT_PRODUCT_CACHE_MAX_ENTRIES) {
    inFlightResolutions.set(key, resolution);
  }

  try {
    const product = await resolution;
    cacheResolvedProduct(key, product);
    return product;
  } finally {
    if (inFlightResolutions.get(key) === resolution) {
      inFlightResolutions.delete(key);
    }
  }
}

export const TRYON_PRODUCT_BY_HANDLE_QUERY = PRODUCT_BY_HANDLE_QUERY;
export const TRYON_VARIANT_BY_ID_QUERY = VARIANT_BY_ID_QUERY;
