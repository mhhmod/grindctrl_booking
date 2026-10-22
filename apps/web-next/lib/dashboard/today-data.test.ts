// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  entitlement: vi.fn(),
  stats: vi.fn(),
  lastSeen: vi.fn(),
  replyMinutes: vi.fn(),
  shops: vi.fn(),
  tables: {} as Record<string, unknown[]>,
  failTable: null as string | null,
}));

vi.mock('@/lib/try-on/entitlement', () => ({ getShopEntitlement: mocks.entitlement }));
vi.mock('@/lib/messenger/conversations', () => ({ getOverviewStats: mocks.stats, getWidgetLastSeenAt: mocks.lastSeen }));
vi.mock('@/lib/messenger/team-reply-time', () => ({ teamReplyMinutes: mocks.replyMinutes }));
vi.mock('./active-store-server', () => ({ listDashboardShops: mocks.shops }));
vi.mock('@/lib/messenger/db', () => {
  class Query {
    constructor(readonly table: string) {}
    select() { return this; }
    eq() { return this; }
    gte() { return this; }
    not() { return this; }
    limit() { return this; }
    async maybeSingle() { return { data: (mocks.tables[this.table] ?? [])[0] ?? null, error: null }; }
    then(resolve: (value: unknown) => unknown) {
      if (mocks.failTable === this.table) return Promise.resolve({ data: null, error: { message: 'down' } }).then(resolve);
      return Promise.resolve({ data: mocks.tables[this.table] ?? [], error: null }).then(resolve);
    }
  }
  return { getMessengerServiceClient: () => ({ from: (table: string) => new Query(table) }) as unknown as SupabaseClient };
});

import { getTodayFacts } from './today-data';

const NOW = Date.parse('2026-10-02T11:00:00Z'); // 14:00 in Cairo
const at = (minutesAgo: number) => new Date(NOW - minutesAgo * 60_000).toISOString();
const STORE = { shopDomain: 'maison.myshopify.com', siteId: '11111111-1111-4111-8111-111111111111' };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.failTable = null;
  mocks.shops.mockResolvedValue([{ domain: 'maison.myshopify.com', status: 'installed', lastSeenAt: at(5) }]);
  mocks.entitlement.mockResolvedValue({
    totalCreditsRemaining: 150,
    rendersIncluded: 350,
    topUpCreditsRemaining: 0,
    available: true,
    planName: 'Growth',
    status: 'active',
    currentPeriodEnd: '2026-10-18T00:00:00Z',
  });
  mocks.stats.mockResolvedValue({ aiResolved7d: 12, handedOff7d: 3, alertProblems7d: { no_recipient: 1, send_failed: 2 } });
  mocks.lastSeen.mockResolvedValue(at(2));
  mocks.replyMinutes.mockResolvedValue(9);
  mocks.tables = {
    tryon_jobs: [
      { created_at: at(30) }, // today
      { created_at: at(60 * 24 * 3) }, // this week
      { created_at: at(60 * 24 * 9) }, // the week before
    ],
    widget_conversations: [],
    widget_sites: [{ settings_json: { messenger_notifications: { emailOnHandoff: false } } }],
  };
});

describe('getTodayFacts', () => {
  it('counts looks per window on the store’s calendar and reads the plan', async () => {
    const facts = await getTodayFacts({ activeStore: STORE, role: 'owner', timeZone: 'Africa/Cairo', now: NOW });
    expect(facts.tryOn).toMatchObject({ looksLast7: 2, looksPrev7: 1, looksToday: 1, looksLeft: 150, available: true, planActive: true });
    expect(facts.canBilling).toBe(true);
    expect(facts.chat).toMatchObject({ solved7: 12, handedOff7: 3, alertProblems7: 3, teamReplyMinutes: 9, emailsTeam: false });
  });

  it('dates a waiting shopper from the alert, and reads the cart', async () => {
    mocks.tables.widget_conversations = [
      {
        last_message_at: at(1),
        handoff_notified_at: at(10),
        metadata: {
          handoff_alert: { status: 'sent', at: at(12), channels: ['email'], attempts: 1 },
          cart: { totalMinor: 650000, currency: 'EGP', items: [] },
        },
      },
      { last_message_at: at(4), handoff_notified_at: null, metadata: {} },
    ];
    const facts = await getTodayFacts({ activeStore: STORE, role: 'member', timeZone: 'Africa/Cairo', now: NOW });
    expect(facts.canBilling).toBe(false);
    expect(facts.chat!.waiting).toEqual([
      { since: at(12), alertSent: true, cart: { totalMinor: 650000, currency: 'EGP', items: [] } },
      { since: at(4), alertSent: false, cart: null },
    ]);
  });

  it('leaves out only the part that failed', async () => {
    mocks.failTable = 'tryon_jobs';
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const facts = await getTodayFacts({ activeStore: STORE, role: 'owner', timeZone: 'Africa/Cairo', now: NOW });
    expect(facts.tryOn).toBeNull();
    expect(facts.chat).not.toBeNull();
  });

  it('reports no Try it on for an uninstalled shop, and nothing for a store without one', async () => {
    mocks.shops.mockResolvedValue([{ domain: 'maison.myshopify.com', status: 'uninstalled', lastSeenAt: at(5) }]);
    expect((await getTodayFacts({ activeStore: STORE, role: 'owner', timeZone: 'UTC', now: NOW })).tryOn).toBeNull();
    const siteOnly = await getTodayFacts({ activeStore: { shopDomain: null, siteId: STORE.siteId }, role: 'owner', timeZone: 'UTC', now: NOW });
    expect(siteOnly.tryOn).toBeNull();
    expect(mocks.entitlement).not.toHaveBeenCalled();
  });
});
