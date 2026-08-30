// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  authenticateMock,
  ensureShopOwnedSiteMock,
  addManualKnowledgeMock,
  addUrlKnowledgeMock,
  setKnowledgeStatusMock,
  removeKnowledgeMock,
  reSyncKnowledgeMock,
} = vi.hoisted(() => ({
  authenticateMock: vi.fn(),
  ensureShopOwnedSiteMock: vi.fn(),
  addManualKnowledgeMock: vi.fn(),
  addUrlKnowledgeMock: vi.fn(),
  setKnowledgeStatusMock: vi.fn(),
  removeKnowledgeMock: vi.fn(),
  reSyncKnowledgeMock: vi.fn(),
}));

vi.mock('@/lib/shopify/session-token', () => ({ authenticateShopifyRequest: authenticateMock }));
vi.mock('@/lib/messenger/shop-provisioning', () => ({ ensureShopOwnedSite: ensureShopOwnedSiteMock }));
vi.mock('@/lib/messenger/shop-tenancy', () => ({ shopProfileId: (domain: string) => `shop-${domain}` }));
vi.mock('@/lib/messenger/knowledge', () => ({
  addManualKnowledge: addManualKnowledgeMock,
  addUrlKnowledge: addUrlKnowledgeMock,
  setKnowledgeStatus: setKnowledgeStatusMock,
  removeKnowledge: removeKnowledgeMock,
  reSyncKnowledge: reSyncKnowledgeMock,
}));

import { POST } from './route';

function req(body: unknown): NextRequest {
  return new NextRequest(
    new Request('https://grindctrl.cloud/api/shopify/store-chat/knowledge', {
      method: 'POST',
      headers: { authorization: 'Bearer tok' },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  authenticateMock.mockReturnValue({ shop: 'demo.myshopify.com' });
  ensureShopOwnedSiteMock.mockResolvedValue({ id: 'site-real' });
});

describe('POST /api/shopify/store-chat/knowledge', () => {
  it('returns 401 without a valid session token', async () => {
    authenticateMock.mockReturnValue(null);
    const res = await POST(req({ op: 'add', title: 'x', content: 'y' }));
    expect(res.status).toBe(401);
  });

  it('op=add calls addManualKnowledge with the resolved site', async () => {
    addManualKnowledgeMock.mockResolvedValue({ id: 'k-1' });
    const res = await POST(req({ op: 'add', title: 'Shipping', content: 'Ships fast' }));
    expect(addManualKnowledgeMock).toHaveBeenCalledWith({
      site: { id: 'site-real' },
      actorClerkUserId: 'shop-demo.myshopify.com',
      title: 'Shipping',
      content: 'Ships fast',
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, entry: { id: 'k-1' } });
  });

  it('op=addUrl calls addUrlKnowledge', async () => {
    addUrlKnowledgeMock.mockResolvedValue({ id: 'k-2' });
    await POST(req({ op: 'addUrl', url: 'https://example.com' }));
    expect(addUrlKnowledgeMock).toHaveBeenCalledWith({
      site: { id: 'site-real' },
      actorClerkUserId: 'shop-demo.myshopify.com',
      url: 'https://example.com',
    });
  });

  it('op=status calls setKnowledgeStatus', async () => {
    setKnowledgeStatusMock.mockResolvedValue(undefined);
    const res = await POST(req({ op: 'status', entryId: 'k-1', status: 'disabled' }));
    expect(setKnowledgeStatusMock).toHaveBeenCalledWith({ site: { id: 'site-real' }, entryId: 'k-1', status: 'disabled' });
    expect(await res.json()).toEqual({ ok: true });
  });

  it('op=delete calls removeKnowledge', async () => {
    removeKnowledgeMock.mockResolvedValue(undefined);
    await POST(req({ op: 'delete', entryId: 'k-1' }));
    expect(removeKnowledgeMock).toHaveBeenCalledWith({
      site: { id: 'site-real' },
      actorClerkUserId: 'shop-demo.myshopify.com',
      entryId: 'k-1',
    });
  });

  it('op=sync calls reSyncKnowledge', async () => {
    reSyncKnowledgeMock.mockResolvedValue(undefined);
    await POST(req({ op: 'sync', entryId: 'k-1' }));
    expect(reSyncKnowledgeMock).toHaveBeenCalledWith({ site: { id: 'site-real' }, entryId: 'k-1' });
  });

  it('rejects an unknown op', async () => {
    const res = await POST(req({ op: 'nope' }));
    expect(res.status).toBe(400);
  });

  it('turns a thrown error into a 400 with its message, matching the dashboard action\'s friendly-error behavior', async () => {
    addUrlKnowledgeMock.mockRejectedValue(new Error('Could not reach that page. Check the URL and try again.'));
    const res = await POST(req({ op: 'addUrl', url: 'https://dead.example' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: 'Could not reach that page. Check the URL and try again.' });
  });

  it('genericizes an error that does not match the friendly-message pattern, never leaking raw infra text', async () => {
    addManualKnowledgeMock.mockRejectedValue(
      new Error('knowledge create failed: duplicate key value violates unique constraint "messenger_knowledge_pkey"'),
    );
    const res = await POST(req({ op: 'add', title: 'x', content: 'y' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: 'Action failed. Please try again.' });
  });
});
