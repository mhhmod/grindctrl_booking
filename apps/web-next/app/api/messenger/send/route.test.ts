// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* Route-level integration: every boundary (site resolution, persistence,
   model, limiters) is stubbed so we can assert the SEND PIPELINE CONTRACTS:
   idempotent replays, human-request short-circuit, AI ownership gates, and
   grounded replies carrying the right metadata. */

const mocks = vi.hoisted(() => ({
  sessionLimit: vi.fn(async () => ({ success: true, reset: Date.now() + 60_000 })),
  orderLimit: vi.fn(async () => ({ success: true, reset: Date.now() + 60_000 })),
  publicApiRatelimit: { limit: vi.fn(async () => ({ success: true, reset: Date.now() + 60_000 })) },
  clientIp: vi.fn(() => '203.0.113.5'),
  loadPublicSite: vi.fn(),
  originAllowed: vi.fn(() => true),
  isWithinAvailabilityHours: vi.fn(() => true),
  appendMessage: vi.fn(),
  claimAiTurn: vi.fn(async () => true),
  getConversationForVisitor: vi.fn(),
  ensureOpenConversation: vi.fn(),
  getVisitor: vi.fn(),
  listMessages: vi.fn(async (): Promise<Array<Record<string, unknown>>> => []),
  recordEvent: vi.fn(async () => {}),
  requestHandoff: vi.fn(),
  escalateAndNotify: vi.fn(),
  detectExplicitHandoffRequest: vi.fn(),
  generateAssistantReply: vi.fn(),
  phraseOrderAnswer: vi.fn(),
  getActiveKnowledge: vi.fn(async () => []),
  updateConversationMetadata: vi.fn(async () => {}),
  recordAudit: vi.fn(async () => {}),
  lookupOrder: vi.fn(),
  storeFlags: vi.fn(async (): Promise<string[]> => []),
  patchConversationMetadata: vi.fn(async () => ({})),
  claimAiTurnWhileWaiting: vi.fn(async () => true),
}));

vi.hoisted(() => {
  process.env.UPSTASH_REDIS_REST_URL = 'https://test.invalid';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test';
});
vi.mock('@upstash/redis', () => ({ Redis: { fromEnv: () => ({}) } }));
vi.mock('@upstash/ratelimit', () => {
  class Ratelimit {
    static slidingWindow() { return {}; }
    limit: typeof mocks.sessionLimit;
    constructor(config: { prefix: string }) {
      this.limit = config.prefix === 'gc-msgr-send' ? mocks.sessionLimit : mocks.orderLimit;
    }
  }
  return { Ratelimit };
});

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
    ensureOpenConversation: mocks.ensureOpenConversation,
    getVisitor: mocks.getVisitor,
    listMessages: mocks.listMessages,
    recordEvent: mocks.recordEvent,
    requestHandoff: mocks.requestHandoff,
    updateConversationMetadata: mocks.updateConversationMetadata,
    patchConversationMetadata: mocks.patchConversationMetadata,
    claimAiTurnWhileWaiting: mocks.claimAiTurnWhileWaiting,
    recordAudit: mocks.recordAudit,
  };
});
vi.mock('@/lib/messenger/orders', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/messenger/orders')>();
  return { ...actual, lookupOrder: mocks.lookupOrder };
});
vi.mock('@/lib/messenger/escalate', () => ({ escalateAndNotify: mocks.escalateAndNotify }));
vi.mock('@/lib/flags/store-flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/flags/store-flags')>();
  return { ...actual, storeFlags: mocks.storeFlags };
});
vi.mock('@/lib/messenger/ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/messenger/ai')>();
  return {
    ...actual,
    detectExplicitHandoffRequest: mocks.detectExplicitHandoffRequest,
    generateAssistantReply: mocks.generateAssistantReply,
    phraseOrderAnswer: mocks.phraseOrderAnswer,
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
    ai: { enabled: true, tone: 'friendly', instructions: '', languageMode: 'auto', arabicDialect: 'egyptian' as const, escalationEnabled: true },
  },
  domain: null,
  security: { allow_localhost: false },
  patterns: [],
};

/* Same store, with order lookup switched on and a real myshopify domain to
   read from. Both are required — the capability is off without either. */
