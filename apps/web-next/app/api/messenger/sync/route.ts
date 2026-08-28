import { NextRequest, NextResponse } from 'next/server';
import { publicApiRatelimit, clientIp } from '@/lib/ratelimit';
import { loadPublicSite, originAllowed } from '@/lib/messenger/public-api';
import { getConversationForVisitor, getVisitor, listMessages } from '@/lib/messenger/conversations';

/* GET /api/messenger/sync?key&anonId&conversationId&after=<iso>&origin
   Cursor-based recovery used on reconnect, tab refocus, and multi-tab
   consistency. Cheap, idempotent, and the only polling endpoint — the
   loader calls it at most every 15 s while visible. */

const ANON_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const limit = await publicApiRatelimit.limit(`my:${clientIp(request) ?? 'unknown'}`);
  if (!limit.success) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

  const params = request.nextUrl.searchParams;
  const key = params.get('key') ?? '';
  const origin = params.get('origin');
  const anonymousId = params.get('anonId') ?? '';
  const conversationId = params.get('conversationId') ?? '';
  const after = params.get('after');

  if (!/^[a-z0-9_]{6,80}$/i.test(key)) return NextResponse.json({ error: 'bad_key' }, { status: 400 });
  if (!ANON_ID_RE.test(anonymousId) || !UUID_RE.test(conversationId)) {
    return NextResponse.json({ error: 'bad_session' }, { status: 400 });
  }
  if (after && Number.isNaN(Date.parse(after))) {
    return NextResponse.json({ error: 'bad_cursor' }, { status: 400 });
  }

  try {
    const site = await loadPublicSite(key);
    if (!site || site.status !== 'active') return NextResponse.json({ error: 'not_found' }, { status: 404 });
    if (!originAllowed(site, origin)) return NextResponse.json({ error: 'origin_not_allowed' }, { status: 403 });

    const visitor = await getVisitor(site.id, anonymousId);
    if (!visitor) return NextResponse.json({ messages: [], status: null });

    const conversation = await getConversationForVisitor(conversationId, visitor.id);
    if (!conversation) return NextResponse.json({ messages: [], status: null });

    const messages = await listMessages(conversation.id, { afterIso: after ?? null, limit: 50 });
    return NextResponse.json(
      {
        status: conversation.status,
        messages: messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.created_at,
          author:
            m.metadata.author ??
            (m.role === 'assistant' ? 'ai' : m.role === 'system' ? 'system' : 'shopper'),
        })),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[messenger] sync failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }
}
