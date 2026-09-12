// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

/* POST /api/messenger/feedback serves two independent ratings: the legacy
   once-per-conversation rating (no messageId) and the per-message rating of
   one assistant reply (messageId present). The two must never cross — a
   per-message vote must not touch messenger_feedback, and the legacy path
   must behave exactly as it always has. */

const mocks = vi.hoisted(() => ({
  rateLimit: vi.fn(),
  loadPublicSite: vi.fn(),
  originAllowed: vi.fn(),
  provenOrigin: vi.fn(),
  getVisitor: vi.fn(),
  getConversationForVisitor: vi.fn(),
  recordEvent: vi.fn(),
  recordFeedback: vi.fn(),
  setMessageFeedback: vi.fn(),
}));

vi.mock('@/lib/ratelimit', () => ({
  clientIp: () => '203.0.113.9',
  publicApiRatelimit: { configured: true, limit: mocks.rateLimit },
}));

vi.mock('@/lib/messenger/public-api', () => ({
  loadPublicSite: mocks.loadPublicSite,
  originAllowed: mocks.originAllowed,
  provenOrigin: mocks.provenOrigin,
}));

vi.mock('@/lib/messenger/conversations', () => ({
  getVisitor: mocks.getVisitor,
  getConversationForVisitor: mocks.getConversationForVisitor,
  recordEvent: mocks.recordEvent,
  recordFeedback: mocks.recordFeedback,
  setMessageFeedback: mocks.setMessageFeedback,
}));

import { POST } from './route';

const SITE = { id: 'site-1', status: 'active' };
const VISITOR = { id: 'visitor-1' };
const CONVERSATION = { id: 'b3c9d1e2-1111-4222-8333-444455556666' };
const MESSAGE_ID = 'c4d0e2f3-2222-4333-9444-555566667777';

function req(body: Record<string, unknown>) {
  return new NextRequest(
    new Request('https://app.example.com/api/messenger/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

function baseBody() {
  return {
    key: 'gc_test_key',
    anonymousId: 'anon12345678',
    conversationId: CONVERSATION.id,
    rating: 'up',
  };
}

describe('POST /api/messenger/feedback', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.rateLimit.mockResolvedValue({ success: true, reset: Date.now() + 10_000 });
    mocks.loadPublicSite.mockResolvedValue(SITE);
    mocks.originAllowed.mockReturnValue(true);
    mocks.provenOrigin.mockReturnValue({ origin: null, trusted: false });
    mocks.getVisitor.mockResolvedValue(VISITOR);
    mocks.getConversationForVisitor.mockResolvedValue(CONVERSATION);
    mocks.recordEvent.mockResolvedValue(undefined);
    mocks.recordFeedback.mockResolvedValue(true);
    mocks.setMessageFeedback.mockResolvedValue(true);
  });

  it('routes a request with messageId to the per-message path, never to recordFeedback', async () => {
    const response = await POST(req({ ...baseBody(), messageId: MESSAGE_ID }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(mocks.setMessageFeedback).toHaveBeenCalledWith({
      conversationId: CONVERSATION.id,
      messageId: MESSAGE_ID,
      rating: 'up',
    });
    expect(mocks.recordFeedback).not.toHaveBeenCalled();
  });

  it('keeps the legacy once-per-conversation path byte-for-byte when messageId is absent', async () => {
    const response = await POST(req(baseBody()));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(mocks.recordFeedback).toHaveBeenCalledWith({
      siteId: SITE.id,
      conversationId: CONVERSATION.id,
      visitorId: VISITOR.id,
      rating: 'up',
      comment: null,
    });
    expect(mocks.setMessageFeedback).not.toHaveBeenCalled();
  });

  it('rejects a malformed messageId without touching either rating path', async () => {
    const response = await POST(req({ ...baseBody(), messageId: 'not-a-uuid' }));

    expect(response.status).toBe(400);
    expect(mocks.setMessageFeedback).not.toHaveBeenCalled();
    expect(mocks.recordFeedback).not.toHaveBeenCalled();
  });

  it('still proves conversation ownership before rating a message', async () => {
    mocks.getConversationForVisitor.mockResolvedValue(null);

    const response = await POST(req({ ...baseBody(), messageId: MESSAGE_ID }));

    expect(response.status).toBe(403);
    expect(mocks.setMessageFeedback).not.toHaveBeenCalled();
  });
});