const ORDER_SITE = {
  ...SITE,
  domain: 'demo.myshopify.com',
  config: { ...SITE.config, orderLookup: { enabled: true } },
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
  mocks.ensureOpenConversation.mockResolvedValue({ ...CONVERSATION, id: 'conv-2', status: 'open' });
  mocks.listMessages.mockResolvedValue([]);
  mocks.detectExplicitHandoffRequest.mockReturnValue(false);
  mocks.claimAiTurn.mockResolvedValue(true);
  mocks.escalateAndNotify.mockResolvedValue(null);
  mocks.updateConversationMetadata.mockResolvedValue(undefined);
  mocks.recordAudit.mockResolvedValue(undefined);
  mocks.storeFlags.mockResolvedValue([]);
  mocks.patchConversationMetadata.mockResolvedValue({});
  mocks.claimAiTurnWhileWaiting.mockResolvedValue(true);
});

const SENT_ALERT = { status: 'sent', reason: null, channels: ['email'], at: '2026-10-16T12:00:00.000Z', attempts: 1 };
function escalation(alert: Record<string, unknown> = SENT_ALERT) {
  return { conversation: { ...CONVERSATION, status: 'handoff_requested' }, alert };
}

const ACTION = (payload: object) => `<<GC_ACTION>>${JSON.stringify(payload)}`;

function stubTurn(raw: string) {
  mocks.appendMessage.mockImplementation(async (input: Record<string, unknown>) => ({
    message: {
      id: input.role === 'user' ? 'm-user' : 'm-reply',
      role: input.role,
      content: input.content,
      created_at: new Date().toISOString(),
      metadata: input.metadata ?? {},
    },
    replayed: false,
  }));
  mocks.generateAssistantReply.mockResolvedValue({ reply: raw, escalate: false, raw });
}

