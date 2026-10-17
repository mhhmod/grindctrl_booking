// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  limit: vi.fn(),
  session: vi.fn(),
  flags: vi.fn(),
  patch: vi.fn(),
}));

vi.mock('@/lib/ratelimit', () => ({
  publicApiRatelimit: { limit: mocks.limit },
  clientIp: () => '203.0.113.7',
}));
vi.mock('@/lib/messenger/public-session', () => ({ resolveShopperSession: mocks.session }));
vi.mock('@/lib/flags/store-flags', async (original) => ({
  ...(await original<typeof import('@/lib/flags/store-flags')>()),
  storeFlags: mocks.flags,
}));
vi.mock('@/lib/messenger/conversations', () => ({ patchConversationMetadata: mocks.patch }));

import { POST } from './route';

const SITE = { id: 'site-1', name: 'Maison', domain: 'maison.myshopify.com' };
const CART = {
  totalMinor: 985_000,
  currency: 'EGP',
  items: [{ handle: 'layla-abaya', variantId: 4455667788, title: 'Layla abaya, M', quantity: 2, priceMinor: 492_500 }],
};
const BODY = { key: 'gc_test_key', anonymousId: 'anon12345678', conversationId: 'conv-1', cart: CART };

function post(body: Record<string, unknown> = BODY) {
  return POST(new NextRequest('http://localhost/api/messenger/cart', { method: 'POST', body: JSON.stringify(body) }));
}

describe('POST /api/messenger/cart (N16 cart, for N25 big orders)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.limit.mockResolvedValue({ success: true, reset: Date.now() + 10_000 });
    mocks.session.mockResolvedValue({ ok: true, site: SITE, visitor: { id: 'v1' }, conversation: { id: 'conv-1', status: 'open', metadata: {} } });
    mocks.flags.mockResolvedValue(['n25_handoff_rules']);
    mocks.patch.mockResolvedValue({});
  });

  it('keeps the cart on the conversation and answers 204', async () => {
    const res = await post();
    expect(res.status).toBe(204);
    expect(mocks.patch).toHaveBeenCalledWith('conv-1', {
      cart: { ...CART, items: [{ ...CART.items[0], variantId: '4455667788' }] },
      cart_updated_at: expect.any(String),
    });
  });

  it('keeps nothing while the store\'s flag is off', async () => {
    mocks.flags.mockResolvedValue([]);
    const res = await post();
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, error: 'not_enabled' });
    expect(mocks.patch).not.toHaveBeenCalled();
  });

  it('refuses a cart that is not one, before touching the session', async () => {
    const res = await post({ ...BODY, cart: { totalMinor: 'lots', currency: 'EGP', items: [] } });
    expect(res.status).toBe(400);
    expect(mocks.session).not.toHaveBeenCalled();
  });

  it('passes the session checks\' answer through', async () => {
    mocks.session.mockResolvedValue({ ok: false, code: 'origin_not_allowed', status: 403 });
    const res = await post();
    expect(res.status).toBe(403);
    expect(mocks.patch).not.toHaveBeenCalled();
  });
});
