// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  limit: vi.fn(),
  orderLimit: vi.fn(),
  numberLimit: vi.fn(),
  session: vi.fn(),
  flags: vi.fn(),
  lookup: vi.fn(),
  append: vi.fn(),
  event: vi.fn(),
  audit: vi.fn(),
  meta: vi.fn(),
  woo: vi.fn(),
  plugin: vi.fn(),
  wooLimit: vi.fn(),
  verifyWoo: vi.fn(),
}));

vi.mock('@/lib/ratelimit', () => ({
  publicApiRatelimit: { limit: mocks.limit },
  clientIp: () => '203.0.113.7',
}));
vi.mock('@/lib/messenger/order-limits', async (original) => {
  const actual = await original<typeof import('@/lib/messenger/order-limits')>();
  const limiters = { address: { limit: mocks.orderLimit }, number: { limit: mocks.numberLimit } };
  return {
    orderLookupLimiter: limiters.address,
    orderNumberLimiter: limiters.number,
    wooSiteOrderLimiter: { limit: mocks.wooLimit },
    spendOrderLookupBudget: (input: Parameters<typeof actual.spendOrderLookupBudget>[0]) => actual.spendOrderLookupBudget(input, limiters),
  };
});
vi.mock('@/lib/woo/identity-token', async (original) => ({
  ...(await original<typeof import('@/lib/woo/identity-token')>()),
  verifyWooIdentityToken: mocks.verifyWoo,
}));
vi.mock('@/lib/woo/active-connection', () => ({ loadActiveWooConnection: mocks.woo }));
vi.mock('@/lib/woo/plugin-client', () => ({
  callWooPlugin: mocks.plugin,
  WOO_PLUGIN_ORDER_LOOKUP_PATH: '/wp-json/grindctrl/v1/order-lookup',
}));
vi.mock('@/lib/messenger/public-session', () => ({ resolveShopperSession: mocks.session }));
vi.mock('@/lib/flags/store-flags', async (original) => ({
  ...(await original<typeof import('@/lib/flags/store-flags')>()),
  storeFlags: mocks.flags,
}));
vi.mock('@/lib/messenger/orders', () => ({ lookupGuestOrderCard: mocks.lookup, ORDER_LOOKUP_LIFETIME_LIMIT: 5 }));
vi.mock('@/lib/messenger/conversations', () => ({
  appendMessage: mocks.append,
  recordEvent: mocks.event,
  recordAudit: mocks.audit,
  updateConversationMetadata: mocks.meta,
}));

import { POST } from './route';
import { resolveMessengerConfig } from '@/lib/messenger/config';

/* The guest order lookup inside the chat (Chat-More, contract N48 with
   the email match): deterministic, never through the model, and every
   kind of denial answers the same. */
const SITE = {
  id: 'site-1',
  name: 'Maison',
  workspace_id: 'ws-1',
  domain: 'maison.myshopify.com',
  config: resolveMessengerConfig({ messenger_order_lookup: { enabled: true } }),
};
const BODY = { key: 'gc_test_key', anonymousId: 'anon12345678', conversationId: 'conv-1', orderNumber: '#1027', contact: 'Mona@gmail.com', locale: 'en' };
const CARD = {
  name: '#1027',
  placedAt: '2026-10-14T09:00:00Z',
  stage: 'on_its_way',
  items: [{ title: 'Layla Embroidered Abaya', quantity: 1 }],
  timeline: [{ kind: 'placed', at: '2026-10-14T09:00:00Z' }],
  estimatedDelivery: null,
  carrier: 'Bosta',
  trackingUrl: 'https://bosta.co/t/1',
  cashDue: true,
};

let conversation: { id: string; status: string; metadata: Record<string, unknown> };

function post(body: Record<string, unknown> = BODY) {
  return POST(new NextRequest('http://localhost/api/messenger/order-lookup', { method: 'POST', body: JSON.stringify(body) }));
}

