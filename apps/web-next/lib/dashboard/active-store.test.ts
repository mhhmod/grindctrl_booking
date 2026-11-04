import { describe, expect, it } from 'vitest';
import {
  activeTenantKey,
  flagStoreOf,
  formatStoreChoice,
  parseStoreChoice,
  resolveActiveStore,
  storeChoiceFromQuery,
  type StoreCandidateShop,
  type StoreCandidateSite,
} from './active-store';

const SITE_ALPHA = '11111111-1111-4111-8111-111111111111';
const SITE_BETA = '22222222-2222-4222-8222-222222222222';
const SITE_WEB = '33333333-3333-4333-8333-333333333333';
const SITE_WOO = '55555555-5555-4555-8555-555555555555';

const shops: StoreCandidateShop[] = [
  { domain: 'alpha.myshopify.com', status: 'installed', lastSeenAt: '2026-10-01T00:00:00Z' },
  { domain: 'beta.myshopify.com', status: 'installed', lastSeenAt: '2026-10-15T00:00:00Z' },
  { domain: 'gone.myshopify.com', status: 'uninstalled', lastSeenAt: '2026-10-16T00:00:00Z' },
];
const sites: StoreCandidateSite[] = [
  { id: SITE_ALPHA, domain: 'Alpha.myshopify.com' },
  { id: SITE_BETA, domain: 'beta.myshopify.com' },
  { id: SITE_WEB, domain: 'maison.example' },
];

describe('storeChoiceFromQuery', () => {
  it('takes a Shopify shop in any case', () => {
    expect(storeChoiceFromQuery({ shop: ' Alpha.MyShopify.com ' })).toEqual({ shop: 'alpha.myshopify.com' });
  });

  it('takes a Store Chat site id', () => {
    expect(storeChoiceFromQuery({ site: SITE_WEB.toUpperCase() })).toEqual({ site: SITE_WEB });
  });

  it('prefers the shop when a link names both', () => {
    expect(storeChoiceFromQuery({ shop: 'beta.myshopify.com', site: SITE_ALPHA })).toEqual({
      shop: 'beta.myshopify.com',
    });
  });

  it.each([
    [{ shop: 'evil.com' }],
    [{ shop: 'beta.myshopify.com.evil.com' }],
    [{ site: 'not-a-uuid' }],
    [{ shop: ['alpha.myshopify.com'] }],
    [{}],
  ])('names nothing for %j', (query) => {
    expect(storeChoiceFromQuery(query)).toBeNull();
  });
});

describe('store choice cookie value', () => {
  it('round-trips a shop and a site', () => {
    for (const choice of [{ shop: 'alpha.myshopify.com' }, { site: SITE_WEB }]) {
      expect(parseStoreChoice(formatStoreChoice(choice))).toEqual(choice);
    }
  });

  it.each([null, undefined, '', 'alpha.myshopify.com', 'shop:evil.com', 'site:nope', 'team:alpha.myshopify.com'])(
    'reads %j as no choice',
    (value) => {
      expect(parseStoreChoice(value)).toBeNull();
    },
  );
});

