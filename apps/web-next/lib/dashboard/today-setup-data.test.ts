// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  launch: vi.fn(),
  lastSeen: vi.fn(),
  shops: vi.fn(),
  sites: vi.fn(),
  /** Rows for a read of tryon_jobs, by whether it asked for test looks only. */
  looks: { any: [] as unknown[], test: [] as unknown[] },
  error: { any: null as null | { message: string }, test: null as null | { message: string } },
}));

vi.mock('@/lib/launch/store-launch', () => ({ getStoreLaunch: mocks.launch }));
vi.mock('@/lib/messenger/conversations', () => ({ getWidgetLastSeenAt: mocks.lastSeen }));
vi.mock('./active-store-server', () => ({ listDashboardShops: mocks.shops, listDashboardSites: mocks.sites }));
vi.mock('@/lib/messenger/db', () => {
  class Query {
    test = false;
    select() { return this; }
    eq(column: string) {
      if (column === 'is_test') this.test = true;
      return this;
    }
    limit() { return this; }
    then(resolve: (value: unknown) => unknown) {
      const which = this.test ? 'test' : 'any';
      const error = mocks.error[which];
      return Promise.resolve(error ? { data: null, error } : { data: mocks.looks[which], error: null }).then(resolve);
    }
  }
  return { getMessengerServiceClient: () => ({ from: () => new Query() }) as unknown as SupabaseClient };
});

import { getTodaySetupFacts } from './today-setup-data';

const NOW = Date.parse('2026-10-02T11:00:00Z');
const SITE = '11111111-1111-4111-8111-111111111111';
const STORE = { shopDomain: 'maison-noor.myshopify.com', siteId: SITE };
const SETUP = { state: 'setup', holdoutShare: null, holdoutStartedAt: null, holdoutEndsAt: null, salt: 'salt' };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.launch.mockResolvedValue(SETUP);
  mocks.lastSeen.mockResolvedValue('2026-10-02T10:58:00Z');
  mocks.shops.mockResolvedValue([{ domain: 'maison-noor.myshopify.com', status: 'installed', lastSeenAt: '2026-10-02T10:00:00Z' }]);
  mocks.sites.mockResolvedValue([{ id: SITE, name: 'Maison Noor', domain: 'maison-noor.myshopify.com' }]);
  mocks.looks = { any: [{ id: 'job_1' }], test: [] };
  mocks.error = { any: null, test: null };
});

describe('getTodaySetupFacts', () => {
  it('reads the store’s name and signals while it is being set up', async () => {
    expect(await getTodaySetupFacts({ activeStore: STORE, holdoutAvailable: true, now: NOW })).toEqual({
      store: 'Maison Noor',
      shop: 'maison-noor.myshopify.com',
      chatSeenAt: '2026-10-02T10:58:00Z',
      storeLook: true,
      testLook: false,
      holdoutAvailable: true,
    });
    expect(mocks.lastSeen).toHaveBeenCalledWith(SITE);
  });

  it('applies in preview too, and not to a live store, a running 50/50 test or one with no launch row', async () => {
    mocks.launch.mockResolvedValueOnce({ ...SETUP, state: 'preview' });
    expect(await getTodaySetupFacts({ activeStore: STORE, holdoutAvailable: false, now: NOW })).not.toBeNull();
    mocks.launch.mockResolvedValueOnce({ ...SETUP, state: 'live' });
    expect(await getTodaySetupFacts({ activeStore: STORE, holdoutAvailable: false, now: NOW })).toBeNull();
    mocks.launch.mockResolvedValueOnce({ ...SETUP, state: 'holdout', holdoutStartedAt: '2026-10-01T00:00:00Z', holdoutEndsAt: '2026-10-15T00:00:00Z' });
    expect(await getTodaySetupFacts({ activeStore: STORE, holdoutAvailable: true, now: NOW })).toBeNull();
    mocks.launch.mockResolvedValueOnce(null);
    expect(await getTodaySetupFacts({ activeStore: STORE, holdoutAvailable: false, now: NOW })).toBeNull();
  });

  it('needs an installed Shopify shop', async () => {
    expect(await getTodaySetupFacts({ activeStore: { shopDomain: null, siteId: SITE }, holdoutAvailable: false, now: NOW })).toBeNull();
    mocks.shops.mockResolvedValueOnce([{ domain: 'maison-noor.myshopify.com', status: 'uninstalled', lastSeenAt: '2026-10-02T10:00:00Z' }]);
    expect(await getTodaySetupFacts({ activeStore: STORE, holdoutAvailable: false, now: NOW })).toBeNull();
    expect(mocks.launch).toHaveBeenCalledTimes(1);
  });

  it('counts a signal it cannot read as not seen yet', async () => {
    mocks.lastSeen.mockRejectedValueOnce(new Error('down'));
    mocks.error.any = { message: 'down' };
    const facts = await getTodaySetupFacts({ activeStore: STORE, holdoutAvailable: false, now: NOW });
    expect(facts).toMatchObject({ chatSeenAt: null, storeLook: false, testLook: false });
  });

  it('finds the owner’s test looks, and none before is_test exists', async () => {
    mocks.looks.test = [{ id: 'job_2' }];
    expect(await getTodaySetupFacts({ activeStore: STORE, holdoutAvailable: false, now: NOW })).toMatchObject({ testLook: true });
    mocks.error.test = { message: 'column tryon_jobs.is_test does not exist' };
    expect(await getTodaySetupFacts({ activeStore: STORE, holdoutAvailable: false, now: NOW })).toMatchObject({ storeLook: true, testLook: false });
  });

  it('has no Store Chat signal without a site, and names the shop when no site does', async () => {
    mocks.sites.mockResolvedValueOnce([]);
    const facts = await getTodaySetupFacts({ activeStore: { shopDomain: 'maison-noor.myshopify.com', siteId: null }, holdoutAvailable: false, now: NOW });
    expect(facts).toMatchObject({ store: 'maison-noor', chatSeenAt: null });
    expect(mocks.lastSeen).not.toHaveBeenCalled();
  });
});
