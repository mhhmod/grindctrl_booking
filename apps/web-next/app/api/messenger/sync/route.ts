import { NextRequest, NextResponse } from 'next/server';
import { requireRateLimit, RequestRateLimitError, rateLimitErrorResponse } from '@/lib/request-rate-limit';
import { publicApiRatelimit, clientIp } from '@/lib/ratelimit';
import { networkKey } from '@/lib/http/network-key';
import { isJsonObject, readLimitedJson } from '@/lib/http/read-limited-body';
import { loadPublicSite, originAllowed, provenOrigin } from '@/lib/messenger/public-api';
import { getConversationForVisitor, getVisitor, isStaffTyping, listMessages } from '@/lib/messenger/conversations';
import { publicAlertFor } from '@/lib/messenger/handoff-alert';
import { knownReplyAddress } from '@/lib/messenger/contact';

/* POST /api/messenger/sync  { key, origin, originToken, anonymousId, conversationId, after }
   Cursor-based recovery used on reconnect, tab refocus, and multi-tab
   consistency. Cheap, idempotent, and the only polling endpoint: the panel
   calls it at most every 15 s while visible.

   The shopper's ids travel in the body, never the address, where access
   logs, proxies and Referer headers keep them. GET with the old query
   string still answers for one release, for panels loaded before this
   change, but without anything customer-scoped: no order cards and no
   reply address. Remove GET once those panels are gone. */

const ANON_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BODY_LIMIT_BYTES = 16 * 1024;

type SyncInput = {
  key: string;
  origin: unknown;
  originToken: unknown;
  anonymousId: string;
  conversationId: string;
  after: string | null;
};

async function limited(request: NextRequest): Promise<Response | null> {
  try {
    await requireRateLimit(publicApiRatelimit, `my:${networkKey(clientIp(request))}`);
    return null;
  } catch (error) {
    if (error instanceof RequestRateLimitError) return rateLimitErrorResponse(error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  const refused = await limited(request);
  if (refused) return refused;
  const parsed = await readLimitedJson(request, BODY_LIMIT_BYTES);
  if (!parsed.ok || !isJsonObject(parsed.value)) {
    const tooLarge = !parsed.ok && parsed.status === 413;
    return NextResponse.json({ error: tooLarge ? 'too_large' : 'bad_json' }, { status: tooLarge ? 413 : 400 });
  }
  const body = parsed.value;
  return sync({
    key: typeof body.key === 'string' ? body.key : '',
    origin: body.origin,
    originToken: body.originToken,
    anonymousId: typeof body.anonymousId === 'string' ? body.anonymousId : '',
    conversationId: typeof body.conversationId === 'string' ? body.conversationId : '',
    after: typeof body.after === 'string' ? body.after : null,
  }, { customerScope: true });
}

/** Legacy: panels loaded before the POST sync. No customer-scoped fields. */
export async function GET(request: NextRequest) {
  const refused = await limited(request);
  if (refused) return refused;
  const params = request.nextUrl.searchParams;
  return sync({
    key: params.get('key') ?? '',
    origin: params.get('origin'),
    originToken: params.get('originToken'),
    anonymousId: params.get('anonId') ?? '',
    conversationId: params.get('conversationId') ?? '',
    after: params.get('after'),
  }, { customerScope: false });
}

async function sync(input: SyncInput, options: { customerScope: boolean }): Promise<Response> {
  const { key, anonymousId, conversationId, after } = input;
  const { origin, trusted: originTrusted } = provenOrigin(key, { origin: input.origin, originToken: input.originToken });

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
    if (!originAllowed(site, origin, { trusted: originTrusted })) {
      return NextResponse.json({ error: 'origin_not_allowed' }, { status: 403 });
    }

    const visitor = await getVisitor(site.id, anonymousId);
    if (!visitor) return NextResponse.json({ messages: [], status: null, staffTyping: false });

    const conversation = await getConversationForVisitor(conversationId, visitor.id);
    if (!conversation) return NextResponse.json({ messages: [], status: null, staffTyping: false });

    // Order lookups (the shopper's masked request and the card answering it)
    // are customer-scoped; the legacy GET leaves them out entirely.
    const messages = (await listMessages(conversation.id, { afterIso: after ?? null, limit: 50 }))
      .filter((m) => options.customerScope || (!m.metadata.order_card && !m.metadata.order_lookup));
    return NextResponse.json(
      {
        status: conversation.status,
        /* Freshly derived on every read: a staff typing ping younger than
           ~8s. The panel already polls here every ~15s, so this rides the
           existing cadence — coarse-grained, never instant. */
        staffTyping: isStaffTyping(conversation.metadata),
        /* Whether someone was really alerted (phase zero item 6). A retried
           alert that goes out later reaches the shopper here. */
        alert: publicAlertFor(conversation),
        /* The reply address the shopper gave, for the v16 handoff cards. */
        ...(options.customerScope ? { contactEmail: knownReplyAddress(conversation.metadata, visitor) } : {}),
        messages: messages.map((m) => ({
          id: m.id,
          clientKey: m.client_key ?? undefined,
          escalated: m.metadata.escalated ?? undefined,
          role: m.role,
          content: m.content,
          createdAt: m.created_at,
          author:
            m.metadata.author ??
            (m.role === 'assistant' ? 'ai' : m.role === 'system' ? 'system' : 'shopper'),
          feedback: m.metadata.feedback ?? undefined,
          order: m.metadata.order_card ?? undefined,
        })),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[messenger] sync failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }
}