describe('resolveActiveStore', () => {
  const candidates = { shops, sites };

  it('opens the shop a link names, with its Store Chat site', () => {
    expect(resolveActiveStore(candidates, [{ shop: 'alpha.myshopify.com' }])).toMatchObject({
      shopDomain: 'alpha.myshopify.com',
      siteId: SITE_ALPHA,
    });
  });

  it('maps a Store Chat site on a Shopify store to that shop', () => {
    expect(resolveActiveStore(candidates, [{ site: SITE_BETA }])).toMatchObject({
      shopDomain: 'beta.myshopify.com',
      siteId: SITE_BETA,
    });
  });

  it('keeps a Store Chat site on another website as a store without a shop', () => {
    expect(resolveActiveStore(candidates, [{ site: SITE_WEB }])).toMatchObject({ shopDomain: null, siteId: SITE_WEB });
  });

  it('falls back safely from a store the caller does not own', () => {
    const forged = resolveActiveStore(candidates, [
      { shop: 'someone-else.myshopify.com' },
      { site: '44444444-4444-4444-8444-444444444444' },
    ]);
    expect(forged).toMatchObject({ shopDomain: 'beta.myshopify.com', siteId: SITE_BETA });
  });

  it('takes the first valid choice: the link over the store chosen last', () => {
    expect(
      resolveActiveStore(candidates, [{ shop: 'alpha.myshopify.com' }, { shop: 'beta.myshopify.com' }]).shopDomain,
    ).toBe('alpha.myshopify.com');
    expect(resolveActiveStore(candidates, [null, { site: SITE_ALPHA }]).shopDomain).toBe('alpha.myshopify.com');
  });

  it('still opens an uninstalled shop the caller owns when asked for it', () => {
    expect(resolveActiveStore(candidates, [{ shop: 'gone.myshopify.com' }])).toMatchObject({
      shopDomain: 'gone.myshopify.com',
      siteId: null,
    });
  });

  it('defaults to the most recently active installed shop, not the first or an uninstalled one', () => {
    expect(resolveActiveStore(candidates, [null, null])).toMatchObject({
      shopDomain: 'beta.myshopify.com',
      siteId: SITE_BETA,
    });
  });

  it('defaults to a shop even when none is installed', () => {
    const onlyGone = { shops: [shops[2]], sites };
    expect(resolveActiveStore(onlyGone, []).shopDomain).toBe('gone.myshopify.com');
  });

  it('without shops, opens the first site with a domain, then the first site', () => {
    expect(
      resolveActiveStore({ shops: [], sites: [{ id: SITE_ALPHA, domain: null }, sites[2]] }, []),
    ).toMatchObject({ shopDomain: null, siteId: SITE_WEB });
    expect(resolveActiveStore({ shops: [], sites: [{ id: SITE_ALPHA, domain: null }] }, [])).toMatchObject({
      shopDomain: null,
      siteId: SITE_ALPHA,
    });
  });

  it('has no store for a new account', () => {
    expect(resolveActiveStore({ shops: [], sites: [] }, [{ shop: 'alpha.myshopify.com' }])).toMatchObject({
      shopDomain: null,
      siteId: null,
    });
  });

  it('gives a Shopify store its shop as the tenant', () => {
    expect(resolveActiveStore(candidates, [{ shop: 'alpha.myshopify.com' }])).toEqual({
      shopDomain: 'alpha.myshopify.com',
      siteId: SITE_ALPHA,
      tenantKey: 'alpha.myshopify.com',
      platform: 'shopify',
    });
  });

  it('gives a paired WooCommerce site the site tenant key', () => {
    const woo = { shops, sites: [...sites, { id: SITE_WOO, domain: 'shop.example', woo: true }] };
    expect(resolveActiveStore(woo, [{ site: SITE_WOO }])).toEqual({
      shopDomain: null,
      siteId: SITE_WOO,
      tenantKey: `site:${SITE_WOO}`,
      platform: 'woocommerce',
    });
  });

  it('leaves a Store Chat site without an active connection with no tenant', () => {
    expect(resolveActiveStore(candidates, [{ site: SITE_WEB }])).toMatchObject({ tenantKey: null, platform: null });
  });

  it('prefers the shop when a connected site also sits on a Shopify store', () => {
    const both = { shops, sites: [{ id: SITE_ALPHA, domain: 'alpha.myshopify.com', woo: true }] };
    expect(resolveActiveStore(both, [{ site: SITE_ALPHA }])).toMatchObject({ tenantKey: 'alpha.myshopify.com', platform: 'shopify' });
  });
});

describe('flagStoreOf', () => {
  it('keys a store on its Shopify shop first, then its Store Chat site, and an empty account on nothing', () => {
    expect(flagStoreOf({ shopDomain: 'alpha.myshopify.com', siteId: SITE_ALPHA })).toEqual({ shopDomain: 'alpha.myshopify.com' });
    expect(flagStoreOf({ shopDomain: null, siteId: SITE_WEB })).toEqual({ widgetSiteId: SITE_WEB });
    expect(flagStoreOf({ shopDomain: null, siteId: null })).toBeNull();
  });
});

describe('activeTenantKey', () => {
  it('reads the tenant, falling back to the shop for a plain two-field store', () => {
    expect(activeTenantKey({ shopDomain: null, siteId: SITE_WOO, tenantKey: `site:${SITE_WOO}` })).toBe(`site:${SITE_WOO}`);
    expect(activeTenantKey({ shopDomain: 'alpha.myshopify.com', siteId: null })).toBe('alpha.myshopify.com');
    expect(activeTenantKey({ shopDomain: null, siteId: SITE_WEB })).toBeNull();
  });
});
