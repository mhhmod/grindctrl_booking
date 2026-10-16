import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  adminGraphql: vi.fn(),
  findSiteByDomain: vi.fn(),
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/shopify/admin', () => ({ adminGraphql: mocks.adminGraphql }));
vi.mock('./shop-tenancy', () => ({ findSiteByDomain: mocks.findSiteByDomain }));
vi.mock('./db', () => ({
  getMessengerServiceClient: () => ({
    from: () => ({
      select: () => ({ eq: mocks.select }),
      insert: mocks.insert,
      update: (values: unknown) => ({ in: (column: string, ids: string[]) => mocks.update(values, ids) }),
    }),
  }),
}));

import {
  fetchShopStorefrontHosts,
  planDomainSync,
  resetDomainSyncThrottle,
  storefrontHost,
  syncShopStorefrontDomains,
} from './shop-domain-sync';

const SHOP = 'maison-noor.myshopify.com';

function graphql(primary: string | null, all: string[] | Error) {
  mocks.adminGraphql.mockImplementation(async ({ query }: { query: string }) => {
    if (query.includes('primaryDomain')) return { shop: { primaryDomain: primary ? { host: primary } : null } };
    if (all instanceof Error) throw all;
    return { shop: { domains: all.map((host) => ({ host })) } };
  });
}

beforeEach(() => {
  resetDomainSyncThrottle();
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.findSiteByDomain.mockResolvedValue({ id: 'site-1', workspace_id: 'ws', domain: SHOP, ownerClerkUserId: 'user_1' });
  mocks.select.mockResolvedValue({ data: [], error: null });
  mocks.insert.mockResolvedValue({ error: null });
  mocks.update.mockResolvedValue({ error: null });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('storefrontHost', () => {
  it('normalizes hosts and leaves out the myshopify host and anything malformed', () => {
    expect(storefrontHost(' WWW.MaisonNoor.com. ')).toBe('www.maisonnoor.com');
    expect(storefrontHost('maison-noor.myshopify.com')).toBeNull();
    expect(storefrontHost('https://maisonnoor.com')).toBeNull();
    expect(storefrontHost('localhost')).toBeNull();
    expect(storefrontHost(42)).toBeNull();
  });
});

describe('fetchShopStorefrontHosts', () => {
  it('returns the primary domain and every other domain, once each', async () => {
    graphql('www.maisonnoor.com', ['www.maisonnoor.com', 'maisonnoor.com', SHOP]);
    expect(await fetchShopStorefrontHosts(SHOP, 'token')).toEqual(['www.maisonnoor.com', 'maisonnoor.com']);
  });

  it('keeps the primary domain when the deprecated list is gone', async () => {
    graphql('www.maisonnoor.com', new Error("Field 'domains' doesn't exist on type 'Shop'"));
    expect(await fetchShopStorefrontHosts(SHOP, 'token')).toEqual(['www.maisonnoor.com']);
  });
});

describe('planDomainSync', () => {
  it('adds new hosts, verifies pending ones, and disables only its own stale rows', () => {
    const plan = planDomainSync(['maisonnoor.com', 'www.maisonnoor.com'], [
      { id: 'pending-by-hand', pattern: 'maisonnoor.com', verification_status: 'pending', verification_method: 'dns_txt' },
      { id: 'ours-stale', pattern: 'old-name.com', verification_status: 'verified', verification_method: 'shopify_admin' },
      { id: 'by-hand-other', pattern: 'blog.example.org', verification_status: 'verified', verification_method: 'dns_txt' },
    ]);
    expect(plan).toEqual({
      insert: ['www.maisonnoor.com'],
      verify: ['pending-by-hand'],
      disable: ['ours-stale'],
    });
  });

  it('writes nothing when everything already matches', () => {
    expect(planDomainSync(['maisonnoor.com'], [
      { id: 'a', pattern: 'maisonnoor.com', verification_status: 'verified', verification_method: 'shopify_admin' },
    ])).toEqual({ insert: [], verify: [], disable: [] });
  });
});

describe('syncShopStorefrontDomains', () => {
  it('writes Shopify-confirmed hosts as verified rows for the shop’s site', async () => {
    graphql('www.maisonnoor.com', ['www.maisonnoor.com']);
    const result = await syncShopStorefrontDomains(SHOP, 'token');

    expect(result.synced).toBe(true);
    expect(mocks.findSiteByDomain).toHaveBeenCalledWith(SHOP);
    expect(mocks.select).toHaveBeenCalledWith('widget_site_id', 'site-1');
    expect(mocks.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        widget_site_id: 'site-1',
        pattern: 'www.maisonnoor.com',
        domain: 'www.maisonnoor.com',
        verification_status: 'verified',
        verification_method: 'shopify_admin',
      }),
    ]);
  });

  it('does nothing for a shop without a Store Chat site', async () => {
    mocks.findSiteByDomain.mockResolvedValue(null);
    expect(await syncShopStorefrontDomains(SHOP, 'token')).toEqual({ synced: false, reason: 'no_site' });
    expect(mocks.adminGraphql).not.toHaveBeenCalled();
  });

  it('never throws, and retries on the next open after a failure', async () => {
    graphql(null, []);
    mocks.adminGraphql.mockRejectedValueOnce(new Error('Shopify Admin API returned 401'));
    expect(await syncShopStorefrontDomains(SHOP, 'token')).toEqual({ synced: false, reason: 'error' });

    graphql('maisonnoor.com', []);
    expect((await syncShopStorefrontDomains(SHOP, 'token')).synced).toBe(true);
  });

  it('runs at most once every five minutes per shop', async () => {
    graphql('maisonnoor.com', []);
    await syncShopStorefrontDomains(SHOP, 'token');
    expect(await syncShopStorefrontDomains(SHOP, 'token')).toEqual({ synced: false, reason: 'recent' });
    expect(mocks.findSiteByDomain).toHaveBeenCalledTimes(1);
  });
});