describe('POST /api/messenger/order-lookup (Chat-More, N48)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    conversation = { id: 'conv-1', status: 'open', metadata: {} };
    const pass = { success: true, reset: Date.now() + 10_000 };
    mocks.limit.mockResolvedValue(pass);
    mocks.orderLimit.mockResolvedValue(pass);
    mocks.numberLimit.mockResolvedValue(pass);
    mocks.wooLimit.mockResolvedValue(pass);
    mocks.session.mockImplementation(async () => ({ ok: true, site: SITE, visitor: { id: 'v1' }, conversation }));
    mocks.flags.mockResolvedValue(['v16_chat']);
    mocks.lookup.mockResolvedValue({ ok: true, card: CARD });
    mocks.event.mockResolvedValue(undefined);
    mocks.audit.mockResolvedValue(undefined);
    mocks.meta.mockResolvedValue(undefined);
    let n = 0;
    mocks.append.mockImplementation(async (input: { role: string; content: string; metadata?: Record<string, unknown> }) => ({
      message: { id: `m${++n}`, role: input.role, content: input.content, created_at: '2026-10-20T12:00:00Z', metadata: input.metadata ?? {} },
    }));
  });

  it('answers 404 not_enabled for a store without v16_chat, and never looks anything up', async () => {
    mocks.flags.mockResolvedValue([]);
    const res = await post();
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, error: 'not_enabled' });
    expect(mocks.lookup).not.toHaveBeenCalled();
  });

  it('answers 404 not_enabled when the store has order lookup off', async () => {
    mocks.session.mockResolvedValue({ ok: true, site: { ...SITE, config: resolveMessengerConfig({}) }, visitor: { id: 'v1' }, conversation });
    expect((await post()).status).toBe(404);
    expect(mocks.lookup).not.toHaveBeenCalled();
  });

  describe('on a WooCommerce site', () => {
    const WOO_SITE = { ...SITE, domain: 'shop.example.com' };
    const connection = { siteId: 'site-1', homeUrl: 'https://shop.example.com/', secretVersion: 1, pluginVersion: '0.3.0' };
    const wooOrder = {
      id: 1027, number: '1027', status: 'processing', createdAt: '2026-10-14T09:00:00Z', paid: true, total: '100.00',
      currency: 'EGP', paymentMethod: 'bacs', items: [{ name: 'Abaya', quantity: 1 }], shippingMethod: null, tracking: null, destination: null,
    };

    beforeEach(() => {
      mocks.session.mockImplementation(async () => ({ ok: true, site: WOO_SITE, visitor: { id: 'v1' }, conversation }));
      mocks.woo.mockResolvedValue(connection);
    });

    it('finds the order through the plugin and returns the same card shape', async () => {
      mocks.plugin.mockResolvedValue({ ok: true, json: { ok: true, orders: [wooOrder] } });
      const data = await (await post()).json();
      expect(mocks.lookup).not.toHaveBeenCalled();
      expect(mocks.plugin).toHaveBeenCalledWith(connection, '/wp-json/grindctrl/v1/order-lookup', { mode: 'guest', email: 'Mona@gmail.com', orderNumber: '1027' });
      expect(data.ok).toBe(true);
      expect(data.order).toMatchObject({ name: '#1027', stage: 'preparing', ref: '1027' });
    });

    it('answers a wrong email and a missing order with the identical response', async () => {
      mocks.plugin.mockResolvedValue({ ok: true, json: { ok: true, orders: [] } });
      const wrong = await (await post()).json();
      const missing = await (await post({ ...BODY, orderNumber: '999999' })).json();
      expect(wrong.error).toBe('not_found');
      expect({ ...missing, messages: undefined }).toEqual({ ...wrong, messages: undefined });
    });

    describe('Track my order for a verified shopper (mode customer)', () => {
      const CUSTOMER = { key: 'gc_test_key', anonymousId: 'anon12345678', conversationId: 'conv-1', mode: 'customer', text: 'Track my order', locale: 'en', shopperToken: 'gcw1.token' };
      beforeEach(() => {
        conversation.metadata = { identity: { woo_customer_id: '7', verified: true } };
        mocks.plugin.mockResolvedValue({ ok: true, json: { ok: true, orders: [{ ...wooOrder, status: 'completed' }] } });
      });

      it('shows the newest order from a fresh token, asking for no email', async () => {
        mocks.verifyWoo.mockResolvedValue({ wpUserId: '7' });
        const data = await (await post(CUSTOMER)).json();
        expect(mocks.plugin).toHaveBeenCalledWith(connection, '/wp-json/grindctrl/v1/order-lookup', { mode: 'customer', wpUserId: 7, limit: 1 });
        expect(data.ok).toBe(true);
        expect(data.order).toMatchObject({ name: '#1027', stage: 'delivered' });
        expect(data.messages[0]).toMatchObject({ role: 'user', content: 'Track my order' });
      });

      it('never trusts the stored identity alone: no fresh token means no lookup and no spend', async () => {
        mocks.verifyWoo.mockResolvedValue(null);
        const data = await (await post({ ...CUSTOMER, shopperToken: undefined })).json();
        expect(data).toEqual({ ok: false, error: 'not_verified' });
        expect(mocks.plugin).not.toHaveBeenCalled();
        expect(mocks.meta).not.toHaveBeenCalled();
      });

      it('refuses a token for a different customer than the conversation is bound to', async () => {
        mocks.verifyWoo.mockResolvedValue({ wpUserId: '8' });
        expect(await (await post(CUSTOMER)).json()).toEqual({ ok: false, error: 'not_verified' });
        expect(mocks.plugin).not.toHaveBeenCalled();
      });

      it('keeps the lifetime budget: a spent one answers not_found without a lookup', async () => {
        mocks.verifyWoo.mockResolvedValue({ wpUserId: '7' });
        conversation.metadata = { identity: { woo_customer_id: '7', verified: true }, order_lookup_attempts: 5 };
        expect(await (await post(CUSTOMER)).json()).toEqual({ ok: false, error: 'not_found' });
        expect(mocks.plugin).not.toHaveBeenCalled();
      });
    });

    it('is not enabled on a plugin older than 0.3.0, and without a pairing', async () => {
      mocks.woo.mockResolvedValue({ ...connection, pluginVersion: '0.2.0' });
      expect((await post()).status).toBe(404);
      mocks.woo.mockResolvedValue(null);
      expect((await post()).status).toBe(404);
      expect(mocks.plugin).not.toHaveBeenCalled();
    });
  });

  it('refuses a malformed number or email before anything else', async () => {
    expect((await post({ ...BODY, orderNumber: '10x27' })).status).toBe(400);
    expect((await post({ ...BODY, contact: 'not-an-email' })).status).toBe(400);
    expect(mocks.session).not.toHaveBeenCalled();
  });

  it('finds the order: the masked line, one sentence from its own data, and the card', async () => {
    const data = await (await post()).json();

    expect(mocks.lookup).toHaveBeenCalledWith({ shopDomain: 'maison.myshopify.com', orderNumber: '1027', email: 'Mona@gmail.com', withAmounts: false });
    expect(data.ok).toBe(true);
    expect(data.order).toEqual(CARD);
    expect(data.maskedContact).toBe('M•••••@gmail.com');
    expect(data.messages[0]).toMatchObject({ role: 'user', content: '#1027 · M•••••@gmail.com' });
    expect(data.messages[1]).toMatchObject({ role: 'assistant', author: 'ai', content: "Found it. It's on its way with Bosta.", order: CARD });
    // The full email is never stored in the conversation.
    expect(JSON.stringify(mocks.append.mock.calls)).not.toContain('Mona@gmail.com');
  });

  it('asks for amounts only when the owner has said yes (n47_order_cards)', async () => {
    mocks.flags.mockResolvedValue(['v16_chat', 'n47_order_cards']);
    await post();
    expect(mocks.lookup).toHaveBeenCalledWith(expect.objectContaining({ withAmounts: true }));
  });

  it('answers a wrong number and a wrong email exactly the same', async () => {
    mocks.lookup.mockResolvedValueOnce({ ok: false, reason: 'not_found' });
    const unknown = await (await post()).json();
    mocks.lookup.mockResolvedValueOnce({ ok: false, reason: 'email_mismatch' });
    const mismatch = await (await post()).json();

    for (const data of [unknown, mismatch]) {
      expect(data.ok).toBe(false);
      expect(data.error).toBe('not_found');
      expect(data.messages[1].content).toBe("I couldn't find an order matching those details. If you'd like, I can bring in the team.");
    }
    expect(unknown).toEqual({ ...mismatch, messages: unknown.messages });
  });

  it('answers a spent budget like a wrong guess, without looking anything up', async () => {
    mocks.numberLimit.mockResolvedValue({ success: false, reset: Date.now() + 60_000 });
    const data = await (await post()).json();
    expect(data.error).toBe('not_found');
    expect(mocks.lookup).not.toHaveBeenCalled();
    expect(mocks.numberLimit).toHaveBeenCalledWith('site-1:1027');
    expect(mocks.orderLimit).toHaveBeenCalledWith('site-1:203.0.113.7');
  });

  it('spends an attempt per try and stops after five in a conversation', async () => {
    conversation.metadata = { order_lookup_attempts: 5 };
    const data = await (await post()).json();
    expect(data.error).toBe('not_found');
    expect(mocks.lookup).not.toHaveBeenCalled();
    expect(mocks.meta).toHaveBeenCalledWith('conv-1', expect.objectContaining({ order_lookup_attempts: 6 }));
  });

  it('says the order system is unavailable when the store cannot be read, or the limits cannot be enforced', async () => {
    mocks.lookup.mockResolvedValueOnce({ ok: false, reason: 'no_scope' });
    const noScope = await (await post({ ...BODY, locale: 'ar' })).json();
    expect(noScope.error).toBe('unavailable');
    expect(noScope.messages[1].content).toBe('تعذّر الوصول إلى نظام الطلبات الآن. يمكن للفريق التحقق منه نيابةً عنك.');

    mocks.orderLimit.mockRejectedValueOnce(new Error('redis down'));
    const noLimits = await (await post()).json();
    expect(noLimits.error).toBe('unavailable');
    expect(mocks.lookup).toHaveBeenCalledTimes(1);
  });
});
