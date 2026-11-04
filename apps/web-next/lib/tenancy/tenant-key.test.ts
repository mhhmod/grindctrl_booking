import { describe, expect, it } from 'vitest';
import {
  isSiteTenantKey,
  normalizeTenantKey,
  siteTenantKey,
  tenantPlatform,
} from './tenant-key';

const siteId = '019A4F0C-2D31-7B6E-8F45-123456789ABC';
const canonicalSiteKey = 'site:019a4f0c-2d31-7b6e-8f45-123456789abc';

describe('siteTenantKey', () => {
  it('builds a lowercase, canonical site tenant key', () => {
    expect(siteTenantKey(`  ${siteId}  `)).toBe(canonicalSiteKey);
  });

  it.each(['', 'not-a-uuid', '019a4f0c2d317b6e8f45123456789abc'])(
    'rejects invalid widget site ids (%s)',
    (value) => expect(() => siteTenantKey(value)).toThrow(TypeError),
  );
});

describe('isSiteTenantKey', () => {
  it('accepts only an already-canonical reserved key', () => {
    expect(isSiteTenantKey(canonicalSiteKey)).toBe(true);
    expect(isSiteTenantKey(canonicalSiteKey.toUpperCase())).toBe(false);
    expect(isSiteTenantKey(siteId.toLowerCase())).toBe(false);
    expect(isSiteTenantKey('site:not-a-uuid')).toBe(false);
    expect(isSiteTenantKey(null)).toBe(false);
  });
});

describe('normalizeTenantKey', () => {
  it('delegates Shopify normalization to normalizeShopDomain', () => {
    expect(normalizeTenantKey('  Demo-Store.MyShopify.com  '))
      .toBe('demo-store.myshopify.com');
  });

  it('normalizes a site key to its reserved lowercase form', () => {
    expect(normalizeTenantKey(`  SITE:${siteId}  `)).toBe(canonicalSiteKey);
  });

  it.each([
    'https://demo.myshopify.com',
    'demo.example.com',
    'site:not-a-uuid',
    siteId,
    null,
    undefined,
  ])('rejects unsupported tenant input (%s)', (value) => {
    expect(normalizeTenantKey(value)).toBeNull();
  });
});

describe('tenantPlatform', () => {
  it('identifies the key namespace without guessing a site connection type', () => {
    expect(tenantPlatform('demo.myshopify.com')).toBe('shopify');
    expect(tenantPlatform(canonicalSiteKey)).toBe('site');
    expect(tenantPlatform('demo.example.com')).toBeNull();
  });
});
