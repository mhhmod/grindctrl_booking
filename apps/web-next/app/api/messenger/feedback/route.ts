import { NextRequest, NextResponse } from 'next/server';
import { requireRateLimit, RequestRateLimitError, rateLimitErrorResponse } from '@/lib/request-rate-limit';
import { publicApiRatelimit, clientIp } from '@/lib/ratelimit';
import { loadPublicSite, originAllowed, provenOrigin } from '@/lib/messenger/public-api';
import {
  getConversationForVisitor,
  getVisitor,
  recordEvent,
  recordFeedback,
  setMessageFeedback,
} from '@/lib/messenger/conversations';

/* POST /api/messenger/feedback
   One 👍/👎 per conversation (unique index makes repeats harmless). With an
   optional `messageId`, rates one assistant reply instead — a second,
   independent per-message signal stored on that message's metadata, never
   in messenger_feedback. */

const ANON_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  try {
    await requireRateLimit(publicApiRatelimit, `mf:${clientIp(request) ?? 'unknown'}`);
  } catch (error) {
    if (error instanceof RequestRateLimitError) return rateLimitErrorResponse(error);
    throw error;
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const key = typeof body.key === 'string' ? body.key : '';
  const { origin, trusted: originTrusted } = provenOrigin(key, body);
  const anonymousId = typeof body.anonymousId === 'string' ? body.anonymousId : '';
  const conversationId = typeof body.conversationId === 'string' ? body.conversationId : '';
  const rating = body.rating === 'up' || body.rating === 'down' ? body.rating : null;
  const comment = typeof body.comment === 'string' ? body.comment.trim().slice(0, 1000) : '';
  /* Absent means the legacy once-per-conversation rating. Present must be a
     UUID, validated exactly like conversationId. */
  const messageId = body.messageId === undefined ? undefined : typeof body.messageId === 'string' ? body.messageId : null;

  if (
    !/^[a-z0-9_]{6,80}$/i.test(key) ||
    !ANON_ID_RE.test(anonymousId) ||
    !UUID_RE.test(conversationId) ||
    !rating ||
    messageId === null ||
    (messageId !== undefined && !UUID_RE.test(messageId))
  ) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    const site = await loadPublicSite(key);
    if (!site || site.status !== 'active') return NextResponse.json({ ok: false }, { status: 404 });
    if (!originAllowed(site, origin, { trusted: originTrusted })) {
      return NextResponse.json({ ok: false }, { status: 403 });
    }

    const visitor = await getVisitor(site.id, anonymousId);
    if (!visitor) return NextResponse.json({ ok: false }, { status: 403 });

    const conversation = await getConversationForVisitor(conversationId, visitor.id);
    if (!conversation) return NextResponse.json({ ok: false }, { status: 403 });

    /* Per-message rating: same trust chain as above proves the caller owns
       this conversation, then the write itself is scoped to that
       conversation id — a shopper can only ever rate a message inside their
       own thread. Deliberately never touches recordFeedback/
       messenger_feedback: the two ratings are independent. */
    if (messageId !== undefined) {
      const saved = await setMessageFeedback({
        conversationId: conversation.id,
        messageId,
        rating,
      });
      return NextResponse.json({ ok: saved });
    }

    const saved = await recordFeedback({
      siteId: site.id,
      conversationId: conversation.id,
      visitorId: visitor.id,
      rating,
      comment: comment || null,
    });
    void recordEvent({
      siteId: site.id,
      conversationId: conversation.id,
      eventName: 'conversation_feedback',
      payload: { rating },
    }).catch(() => {});
    return NextResponse.json({ ok: saved });
  } catch (error) {
    console.error('[messenger] feedback failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
