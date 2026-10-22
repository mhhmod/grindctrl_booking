// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  conversation: vi.fn(),
  results: {} as Record<string, { data: unknown; error: { message: string } | null }>,
  calls: [] as Array<[string, ...unknown[]]>,
}));

vi.mock('@/lib/messenger/provisioning', () => ({ requireSiteAccess: mocks.access }));
vi.mock('@/lib/messenger/conversations', () => ({ getConversationForSite: mocks.conversation }));
vi.mock('@/lib/messenger/db', () => {
  class Query {
    private key: string;
    constructor(readonly table: string) {
      this.key = table;
    }
    select(columns: string) { mocks.calls.push(['select', this.table, columns]); if (this.table === 'widget_messages' && columns.startsWith('conversation_id')) this.key = 'first_lines'; return this; }
    eq(column: string, value: unknown) { mocks.calls.push(['eq', this.table, column, value]); return this; }
    neq(column: string, value: unknown) { mocks.calls.push(['neq', this.table, column, value]); return this; }
    not(column: string, op: string, value: unknown) { mocks.calls.push(['not', this.table, column, op, value]); return this; }
    in(column: string, values: unknown[]) { mocks.calls.push(['in', this.table, column, values]); return this; }
    order() { return this; }
    limit() { return this; }
    maybeSingle() { return this; }
    then(resolve: (value: unknown) => unknown) {
      return Promise.resolve(mocks.results[this.key] ?? { data: [], error: null }).then(resolve);
    }
  }
  return { getMessengerServiceClient: () => ({ from: (table: string) => new Query(table) }) as unknown as SupabaseClient };
});

import { getInboxCustomerFacts } from './inbox-customer-data';

const SITE = '11111111-1111-4111-8111-111111111111';
const CARD = { name: '#1042', stage: 'delivered', items: [], timeline: [], placedAt: 'x', estimatedDelivery: null, carrier: null, trackingUrl: null, cashDue: false };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.calls = [];
  mocks.access.mockResolvedValue({ id: SITE, domain: 'maison-noor.myshopify.com' });
  mocks.conversation.mockResolvedValue({
    id: 'c1',
    visitor_id: 'v1',
    metadata: {
      identity: { customer_id: '7012345678', email: 'salma@example.com', name: 'Salma', verified: true },
      last_page_url: 'https://maison.example/products/layla',
      contact_email: 'other@example.com',
      cart: { totalMinor: 1000, currency: 'EGP', items: [{ handle: 'a', variantId: '1', title: 'A', quantity: 1, priceMinor: 1000 }] },
    },
  });
  mocks.results = {
    widget_messages: { data: [{ metadata: { order_card: CARD } }], error: null },
    widget_visitors: { data: { user_email: 'salma@example.com', user_name: 'Salma Ahmed' }, error: null },
    widget_conversations: { data: [{ id: 'c0', started_at: '2026-10-21T12:00:00Z', status: 'closed' }], error: null },
    first_lines: {
      data: [
        { conversation_id: 'c0', content: '  Can I exchange the Riyadh abaya?\nThanks' },
        { conversation_id: 'c0', content: 'A later message' },
      ],
      error: null,
    },
  };
});

describe('getInboxCustomerFacts', () => {
  it('reads what Store Chat knows about the shopper, after checking the person may answer the site’s chats', async () => {
    const facts = await getInboxCustomerFacts({ userId: 'user_1', siteId: SITE, conversationId: 'c1' });
    expect(mocks.access).toHaveBeenCalledWith('user_1', SITE, 'chats');
    expect(mocks.conversation).toHaveBeenCalledWith('c1', SITE);
    expect(mocks.calls).toEqual(
      expect.arrayContaining([
        ['not', 'widget_messages', 'metadata->order_card', 'is', null],
        ['eq', 'widget_conversations', 'visitor_id', 'v1'],
        ['neq', 'widget_conversations', 'id', 'c1'],
        ['in', 'widget_messages', 'conversation_id', ['c0']],
      ]),
    );
    expect(facts).toEqual({
      name: 'Salma Ahmed',
      email: 'salma@example.com',
      identity: { name: 'Salma', email: 'salma@example.com', customerId: '7012345678', verified: true },
      contactEmail: 'other@example.com',
      lastPageUrl: 'https://maison.example/products/layla',
      order: CARD,
      cart: { totalMinor: 1000, currency: 'EGP', items: [{ handle: 'a', variantId: '1', title: 'A', quantity: 1, priceMinor: 1000 }] },
      past: [{ id: 'c0', startedAt: '2026-10-21T12:00:00Z', status: 'closed', preview: 'Can I exchange the Riyadh abaya?' }],
      shopDomain: 'maison-noor.myshopify.com',
    });
  });

  it('has no shop for a site on another website, and no past without earlier conversations', async () => {
    mocks.access.mockResolvedValue({ id: SITE, domain: 'maisonnoor.com' });
    mocks.results.widget_conversations = { data: [], error: null };
    const facts = await getInboxCustomerFacts({ userId: 'user_1', siteId: SITE, conversationId: 'c1' });
    expect(facts.shopDomain).toBeNull();
    expect(facts.past).toEqual([]);
    expect(mocks.calls.some(([kind, table]) => kind === 'in' && table === 'widget_messages')).toBe(false);
  });

  it('refuses a conversation of another site, a person who may not answer, and a failed read', async () => {
    mocks.conversation.mockResolvedValue(null);
    await expect(getInboxCustomerFacts({ userId: 'user_1', siteId: SITE, conversationId: 'c9' })).rejects.toThrow('conversation not found');
    mocks.access.mockRejectedValue(new Error('Unauthorized'));
    await expect(getInboxCustomerFacts({ userId: 'user_1', siteId: SITE, conversationId: 'c1' })).rejects.toThrow('Unauthorized');
    mocks.access.mockResolvedValue({ id: SITE, domain: null });
    mocks.conversation.mockResolvedValue({ id: 'c1', visitor_id: 'v1', metadata: {} });
    mocks.results.widget_visitors = { data: null, error: { message: 'timeout' } };
    await expect(getInboxCustomerFacts({ userId: 'user_1', siteId: SITE, conversationId: 'c1' })).rejects.toThrow('timeout');
  });
});
