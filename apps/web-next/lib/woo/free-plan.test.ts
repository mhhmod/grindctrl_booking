// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ subscription: vi.fn(), domains: vi.fn(), rpc: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/messenger/db', () => ({
  getMessengerServiceClient: () => ({
    from: (table: string) => {
      const builder: Record<string, unknown> = {};
      builder.select = vi.fn(() => builder);
      if (table === 'tryon_subscriptions') {
        builder.eq = vi.fn(() => builder);
        builder.maybeSingle = mocks.subscription;
      } else {
        const second = vi.fn(() => mocks.domains());
        builder.eq = vi.fn(() => ({ eq: second }));
      }
      return builder;
    },
    rpc: mocks.rpc,
  }),
}));

import { apexDomain, ensureWooFreePlan } from './free-plan';

const SITE = '11111111-1111-4111-8111-111111111111';
const KEY = `site:${SITE}`;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.subscription.mockResolvedValue({ data: null, error: null });
  mocks.domains.mockResolvedValue({ data: [{ domain: 'shop.example.com', pattern: 'shop.example.com' }], error: null });
  mocks.rpc.mockResolvedValue({ data: 'granted', error: null });
});

describe('apexDomain', () => {
  it.each([
    ['shop.example.com', 'example.com'],
    ['example.com', 'example.com'],
    ['www.example.co.uk', 'example.co.uk'],
    ['store.example.com.eg', 'example.com.eg'],
    ['name.github.io', 'name.github.io'],
    ['a.b.name.vercel.app', 'name.vercel.app'],
  ])('%s counts against %s', (host, apex) => {
    expect(apexDomain(host)).toBe(apex);
  });

  it.each(['github.io', 'localhost', '203.0.113.9', '', 'x.myshopify.com'])('refuses %j', (host) => {
    expect(apexDomain(host)).toBeNull();
  });
});

describe('ensureWooFreePlan', () => {
  it('claims the free plan with the apex of each verified domain', async () => {
    expect(await ensureWooFreePlan(KEY)).toBe('granted');
    expect(mocks.rpc).toHaveBeenCalledWith('claim_site_free_plan', { p_widget_site_id: SITE, p_apexes: ['example.com'] });
  });

  it('does nothing when the store already has its subscription', async () => {
    mocks.subscription.mockResolvedValue({ data: { id: 's1' }, error: null });
    expect(await ensureWooFreePlan(KEY)).toBe('granted');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('waits for a verified domain', async () => {
    mocks.domains.mockResolvedValue({ data: [], error: null });
    expect(await ensureWooFreePlan(KEY)).toBe('no_verified_domain');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('reports a domain another site already holds', async () => {
    mocks.rpc.mockResolvedValue({ data: 'apex_taken', error: null });
    expect(await ensureWooFreePlan(KEY)).toBe('apex_taken');
  });

  it('fails quiet on a read or claim error, and refuses a Shopify key', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect(await ensureWooFreePlan(KEY)).toBe('unavailable');
    mocks.subscription.mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect(await ensureWooFreePlan(KEY)).toBe('unavailable');
    expect(await ensureWooFreePlan('alpha.myshopify.com')).toBe('not_connected');
  });
});
