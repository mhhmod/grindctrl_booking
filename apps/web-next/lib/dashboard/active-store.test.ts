import { describe, expect, it } from 'vitest';
import {
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
    expect(resolveActiveStore(candidates, [{ shop: 'alpha.myshopify.com' }])).toEqual({
      shopDomain: 'alpha.myshopify.com',
      siteId: SITE_ALPHA,
    });
  });

  it('maps a Store Chat site on a Shopify store to that shop', () => {
    expect(resolveActiveStore(candidates, [{ site: SITE_BETA }])).toEqual({
      shopDomain: 'beta.myshopify.com',
      siteId: SITE_BETA,
    });
  });

  it('keeps a Store Chat site on another website as a store without a shop', () => {
    expect(resolveActiveStore(candidates, [{ site: SITE_WEB }])).toEqual({ shopDomain: null, siteId: SITE_WEB });
  });

  it('falls back safely from a store the caller does not own', () => {
    const forged = resolveActiveStore(candidates, [
      { shop: 'someone-else.myshopify.com' },
      { site: '44444444-4444-4444-8444-444444444444' },
    ]);
    expect(forged).toEqual({ shopDomain: 'beta.myshopify.com', siteId: SITE_BETA });
  });

  it('takes the first valid choice: the link over the store chosen last', () => {
    expect(
      resolveActiveStore(candidates, [{ shop: 'alpha.myshopify.com' }, { shop: 'beta.myshopify.com' }]).shopDomain,
    ).toBe('alpha.myshopify.com');
    expect(resolveActiveStore(candidates, [null, { site: SITE_ALPHA }]).shopDomain).toBe('alpha.myshopify.com');
  });

  it('still opens an uninstalled shop the caller owns when asked for it', () => {
    expect(resolveActiveStore(candidates, [{ shop: 'gone.myshopify.com' }])).toEqual({
      shopDomain: 'gone.myshopify.com',
      siteId: null,
    });
  });

  it('defaults to the most recently active installed shop, not the first or an uninstalled one', () => {
    expect(resolveActiveStore(candidates, [null, null])).toEqual({
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
    ).toEqual({ shopDomain: null, siteId: SITE_WEB });
    expect(resolveActiveStore({ shops: [], sites: [{ id: SITE_ALPHA, domain: null }] }, [])).toEqual({
      shopDomain: null,
      siteId: SITE_ALPHA,
    });
  });

  it('has no store for a new account', () => {
    expect(resolveActiveStore({ shops: [], sites: [] }, [{ shop: 'alpha.myshopify.com' }])).toEqual({
      shopDomain: null,
      siteId: null,
    });
  });
});
