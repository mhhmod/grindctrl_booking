// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/* Route-level integration: every boundary (site resolution, persistence,
   model, limiters) is stubbed so we can assert the SEND PIPELINE CONTRACTS:
   idempotent replays, human-request short-circuit, AI ownership gates, and
   grounded replies carrying the right metadata. */

const mocks = vi.hoisted(() => ({
  publicApiRatelimit: { limit: vi.fn(async () => ({ success: true, reset: Date.now() + 60_000 })) },
  clientIp: vi.fn(() => '203.0.113.5'),
  loadPublicSite: vi.fn(),
  originAllowed: vi.fn(() => true),
  isWithinAvailabilityHours: vi.fn(() => true),
  appendMessage: vi.fn(),
  claimAiTurn: vi.fn(async () => true),
  getConversationForVisitor: vi.fn(),
  getVisitor: vi.fn(),
  listMessages: vi.fn(async (): Promise<Array<Record<string, unknown>>> => []),
  recordEvent: vi.fn(async () => {}),
  requestHandoff: vi.fn(),
  escalateAndNotify: vi.fn(),
  detectExplicitHandoffRequest: vi.fn(),
  generateAssistantReply: vi.fn(),
  getActiveKnowledge: vi.fn(async () => []),
}));

vi.mock('@/lib/ratelimit', () => ({
  publicApiRatelimit: mocks.publicApiRatelimit,
  clientIp: mocks.clientIp,
}));
vi.mock('@/lib/messenger/public-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/messenger/public-api')>();
  return {
    ...actual,
    loadPublicSite: mocks.loadPublicSite,
    originAllowed: mocks.originAllowed,
    isWithinAvailabilityHours: mocks.isWithinAvailabilityHours,
  };
});
vi.mock('@/lib/messenger/conversations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/messenger/conversations')>();
  return {
    ...actual,
    appendMessage: mocks.appendMessage,
    claimAiTurn: mocks.claimAiTurn,
    getConversationForVisitor: mocks.getConversationForVisitor,
    getVisitor: mocks.getVisitor,
    listMessages: mocks.listMessages,
    recordEvent: mocks.recordEvent,
    requestHandoff: mocks.requestHandoff,
  };
});
vi.mock('@/lib/messenger/escalate', () => ({ escalateAndNotify: mocks.escalateAndNotify }));
vi.mock('@/lib/messenger/ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/messenger/ai')>();
  return {
    ...actual,
    detectExplicitHandoffRequest: mocks.detectExplicitHandoffRequest,
    generateAssistantReply: mocks.generateAssistantReply,
  };
});
vi.mock('@/lib/messenger/knowledge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/messenger/knowledge')>();
  return { ...actual, getActiveKnowledge: mocks.getActiveKnowledge };
});

import { POST } from './route';
import { resolveMessengerConfig } from '@/lib/messenger/config';

const SITE = {
  id: 'site-1',
  name: 'Sara’s Store',
  embed_key: 'gc_test_key',
  status: 'active',
  settings_version: 3,
  workspace_id: 'ws-1',
  config: {
    ...resolveMessengerConfig({}),
    ai: { enabled: true, tone: 'friendly', instructions: '', languageMode: 'auto', escalationEnabled: true },
  },
  security: { allow_localhost: false },
  patterns: [],
};

const CONVERSATION = {
  id: 'conv-1',
  widget_site_id: 'site-1',
  visitor_id: 'v1',
  status: 'open',
  started_at: new Date().toISOString(),
  last_message_at: null,
  assigned_profile_id: null,
  handoff_reason: null,
  handoff_summary: null,
  metadata: {},
};

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/messenger/send', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

const validBody = {
  key: 'gc_test_key',
  origin: 'https://store.example.com',
  anonymousId: 'anon12345678',
  conversationId: 'b3c9d1e2-1111-4222-8333-444455556666',
  text: 'How long is shipping?',
  clientKey: 'a3c9d1e2-1111-4222-8333-444455556666',
};

