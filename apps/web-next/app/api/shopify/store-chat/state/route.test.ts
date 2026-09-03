// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  authenticateMock,
  ensureShopOwnedSiteMock,
  getOverviewStatsMock,
  listConversationsForSiteMock,
  listKnowledgeMock,
  getWidgetLastSeenAtMock,
  countUnreadByConversationMock,
} = vi.hoisted(() => ({
  authenticateMock: vi.fn(),
  ensureShopOwnedSiteMock: vi.fn(),
  getOverviewStatsMock: vi.fn(),
  listConversationsForSiteMock: vi.fn(),
  listKnowledgeMock: vi.fn(),
  getWidgetLastSeenAtMock: vi.fn(),
  countUnreadByConversationMock: vi.fn(),
}));

vi.mock('@/lib/shopify/session-token', () => ({ authenticateShopifyRequest: authenticateMock }));
vi.mock('@/lib/messenger/shop-provisioning', () => ({ ensureShopOwnedSite: ensureShopOwnedSiteMock }));
vi.mock('@/lib/messenger/conversations', () => ({
  getOverviewStats: getOverviewStatsMock,
  listConversationsForSite: listConversationsForSiteMock,
  getWidgetLastSeenAt: getWidgetLastSeenAtMock,
  countUnreadByConversation: countUnreadByConversationMock,
}));
vi.mock('@/lib/messenger/knowledge', () => ({ listKnowledge: listKnowledgeMock }));

import { GET } from './route';

function req(): NextRequest {
  return new NextRequest(
    new Request('https://grindctrl.cloud/api/shopify/store-chat/state', {
      headers: { authorization: 'Bearer tok' },
    }),
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  getOverviewStatsMock.mockResolvedValue({ totalConversations: 0 });
  listConversationsForSiteMock.mockResolvedValue([]);
  listKnowledgeMock.mockResolvedValue([]);
  getWidgetLastSeenAtMock.mockResolvedValue(null);
  countUnreadByConversationMock.mockResolvedValue({});
});

describe('GET /api/shopify/store-chat/state', () => {
  it('returns 401 without a valid session token', async () => {
    authenticateMock.mockReturnValue(null);
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it('resolves the site from the verified shop and assembles the dashboard payload shape', async () => {
    authenticateMock.mockReturnValue({ shop: 'demo.myshopify.com' });
    ensureShopOwnedSiteMock.mockResolvedValue({
      id: 'site-1',
      name: 'Demo',
      embed_key: 'gc_demo',
      status: 'active',
      domain: 'demo.myshopify.com',
      settings_json: {},
      settings_version: 2,
      settings_draft: null,
      hasDraft: false,
    });

    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.site).toEqual(
      expect.objectContaining({ id: 'site-1', name: 'Demo', embedKey: 'gc_demo', active: true, version: 2 }),
    );
    expect(body.config).toBeDefined();
    expect(body.payload).toBeDefined();
    expect(body.conversations).toEqual([]);
    expect(body.knowledge).toEqual([]);
  });

  it('never lets one failed panel take the whole response down', async () => {
    authenticateMock.mockReturnValue({ shop: 'demo.myshopify.com' });
    ensureShopOwnedSiteMock.mockResolvedValue({
      id: 'site-1',
      name: 'Demo',
      embed_key: 'gc_demo',
      status: 'active',
      domain: 'demo.myshopify.com',
      settings_json: {},
      settings_version: 1,
      settings_draft: null,
      hasDraft: false,
    });
    getOverviewStatsMock.mockRejectedValue(new Error('stats down'));

    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stats).toBeNull();
  });
});
