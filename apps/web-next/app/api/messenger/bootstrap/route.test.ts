// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loadPublicSite: vi.fn(),
  upsertVisitor: vi.fn(),
  ensureOpenConversation: vi.fn(),
  listMessages: vi.fn(async () => []),
  update: vi.fn(),
  verifyWooIdentityToken: vi.fn(),
}));

vi.mock('@/lib/ratelimit', () => ({ publicApiRatelimit: { limit: async () => ({ success: true, reset: Date.now() + 60_000 }) }, clientIp: () => '203.0.113.5' }));
vi.mock('@/lib/messenger/public-api', () => ({
  loadPublicSite: mocks.loadPublicSite,
  originAllowed: () => true,
  provenOrigin: () => ({ origin: 'https://shop.example.com', trusted: true }),
}));
vi.mock('@/lib/messenger/conversations', () => ({
  ensureOpenConversation: mocks.ensureOpenConversation,
  getVisitor: vi.fn(),
  isStaffTyping: () => false,
  listMessages: mocks.listMessages,
  recordEvent: async () => {},
  upsertVisitor: mocks.upsertVisitor,
}));
vi.mock('@/lib/messenger/db', () => ({
  getMessengerServiceClient: () => ({ from: () => ({ update: (patch: unknown) => ({ eq: async () => mocks.update(patch) }) }) }),
}));
vi.mock('@/lib/messenger/handoff-alert', () => ({ publicAlertFor: () => null }));
vi.mock('@/lib/messenger/contact', () => ({ knownReplyAddress: () => null }));
vi.mock('@/lib/shopify/tokens', () => ({ isActiveShopifyInstallation: async () => false }));
vi.mock('@/lib/woo/identity-token', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/woo/identity-token')>();
  return { ...actual, verifyWooIdentityToken: mocks.verifyWooIdentityToken };
});

import { POST } from './route';

const SITE = {
  id: 'site-1',
  name: 'Shop',
  embed_key: 'gc_test_key',
  status: 'active',
  settings_version: 1,
  domain: 'shop.example.com',
  config: { ai: { enabled: true } },
};

function conversation(metadata: Record<string, unknown> = {}) {
  return { id: 'conv-1', status: 'open', metadata };
}

function request(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/messenger/bootstrap', {
    method: 'POST',
    body: JSON.stringify({ key: 'gc_test_key', origin: 'https://shop.example.com', anonymousId: 'anon12345678', ...body }),
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.loadPublicSite.mockResolvedValue(SITE);
  mocks.upsertVisitor.mockResolvedValue({ id: 'v1', user_email: null });
  mocks.listMessages.mockResolvedValue([]);
});

describe('POST /api/messenger/bootstrap with a WordPress identity token', () => {
  it('binds the conversation to the proven WordPress user, not to a Shopify app', async () => {
    mocks.verifyWooIdentityToken.mockResolvedValue({ wpUserId: '42', emailHash: null });
    const conv = conversation();
    mocks.ensureOpenConversation.mockResolvedValue(conv);

    const res = await POST(request({ shopperToken: 'gcw1.payload.signature' }));
    expect(res.status).toBe(200);
    // Bound to this site and this chat session.
    expect(mocks.verifyWooIdentityToken).toHaveBeenCalledWith('gcw1.payload.signature', { siteId: 'site-1', sid: 'anon12345678' });
    expect(conv.metadata).toMatchObject({ identity: { customer_id: '42', woo_customer_id: '42', verified: true } });
    expect(conv.metadata).not.toHaveProperty('identity.app_client_id');
    expect(mocks.update).toHaveBeenCalledWith({ metadata: conv.metadata });
  });

  it('stays anonymous when the token does not verify', async () => {
    mocks.verifyWooIdentityToken.mockResolvedValue(null);
    const conv = conversation();
    mocks.ensureOpenConversation.mockResolvedValue(conv);

    await POST(request({ shopperToken: 'gcw1.forged.signature' }));
    expect(conv.metadata).not.toHaveProperty('identity');
    expect(mocks.upsertVisitor).toHaveBeenCalledWith(expect.objectContaining({ identity: null }));
  });

  it('rotates the session when a different shopper, or nobody, is now signed in', async () => {
    mocks.verifyWooIdentityToken.mockResolvedValue(null);
    mocks.ensureOpenConversation
      .mockResolvedValueOnce(conversation({ identity: { customer_id: '42', woo_customer_id: '42', verified: true } }))
      .mockResolvedValueOnce(conversation());

    const res = await POST(request({}));
    const data = await res.json();
    expect(mocks.upsertVisitor).toHaveBeenCalledTimes(2);
    expect(data.anonymousId).not.toBe('anon12345678');
  });
});
