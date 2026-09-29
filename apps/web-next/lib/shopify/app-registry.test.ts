// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import {
  findShopifyAppByClientId,
  getConfiguredShopifyApps,
  primaryShopifyApp,
  resolveShopifyApp,
} from './app-registry';

afterEach(() => {
  delete process.env.SHOPIFY_APPS;
  delete process.env.SHOPIFY_API_KEY;
  delete process.env.SHOPIFY_API_SECRET;
});

describe('getConfiguredShopifyApps', () => {
  it('returns nothing when unconfigured', () => {
    expect(getConfiguredShopifyApps()).toEqual([]);
  });

  it('falls back to SHOPIFY_API_KEY/SHOPIFY_API_SECRET alone', () => {
    process.env.SHOPIFY_API_KEY = 'legacy-id';
    process.env.SHOPIFY_API_SECRET = 'legacy-secret';
    expect(getConfiguredShopifyApps()).toEqual([{ clientId: 'legacy-id', secret: 'legacy-secret' }]);
  });

  it('parses SHOPIFY_APPS and appends the fallback pair', () => {
    process.env.SHOPIFY_APPS = JSON.stringify([
      { clientId: 'app-a', secret: 'secret-a' },
      { clientId: 'app-b', secret: 'secret-b' },
    ]);
    process.env.SHOPIFY_API_KEY = 'legacy-id';
    process.env.SHOPIFY_API_SECRET = 'legacy-secret';
    expect(getConfiguredShopifyApps()).toEqual([
      { clientId: 'app-a', secret: 'secret-a' },
      { clientId: 'app-b', secret: 'secret-b' },
      { clientId: 'legacy-id', secret: 'legacy-secret' },
    ]);
  });

  it('deduplicates when the fallback pair also appears in SHOPIFY_APPS', () => {
    process.env.SHOPIFY_APPS = JSON.stringify([{ clientId: 'legacy-id', secret: 'legacy-secret' }]);
    process.env.SHOPIFY_API_KEY = 'legacy-id';
    process.env.SHOPIFY_API_SECRET = 'legacy-secret';
    expect(getConfiguredShopifyApps()).toEqual([{ clientId: 'legacy-id', secret: 'legacy-secret' }]);
  });

  it('ignores invalid JSON without throwing', () => {
    process.env.SHOPIFY_APPS = '{not json';
    process.env.SHOPIFY_API_KEY = 'legacy-id';
    process.env.SHOPIFY_API_SECRET = 'legacy-secret';
    expect(getConfiguredShopifyApps()).toEqual([{ clientId: 'legacy-id', secret: 'legacy-secret' }]);
  });

  it('ignores a non-array JSON value', () => {
    process.env.SHOPIFY_APPS = JSON.stringify({ clientId: 'x', secret: 'y' });
    expect(getConfiguredShopifyApps()).toEqual([]);
  });

  it('drops malformed entries but keeps well-formed ones', () => {
    process.env.SHOPIFY_APPS = JSON.stringify([
      { clientId: 'app-a', secret: 'secret-a' },
      { clientId: 'app-b' },
      { clientId: '', secret: 'secret-c' },
      'not-an-object',
      null,
    ]);
    expect(getConfiguredShopifyApps()).toEqual([{ clientId: 'app-a', secret: 'secret-a' }]);
  });
});

describe('findShopifyAppByClientId', () => {
  it('finds a configured app by client id', () => {
    process.env.SHOPIFY_APPS = JSON.stringify([{ clientId: 'app-a', secret: 'secret-a' }]);
    expect(findShopifyAppByClientId('app-a')).toEqual({ clientId: 'app-a', secret: 'secret-a' });
  });

  it('returns null for an unknown client id', () => {
    process.env.SHOPIFY_APPS = JSON.stringify([{ clientId: 'app-a', secret: 'secret-a' }]);
    expect(findShopifyAppByClientId('unknown')).toBeNull();
  });
});

describe('primaryShopifyApp', () => {
  it('is the first configured app', () => {
    process.env.SHOPIFY_APPS = JSON.stringify([
      { clientId: 'app-a', secret: 'secret-a' },
      { clientId: 'app-b', secret: 'secret-b' },
    ]);
    expect(primaryShopifyApp()).toEqual({ clientId: 'app-a', secret: 'secret-a' });
  });

  it('is null when nothing is configured', () => {
    expect(primaryShopifyApp()).toBeNull();
  });
});

describe('resolveShopifyApp', () => {
  it('returns the first app whose secret satisfies verify', () => {
    process.env.SHOPIFY_APPS = JSON.stringify([
      { clientId: 'app-a', secret: 'secret-a' },
      { clientId: 'app-b', secret: 'secret-b' },
    ]);
    const resolved = resolveShopifyApp((secret) => (secret === 'secret-b' ? 'matched' : null));
    expect(resolved).toEqual({ app: { clientId: 'app-b', secret: 'secret-b' }, value: 'matched' });
  });

  it('returns null when no app matches', () => {
    process.env.SHOPIFY_APPS = JSON.stringify([{ clientId: 'app-a', secret: 'secret-a' }]);
    expect(resolveShopifyApp(() => null)).toBeNull();
  });

  it('returns null when nothing is configured', () => {
    expect(resolveShopifyApp(() => 'x')).toBeNull();
  });
});
