import { NextRequest, NextResponse } from 'next/server';
import { publicApiRatelimit, clientIp } from '@/lib/ratelimit';
import { loadPublicSite, originAllowed } from '@/lib/messenger/public-api';
import {
  getConversationForVisitor,
  getVisitor,
  recordEvent,
  recordFeedback,
} from '@/lib/messenger/conversations';

/* POST /api/messenger/feedback
   One 👍/👎 per conversation (unique index makes repeats harmless). */

const ANON_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const limit = await publicApiRatelimit.limit(`mf:${clientIp(request) ?? 'unknown'}`);
  if (!limit.success) return NextResponse.json({ ok: false }, { status: 429 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const key = typeof body.key === 'string' ? body.key : '';
  const origin = typeof body.origin === 'string' ? body.origin : null;
  const anonymousId = typeof body.anonymousId === 'string' ? body.anonymousId : '';
  const conversationId = typeof body.conversationId === 'string' ? body.conversationId : '';
  const rating = body.rating === 'up' || body.rating === 'down' ? body.rating : null;
  const comment = typeof body.comment === 'string' ? body.comment.trim().slice(0, 1000) : '';

  if (
    !/^[a-z0-9_]{6,80}$/i.test(key) ||
    !ANON_ID_RE.test(anonymousId) ||
    !UUID_RE.test(conversationId) ||
    !rating
  ) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    const site = await loadPublicSite(key);
    if (!site || site.status !== 'active') return NextResponse.json({ ok: false }, { status: 404 });
    if (!originAllowed(site, origin)) return NextResponse.json({ ok: false }, { status: 403 });

    const visitor = await getVisitor(site.id, anonymousId);
    if (!visitor) return NextResponse.json({ ok: false }, { status: 403 });

    const conversation = await getConversationForVisitor(conversationId, visitor.id);
    if (!conversation) return NextResponse.json({ ok: false }, { status: 403 });

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