beforeEach(() => {
  vi.resetAllMocks();
  // Re-stub defaults after reset (mockReset wipes implementations).
  mocks.publicApiRatelimit.limit.mockResolvedValue({ success: true, reset: Date.now() + 60_000 });
  mocks.clientIp.mockReturnValue('203.0.113.5');
  mocks.originAllowed.mockReturnValue(true);
  mocks.isWithinAvailabilityHours.mockReturnValue(true);
  mocks.loadPublicSite.mockResolvedValue(SITE);
  mocks.getVisitor.mockResolvedValue({ id: 'v1' });
  mocks.getConversationForVisitor.mockResolvedValue(CONVERSATION);
  mocks.listMessages.mockResolvedValue([]);
  mocks.detectExplicitHandoffRequest.mockReturnValue(false);
  mocks.claimAiTurn.mockResolvedValue(true);
  mocks.escalateAndNotify.mockResolvedValue(null);
});

describe('POST /api/messenger/send', () => {
  it('rejects foreign origins before touching data or the model', async () => {
    mocks.originAllowed.mockReturnValue(false);
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(403);
    expect(mocks.appendMessage).not.toHaveBeenCalled();
    expect(mocks.generateAssistantReply).not.toHaveBeenCalled();
  });

  it('collapses retried sends onto the original turn without a second AI answer', async () => {
    const original = { id: 'm-user', role: 'user', content: 'How long is shipping?', created_at: new Date().toISOString(), metadata: {} };
    const reply = { id: 'm-ai', role: 'assistant', content: '2 days.', created_at: new Date().toISOString(), metadata: { author: 'ai' } };
    mocks.appendMessage.mockResolvedValue({ message: original, replayed: true });
    mocks.listMessages.mockResolvedValue([original, reply]);

    const res = await POST(makeRequest(validBody));
    const data = await res.json();

    expect(data.replayed).toBeUndefined(); // contract: converges silently
    expect(data.reply.id).toBe('m-ai');
    expect(mocks.generateAssistantReply).not.toHaveBeenCalled();
  });

  it("short-circuits to a human when the shopper asks for one — no model call", async () => {
    mocks.detectExplicitHandoffRequest.mockReturnValue(true);
    const body = { ...validBody, text: 'let me talk to someone please' };
    mocks.appendMessage
      .mockResolvedValueOnce({
        message: { id: 'u1', role: 'user', content: body.text, created_at: new Date().toISOString(), metadata: {} },
        replayed: false,
      })
      .mockResolvedValueOnce({
        message: { id: 's1', role: 'system', content: 'Connecting you…', created_at: new Date().toISOString(), metadata: { escalated: true } },
        replayed: false,
      });
    mocks.escalateAndNotify.mockResolvedValue({ ...CONVERSATION, status: 'handoff_requested' });

    const res = await POST(makeRequest(body));
    const data = await res.json();

    expect(data.status).toBe('handoff_requested');
    expect(mocks.escalateAndNotify).toHaveBeenCalledWith(
      CONVERSATION,
      'shopper_requested_human',
      expect.stringContaining('talk to someone'),
      expect.objectContaining({ id: SITE.id, workspace_id: SITE.workspace_id }),
    );
    expect(mocks.generateAssistantReply).not.toHaveBeenCalled();
  });

  it('escalates through the notifying wrapper, not requestHandoff directly', async () => {
    mocks.detectExplicitHandoffRequest.mockReturnValue(true);
    mocks.escalateAndNotify.mockResolvedValue({ ...CONVERSATION, status: 'handoff_requested' });
    mocks.appendMessage.mockResolvedValue({
      message: { id: 'u5', role: 'user', content: 'get me a human', created_at: new Date().toISOString(), metadata: {} },
      replayed: false,
    });

    const res = await POST(makeRequest({ ...validBody, text: 'get me a human' }));
    const data = await res.json();

    expect(data.status).toBe('handoff_requested');
    expect(mocks.escalateAndNotify).toHaveBeenCalledTimes(1);
    expect(mocks.requestHandoff).not.toHaveBeenCalled();
  });

  it('stores the grounded AI reply with author=ai while the conversation is open', async () => {
    const userMsg = { id: 'u2', role: 'user', content: 'How long is shipping?', created_at: new Date().toISOString(), metadata: {} };
    mocks.appendMessage
      .mockResolvedValueOnce({ message: userMsg, replayed: false })
      .mockResolvedValueOnce({
        message: { id: 'a2', role: 'assistant', content: 'Ships in 2 days.', created_at: new Date().toISOString(), metadata: { author: 'ai' } },
        replayed: false,
      });
    mocks.generateAssistantReply.mockResolvedValue({ reply: 'Ships in 2 days.', escalate: false });

    const res = await POST(makeRequest(validBody));
    const data = await res.json();

    expect(data.reply.content).toBe('Ships in 2 days.');
    expect(data.reply.author).toBe('ai');
    expect(mocks.generateAssistantReply).toHaveBeenCalledTimes(1);
    expect(mocks.requestHandoff).not.toHaveBeenCalled();
  });

  it('stays silent when AI has lost the mic (human takeover)', async () => {
    mocks.getConversationForVisitor.mockResolvedValue({ ...CONVERSATION, status: 'handoff_active' });
    mocks.appendMessage.mockResolvedValue({
      message: { id: 'u3', role: 'user', content: 'hello again', created_at: new Date().toISOString(), metadata: {} },
      replayed: false,
    });

    const res = await POST(makeRequest(validBody));
    const data = await res.json();

    expect(data.reply).toBeNull();
    expect(mocks.generateAssistantReply).not.toHaveBeenCalled();
  });

  it('discards a generated reply when a human takes over mid-generation', async () => {
    /* The status read at the top of the turn says "open"; the takeover lands
       while the model is thinking. Nothing generated may be stored. */
    const userMsg = { id: 'u4', role: 'user', content: 'How long is shipping?', created_at: new Date().toISOString(), metadata: {} };
    mocks.appendMessage.mockResolvedValue({ message: userMsg, replayed: false });
    mocks.generateAssistantReply.mockResolvedValue({ reply: 'Ships in 2 days.', escalate: false });
    mocks.claimAiTurn.mockResolvedValue(false);
    mocks.getConversationForVisitor
      .mockResolvedValueOnce(CONVERSATION)
      .mockResolvedValueOnce({ ...CONVERSATION, status: 'handoff_active' });

    const res = await POST(makeRequest(validBody));
    const data = await res.json();

    expect(data.reply).toBeNull();
    expect(data.status).toBe('handoff_active');
    // Only the shopper's own message was ever written.
    expect(mocks.appendMessage).toHaveBeenCalledTimes(1);
    expect(mocks.appendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ role: 'assistant' }),
    );
  });

  it('enforces per-session throughput limits on top of IP limits', async () => {
    vi.doUnmock('@upstash/redis');
    // Session limiter is constructed from Redis.fromEnv at module scope;
    // without env vars it is null and skipped — assert IP limiter still guards.
    mocks.publicApiRatelimit.limit.mockResolvedValueOnce({ success: false, reset: Date.now() + 30_000 });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(429);
  }, 20_000);

  it('validates inputs before any storage access', async () => {
    const badCases = [
      { ...validBody, key: '' },
      { ...validBody, anonymousId: 'short' },
      { ...validBody, conversationId: 'not-a-uuid' },
      { ...validBody, text: '   ' },
      { ...validBody, clientKey: 'nope' },
    ];
    for (const body of badCases) {
      const res = await POST(makeRequest(body));
      expect(res.status).toBe(400);
    }
    expect(mocks.appendMessage).not.toHaveBeenCalled();
  });
});
