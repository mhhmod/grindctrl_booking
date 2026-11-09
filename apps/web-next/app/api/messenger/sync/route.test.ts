// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ limit: vi.fn(), site: vi.fn(), visitor: vi.fn(), conversation: vi.fn(), list: vi.fn() }));
vi.mock('@/lib/ratelimit', () => ({ publicApiRatelimit: { configured: true, limit: m.limit }, clientIp: () => '2001:db8:1:2::9' }));
vi.mock('@/lib/messenger/public-api', async (original) => ({
  ...(await original<typeof import('@/lib/messenger/public-api')>()),
  loadPublicSite: m.site,
  originAllowed: () => true,
}));
vi.mock('@/lib/messenger/conversations', async (original) => ({
  ...(await original<typeof import('@/lib/messenger/conversations')>()),
  getVisitor: m.visitor,
  getConversationForVisitor: m.conversation,
  listMessages: m.list,
}));
import { GET, POST } from './route';

const ANON = 'anon12345678';
const CONVERSATION = 'b3c9d1e2-1111-4222-8333-444455556666';
const CARD = { name: '#1001', status: 'shipped' };

beforeEach(() => {
  vi.resetAllMocks();
  m.limit.mockResolvedValue({ success: true, reset: Date.now() + 1000 });
  m.site.mockResolvedValue({ id: 'site-1', status: 'active' });
  m.visitor.mockResolvedValue({ id: 'v1', user_email: null });
  m.conversation.mockResolvedValue({ id: CONVERSATION, status: 'open', metadata: { contact: { email: 'sara@example.com' } } });
  m.list.mockResolvedValue([
    { id: 'm1', role: 'user', content: 'Hi', created_at: '2026-11-09T10:00:00Z', metadata: {} },
    { id: 'm2', role: 'user', content: '#1001 · s***@example.com', created_at: '2026-11-09T10:01:00Z', metadata: { order_lookup: true } },
    { id: 'm3', role: 'assistant', content: 'Order #1001 shipped.', created_at: '2026-11-09T10:01:01Z', metadata: { author: 'ai', order_card: CARD } },
  ]);
});

describe('/api/messenger/sync', () => {
  it('reads the ids from a POST body and returns the whole transcript', async () => {
    const response = await POST(new NextRequest('https://grindctrl.cloud/api/messenger/sync', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: 'gc_test_key', origin: 'https://store.example', anonymousId: ANON, conversationId: CONVERSATION }),
    }));
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.messages.map((message: { id: string }) => message.id)).toEqual(['m1', 'm2', 'm3']);
    expect(data.messages[2].order).toEqual(CARD);
    expect(m.limit).toHaveBeenCalledWith('my:2001:db8:1:2::/64');
  });

  it('still answers the legacy GET, without order lookups or the reply address', async () => {
    const response = await GET(new NextRequest(
      `https://grindctrl.cloud/api/messenger/sync?key=gc_test_key&origin=https%3A%2F%2Fstore.example&anonId=${ANON}&conversationId=${CONVERSATION}`,
    ));
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.messages.map((message: { id: string }) => message.id)).toEqual(['m1']);
    expect(data).not.toHaveProperty('contactEmail');
    expect(JSON.stringify(data)).not.toContain('1001');
  });

  it('rejects a POST without valid ids', async () => {
    const response = await POST(new NextRequest('https://grindctrl.cloud/api/messenger/sync', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: 'gc_test_key', anonymousId: 'x', conversationId: CONVERSATION }),
    }));
    expect(response.status).toBe(400);
    expect(m.site).not.toHaveBeenCalled();
  });
});
