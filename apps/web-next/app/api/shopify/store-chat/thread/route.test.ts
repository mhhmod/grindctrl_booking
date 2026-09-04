// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  authenticateMock,
  ensureShopOwnedSiteMock,
  getConversationForSiteMock,
  listMessagesMock,
  appendMessageMock,
  recordAuditMock,
  takeOverConversationMock,
  returnConversationToAiMock,
  closeConversationMock,
  getSiteAssigneeProfileIdMock,
  listConversationAttachmentsMock,
  signAttachmentUrlsMock,
} = vi.hoisted(() => ({
  authenticateMock: vi.fn(),
  ensureShopOwnedSiteMock: vi.fn(),
  getConversationForSiteMock: vi.fn(),
  listMessagesMock: vi.fn(),
  appendMessageMock: vi.fn(),
  recordAuditMock: vi.fn(),
  takeOverConversationMock: vi.fn(),
  returnConversationToAiMock: vi.fn(),
  closeConversationMock: vi.fn(),
  getSiteAssigneeProfileIdMock: vi.fn(),
  listConversationAttachmentsMock: vi.fn(),
  signAttachmentUrlsMock: vi.fn(),
}));

vi.mock('@/lib/shopify/session-token', () => ({ authenticateShopifyRequest: authenticateMock }));
vi.mock('@/lib/messenger/shop-provisioning', () => ({ ensureShopOwnedSite: ensureShopOwnedSiteMock }));
vi.mock('@/lib/messenger/shop-tenancy', () => ({ shopProfileId: (domain: string) => `shop-${domain}` }));
vi.mock('@/lib/messenger/provisioning', () => ({
  getSiteAssigneeProfileId: getSiteAssigneeProfileIdMock,
}));
vi.mock('@/lib/messenger/conversations', () => ({
  getConversationForSite: getConversationForSiteMock,
  listMessages: listMessagesMock,
  appendMessage: appendMessageMock,
  recordAudit: recordAuditMock,
  takeOverConversation: takeOverConversationMock,
  returnConversationToAi: returnConversationToAiMock,
  closeConversation: closeConversationMock,
}));
vi.mock('@/lib/messenger/attachments', () => ({
  listConversationAttachments: listConversationAttachmentsMock,
  signAttachmentUrls: signAttachmentUrlsMock,
}));

import { POST } from './route';

function req(body: unknown): NextRequest {
  return new NextRequest(
    new Request('https://grindctrl.cloud/api/shopify/store-chat/thread', {
      method: 'POST',
      headers: { authorization: 'Bearer tok' },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  authenticateMock.mockReturnValue({ shop: 'demo.myshopify.com' });
  ensureShopOwnedSiteMock.mockResolvedValue({ id: 'site-real', workspace_id: 'ws-1' });
  listConversationAttachmentsMock.mockResolvedValue([]);
  signAttachmentUrlsMock.mockResolvedValue({});
});

describe('POST /api/shopify/store-chat/thread', () => {
  it('returns 401 without a valid session token', async () => {
    authenticateMock.mockReturnValue(null);
    const res = await POST(req({ op: 'messages', conversationId: 'c-1' }));
    expect(res.status).toBe(401);
    expect(ensureShopOwnedSiteMock).not.toHaveBeenCalled();
  });

  it('returns 404 when the conversation does not belong to the token-resolved site', async () => {
    getConversationForSiteMock.mockResolvedValue(null);
    const res = await POST(req({ op: 'messages', conversationId: 'attacker-conv' }));
    expect(getConversationForSiteMock).toHaveBeenCalledWith('attacker-conv', 'site-real');
    expect(res.status).toBe(404);
  });

  it('op=messages returns messages and signed attachments', async () => {
    getConversationForSiteMock.mockResolvedValue({ id: 'c-1', status: 'open' });
    listMessagesMock.mockResolvedValue([
      { id: 'm-1', role: 'user', content: 'hi', created_at: '2026-08-30T10:00:00.000Z', metadata: {} },
    ]);
    const res = await POST(req({ op: 'messages', conversationId: 'c-1' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      status: 'open',
      messages: [{ id: 'm-1', role: 'user', content: 'hi', createdAt: '2026-08-30T10:00:00.000Z', author: undefined }],
      attachments: {},
    });
  });

  it('op=reply takes over an open conversation before appending, using the shop as actor', async () => {
    getConversationForSiteMock.mockResolvedValue({ id: 'c-1', status: 'open' });
    getSiteAssigneeProfileIdMock.mockResolvedValue('profile-owner-1');
    takeOverConversationMock.mockResolvedValue({ id: 'c-1', status: 'handoff_active' });
    appendMessageMock.mockResolvedValue({ message: {}, replayed: false });

    const res = await POST(req({ op: 'reply', conversationId: 'c-1', text: 'On it!' }));

    /* Assignment resolves through the site's workspace, not a shop- profile.
       A dashboard-first store has no shop- row, so the old lookup threw and
       every reply and takeover in the embedded app failed. */
    expect(getSiteAssigneeProfileIdMock).toHaveBeenCalledWith('ws-1');
    expect(takeOverConversationMock).toHaveBeenCalledWith('c-1', 'profile-owner-1');
    expect(appendMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: 'c-1', role: 'assistant', content: 'On it!' }),
    );
    expect(recordAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: 'site-real', actorClerkUserId: 'shop-demo.myshopify.com' }),
    );
    expect(res.status).toBe(200);
  });

  it('op=takeover records the audit trail against the shop, not a person', async () => {
    getConversationForSiteMock.mockResolvedValue({ id: 'c-1', status: 'open' });
    getSiteAssigneeProfileIdMock.mockResolvedValue('profile-owner-1');
    takeOverConversationMock.mockResolvedValue({ id: 'c-1', status: 'handoff_active' });

    const res = await POST(req({ op: 'takeover', conversationId: 'c-1' }));
    expect(res.status).toBe(200);
    expect(recordAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ actorClerkUserId: 'shop-demo.myshopify.com', action: 'conversation_taken_over' }),
    );
  });

  it('op=release returns the conversation to AI', async () => {
    getConversationForSiteMock.mockResolvedValue({ id: 'c-1', status: 'handoff_active' });
    returnConversationToAiMock.mockResolvedValue({ id: 'c-1', status: 'open' });
    const res = await POST(req({ op: 'release', conversationId: 'c-1' }));
    expect(res.status).toBe(200);
  });

  it('op=close closes the conversation', async () => {
    getConversationForSiteMock.mockResolvedValue({ id: 'c-1', status: 'open' });
    closeConversationMock.mockResolvedValue({ id: 'c-1', status: 'closed' });
    const res = await POST(req({ op: 'close', conversationId: 'c-1' }));
    expect(res.status).toBe(200);
  });

  it('rejects an unknown op', async () => {
    getConversationForSiteMock.mockResolvedValue({ id: 'c-1', status: 'open' });
    const res = await POST(req({ op: 'nope', conversationId: 'c-1' }));
    expect(res.status).toBe(400);
  });

  it('returns a generic 500 instead of leaking a raw infra error when an op throws', async () => {
    getConversationForSiteMock.mockResolvedValue({ id: 'c-1', status: 'open' });
    getSiteAssigneeProfileIdMock.mockRejectedValue(new Error('connection to profiles table reset'));
    const res = await POST(req({ op: 'takeover', conversationId: 'c-1' }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: 'Action failed. Please try again.' });
  });
});