describe('POST /api/messenger/send — order lookup action seam', () => {
  it('executes a lookup and answers from the facts, never from the raw payload', async () => {
    mocks.loadPublicSite.mockResolvedValue(ORDER_SITE);
    stubTurn(ACTION({ action: 'lookup_order', order_number: '1234', email: 'a@b.com' }));
    mocks.lookupOrder.mockResolvedValue({
      ok: true,
      facts: { order_number: '1234', order_date: '2026-08-01', fulfillment_status: 'fulfilled', payment_state: 'paid', line_items: [], tracking: null, destination: null },
    });
    mocks.phraseOrderAnswer.mockResolvedValue('Order 1234 shipped on 1 August.');

    const res = await POST(makeRequest(validBody));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.reply.content).toBe('Order 1234 shipped on 1 August.');
    // The action line must never reach a shopper-visible message.
    expect(data.reply.content).not.toContain('GC_ACTION');
    expect(mocks.phraseOrderAnswer).toHaveBeenCalledTimes(1);
  });

  it('re-derives identity server-side and ignores a customer id the model invented', async () => {
    mocks.loadPublicSite.mockResolvedValue(ORDER_SITE);
    stubTurn(ACTION({ action: 'lookup_order', order_number: '1', email: 'a@b.com', customer_id: '999' }));
    mocks.lookupOrder.mockResolvedValue({ ok: false, reason: 'not_found' });

    await POST(makeRequest(validBody));
    // Conversation metadata carries no verified identity, so the executor
    // must be told there is none — whatever the model wrote.
    expect(mocks.lookupOrder.mock.calls[0][0].verifiedCustomerId).toBeNull();
    expect(JSON.stringify(mocks.lookupOrder.mock.calls[0][0])).not.toContain('999');
  });

  it('gives every denial the same sentence, whatever actually went wrong', async () => {
    mocks.loadPublicSite.mockResolvedValue(ORDER_SITE);
    const replies: string[] = [];
    for (const reason of ['not_found', 'email_mismatch', 'missing_proof']) {
      stubTurn(ACTION({ action: 'lookup_order', order_number: '1', email: 'a@b.com' }));
      mocks.lookupOrder.mockResolvedValue({ ok: false, reason });
      const data = await (await POST(makeRequest(validBody))).json();
      replies.push(data.reply.content);
    }
    expect(new Set(replies).size).toBe(1);
    // And it never names which check failed.
    expect(replies[0]).not.toMatch(/email|mismatch|not found/i);
  });

  it('never runs a lookup for a store that has not enabled it', async () => {
    mocks.loadPublicSite.mockResolvedValue(SITE); // orderLookup off, no domain
    stubTurn(ACTION({ action: 'lookup_order', order_number: '1', email: 'a@b.com' }));
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    expect(mocks.lookupOrder).not.toHaveBeenCalled();
    expect(mocks.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ai_action_rejected' }),
    );
  });

  it('spends an attempt per try and refuses past the lifetime budget', async () => {
    mocks.loadPublicSite.mockResolvedValue(ORDER_SITE);
    mocks.getConversationForVisitor.mockResolvedValue({
      ...CONVERSATION,
      metadata: { order_lookup_attempts: 5 },
    });
    stubTurn(ACTION({ action: 'lookup_order', order_number: '1', email: 'a@b.com' }));

    await POST(makeRequest(validBody));
    // Sixth attempt: counted, and never sent to Shopify.
    expect(mocks.updateConversationMetadata).toHaveBeenCalledWith(
      'conv-1',
      expect.objectContaining({ order_lookup_attempts: 6 }),
    );
    expect(mocks.lookupOrder).not.toHaveBeenCalled();
  });

  it('rejects a turn carrying two actions rather than running the first', async () => {
    mocks.loadPublicSite.mockResolvedValue(ORDER_SITE);
    stubTurn(`${ACTION({ action: 'lookup_order', order_number: '1' })} ${ACTION({ action: 'lookup_order', order_number: '2' })}`);
    await POST(makeRequest(validBody));
    expect(mocks.lookupOrder).not.toHaveBeenCalled();
    expect(mocks.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ai_action_rejected' }),
    );
  });
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
        message: { id: 's1', role: 'system', content: 'The team has your message.', created_at: new Date().toISOString(), metadata: { escalated: true } },
        replayed: false,
      });
    mocks.escalateAndNotify.mockResolvedValue(escalation());

    const res = await POST(makeRequest(body));
    const data = await res.json();

    expect(data.status).toBe('handoff_requested');
    expect(mocks.escalateAndNotify).toHaveBeenCalledWith(
      CONVERSATION.id,
      'shopper_requested_human',
      expect.stringContaining('talk to someone'),
      expect.objectContaining({ id: SITE.id, workspace_id: SITE.workspace_id }),
      {},
    );
    expect(mocks.generateAssistantReply).not.toHaveBeenCalled();
  });

  it('escalates through the notifying wrapper, not requestHandoff directly', async () => {
    mocks.detectExplicitHandoffRequest.mockReturnValue(true);
    mocks.escalateAndNotify.mockResolvedValue(escalation());
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
    mocks.generateAssistantReply.mockResolvedValue({ reply: 'Ships in 2 days.', escalate: false, raw: 'Ships in 2 days.' });

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
    mocks.generateAssistantReply.mockResolvedValue({ reply: 'Ships in 2 days.', escalate: false, raw: 'Ships in 2 days.' });
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

/* A merchant marking a conversation resolved must not silently mute the
   shopper. Before this, a message sent into a closed thread was accepted with
   a 200 and stored where nothing could answer it — aiMayAnswer requires
   status 'open', and a resolved conversation is not flagged for the team
   either. The shopper watched their message send and waited for a reply
   nobody was ever asked to write. */
describe('POST /api/messenger/send — after the merchant resolves', () => {
  it('starts a new conversation instead of writing into the closed one', async () => {
    mocks.getConversationForVisitor.mockResolvedValue({ ...CONVERSATION, status: 'closed' });
    mocks.generateAssistantReply.mockResolvedValue({
      ok: true,
      reply: 'Happy to help with that.',
      escalate: false,
    });
    mocks.appendMessage.mockImplementation(async (input: Record<string, unknown>) => ({
      message: {
        id: `m-${String(input.role)}`,
        role: input.role,
        content: input.content,
        created_at: new Date().toISOString(),
        metadata: input.metadata ?? {},
      },
      replayed: false,
    }));

    const response = await POST(makeRequest(validBody));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.ensureOpenConversation).toHaveBeenCalledWith('site-1', 'v1');

    // The client is told which conversation it is now on; without this every
    // later send and every sync keeps addressing the dead thread.
    expect(body.conversationId).toBe('conv-2');

    // And the shopper actually gets an answer.
    expect(body.reply?.content).toBe('Happy to help with that.');

    // Nothing was written into the resolved conversation.
    for (const call of mocks.appendMessage.mock.calls) {
      expect((call[0] as { conversationId: string }).conversationId).toBe('conv-2');
    }
  });

  it('leaves an open conversation alone', async () => {
    mocks.generateAssistantReply.mockResolvedValue({ ok: true, reply: 'Sure.', escalate: false });
    mocks.appendMessage.mockImplementation(async (input: Record<string, unknown>) => ({
      message: {
        id: `m-${String(input.role)}`,
        role: input.role,
        content: input.content,
        created_at: new Date().toISOString(),
        metadata: input.metadata ?? {},
      },
      replayed: false,
    }));

    const response = await POST(makeRequest(validBody));
    const body = await response.json();

    expect(mocks.ensureOpenConversation).not.toHaveBeenCalled();
    expect(body.conversationId).toBe('conv-1');
  });
});

/* ── v16 phase zero items 6, 7 and 8 ─────────────────────────────────── */

function echoTurn(reply: { id: string; role: string; content: string } | null = null) {
  const user = { id: 'u9', role: 'user', content: validBody.text, created_at: new Date().toISOString(), metadata: {} };
  mocks.appendMessage.mockImplementation(async (input: { role: string; content: string }) => ({
    message:
      input.role === 'user'
        ? user
        : { id: reply?.id ?? 'x9', role: input.role, content: input.content, created_at: new Date().toISOString(), metadata: {} },
    replayed: false,
  }));
}

describe('item 6: the handoff line depends on whether someone was alerted', () => {
  it('says the team has the message only when an alert went out', async () => {
    mocks.detectExplicitHandoffRequest.mockReturnValue(true);
    mocks.escalateAndNotify.mockResolvedValue(escalation());
    echoTurn();

    const data = await (await POST(makeRequest({ ...validBody, text: 'a person please' }))).json();

    expect(data.reply.content).toBe('Sent to the team.');
    expect(data.alert).toEqual({ status: 'sent', channels: ['email'], at: SENT_ALERT.at, afterHours: false });
  });

  it('says only that the message is saved when nobody could be alerted', async () => {
    mocks.detectExplicitHandoffRequest.mockReturnValue(true);
    mocks.escalateAndNotify.mockResolvedValue(
      escalation({ status: 'none', reason: 'no_recipient', channels: [], at: SENT_ALERT.at, attempts: 1 }),
    );
    echoTurn();

    const data = await (await POST(makeRequest({ ...validBody, text: 'a person please' }))).json();

    expect(data.reply.content).toBe('Saved for the team.');
    expect(data.alert.status).toBe('none');
    expect(JSON.stringify(data)).not.toContain('no_recipient');
  });

  it('writes the contact prompt into the row as it is now, not over the alert outcome', async () => {
    mocks.detectExplicitHandoffRequest.mockReturnValue(true);
    mocks.escalateAndNotify.mockResolvedValue(escalation());
    echoTurn();
    const site = { ...SITE, config: { ...SITE.config, contactCapture: { enabled: true, askOutsideHours: true } } };
    mocks.loadPublicSite.mockResolvedValue(site);
    // A fresh row: the route writes into the metadata object it read.
    mocks.getConversationForVisitor.mockResolvedValue({ ...CONVERSATION, metadata: {} });

    const data = await (await POST(makeRequest({ ...validBody, text: 'a person please' }))).json();

    expect(data.askContact).toBe(true);
    expect(mocks.patchConversationMetadata).toHaveBeenCalledWith(CONVERSATION.id, { contact_prompted_at: expect.any(String) });
    expect(mocks.updateConversationMetadata).not.toHaveBeenCalled();
  });
});

describe('item 7: after hours with n23_after_hours on', () => {
  // Thursday 2027-01-14 at 11 pm in Cairo (UTC+2 in January).
  const ELEVEN_PM_CAIRO = new Date('2027-01-14T21:00:00Z');
  const CAIRO_SITE = {
    ...SITE,
    config: {
      ...SITE.config,
      behaviour: {
        ...SITE.config.behaviour,
        availabilityMode: 'hours' as const,
        availabilityTimezone: 'Africa/Cairo',
        availabilityHours: [4, 5].map((day) => ({ day, startMinute: 600, endMinute: 1320 })),
      },
    },
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(ELEVEN_PM_CAIRO);
    mocks.loadPublicSite.mockResolvedValue(CAIRO_SITE);
    mocks.isWithinAvailabilityHours.mockReturnValue(false);
  });
  afterEach(() => vi.useRealTimers());

  it('at 11 pm Cairo time the assistant answers, and nobody is alerted', async () => {
    mocks.storeFlags.mockResolvedValue(['n23_after_hours']);
    echoTurn();
    mocks.generateAssistantReply.mockResolvedValue({ reply: 'Yes, it is lined.', escalate: false, raw: 'Yes, it is lined.' });

    const data = await (await POST(makeRequest(validBody))).json();

    expect(data.reply.content).toBe('Yes, it is lined.');
    expect(mocks.escalateAndNotify).not.toHaveBeenCalled();
  });

  it('with the flag off, keeps today\'s behaviour: the assistant is quiet after hours', async () => {
    echoTurn();

    const data = await (await POST(makeRequest(validBody))).json();

    expect(data.reply).toBeNull();
    expect(mocks.generateAssistantReply).not.toHaveBeenCalled();
  });

  it('a request for a person at night waits for opening time instead of alerting anyone', async () => {
    mocks.storeFlags.mockResolvedValue(['n23_after_hours']);
    mocks.detectExplicitHandoffRequest.mockReturnValue(true);
    const deferred = { status: 'pending', reason: 'after_hours', channels: [], at: ELEVEN_PM_CAIRO.toISOString(), attempts: 0, dueAt: '2027-01-15T08:00:00.000Z' };
    mocks.escalateAndNotify.mockResolvedValue(escalation(deferred));
    echoTurn();

    const data = await (await POST(makeRequest({ ...validBody, text: 'I need a person' }))).json();

    expect(mocks.escalateAndNotify).toHaveBeenCalledWith(
      CONVERSATION.id,
      'shopper_requested_human',
      expect.any(String),
      expect.anything(),
      { deferUntil: '2027-01-15T08:00:00.000Z' },
    );
    expect(data.alert).toMatchObject({ status: 'pending', afterHours: true });
    expect(data.team).toMatchObject({ open: false, opensAt: '10:00', timezone: 'Africa/Cairo' });
  });

  it('keeps helping a shopper who is waiting for the team overnight', async () => {
    mocks.storeFlags.mockResolvedValue(['n23_after_hours']);
    mocks.getConversationForVisitor.mockResolvedValue({ ...CONVERSATION, status: 'handoff_requested' });
    echoTurn();
    mocks.generateAssistantReply.mockResolvedValue({ reply: 'It ships in 2 days.', escalate: false, raw: 'It ships in 2 days.' });

    const data = await (await POST(makeRequest(validBody))).json();

    expect(data.reply.content).toBe('It ships in 2 days.');
    expect(data.status).toBe('handoff_requested');
    expect(mocks.claimAiTurnWhileWaiting).toHaveBeenCalledWith(CONVERSATION.id);
    expect(mocks.claimAiTurn).not.toHaveBeenCalled();
  });
});

describe('item 8: when the assistant is down', () => {
  beforeEach(() => {
    echoTurn();
    mocks.generateAssistantReply.mockRejectedValue(new Error('both providers failed'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('with n24_assistant_down on, answers that the message is saved', async () => {
    mocks.storeFlags.mockResolvedValue(['n24_assistant_down']);

    const res = await POST(makeRequest(validBody));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toMatchObject({ reply: null, saved: true, assistant: 'unavailable', status: 'open' });
    expect(data.userMessage.id).toBe('u9');
  });

  it('with the flag off, keeps today\'s 502', async () => {
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe('ai_unavailable');
  });
});
