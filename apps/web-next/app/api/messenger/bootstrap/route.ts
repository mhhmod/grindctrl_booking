import { NextRequest, NextResponse } from 'next/server';
import { publicApiRatelimit, clientIp } from '@/lib/ratelimit';
import { loadPublicSite, originAllowed } from '@/lib/messenger/public-api';
import {
  ensureOpenConversation,
  getVisitor,
  listMessages,
  recordEvent,
  upsertVisitor,
} from '@/lib/messenger/conversations';
import { getMessengerServiceClient } from '@/lib/messenger/db';
import { verifyShopperToken } from '@/lib/messenger/identity';
import type { MessengerLocale } from '@/lib/messenger/types';

/* POST /api/messenger/bootstrap
   Establishes (or restores) the shopper's session: visitor + active
   conversation + message history. Runs before the messenger UI paints its
   thread so a refresh restores exactly where the shopper left off. */

const ANON_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const LOCALES: MessengerLocale[] = ['en', 'ar'];

function bad(code: string, status = 400) {
  return NextResponse.json({ error: code }, { status });
}

export async function POST(request: NextRequest) {
  const limit = await publicApiRatelimit.limit(`mb:${clientIp(request) ?? 'unknown'}`);
  if (!limit.success) return bad('rate_limited', 429);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return bad('bad_json');
  }

  const key = typeof body.key === 'string' ? body.key : '';
  const origin = typeof body.origin === 'string' ? body.origin : null;
  const localeHint = LOCALES.includes(body.locale as MessengerLocale)
    ? (body.locale as MessengerLocale)
    : null;
  const pageUrl = typeof body.pageUrl === 'string' ? body.pageUrl.slice(0, 500) : null;

  if (!/^[a-z0-9_]{6,80}$/i.test(key)) return bad('bad_key');
  if (
    body.anonymousId !== undefined &&
    (typeof body.anonymousId !== 'string' || !ANON_ID_RE.test(body.anonymousId))
  ) {
    return bad('bad_anonymous_id');
  }

  try {
    const site = await loadPublicSite(key);
    if (!site || site.status === 'disabled') return bad('not_found', 404);
    if (!originAllowed(site, origin)) return bad('origin_not_allowed', 403);

    // Anonymous identity: server-issued on first bootstrap when absent.
    const anonymousId =
      typeof body.anonymousId === 'string' && ANON_ID_RE.test(body.anonymousId)
        ? body.anonymousId
        : crypto.randomUUID().replace(/-/g, '');

    // Verified shopper identity (optional): short-lived JWT previously issued
    // by the Shopify proxy route. Bound to this anonymous session id.
    let identity: { customerId: string; email: string; name: string } | null = null;
    const secret = process.env.SHOPIFY_API_SECRET;
    if (secret && typeof body.shopperToken === 'string') {
      const claims = verifyShopperToken(secret, body.shopperToken, anonymousId);
      if (claims?.customerId) {
        identity = {
          customerId: claims.customerId,
          email: claims.email ?? '',
          name: claims.name ?? '',
        };
      }
    }

    let sessionId = anonymousId;
    let visitor = await upsertVisitor({
      siteId: site.id,
      anonymousId: sessionId,
      identity,
    });
    let conversation = await ensureOpenConversation(site.id, visitor.id);
    void getVisitor; // retained for future lightweight existence checks

    /* A browser outlives its shopper. If this conversation is bound to a
       customer other than the one presenting now — including "nobody", which
       is what a logout looks like — the previous customer's transcript and
       verified identity must not carry over. Rotate the session instead:
       new anonymous id, new visitor, new conversation. */
    const boundCustomer = conversation.metadata.identity?.customer_id ?? null;
    const presentCustomer = identity?.customerId ?? null;
    if (boundCustomer && boundCustomer !== presentCustomer) {
      sessionId = crypto.randomUUID().replace(/-/g, '');
      visitor = await upsertVisitor({ siteId: site.id, anonymousId: sessionId, identity });
      conversation = await ensureOpenConversation(site.id, visitor.id);
    }

    const supabase = getMessengerServiceClient();
    const patch: Record<string, unknown> = {};
    if (identity && conversation.metadata.identity?.verified !== true) {
      // Declared shape is snake_case (ConversationRecord.metadata.identity);
      // spreading the camelCase claims here silently wrote a key no reader
      // ever looked at, which is what defeated the binding check.
      conversation.metadata.identity = {
        customer_id: identity.customerId,
        email: identity.email,
        name: identity.name,
        verified: true,
      };
      patch.metadata = conversation.metadata;
    }
    if (pageUrl && pageUrl !== conversation.metadata.last_page_url) {
      conversation.metadata.last_page_url = pageUrl;
      patch.metadata = conversation.metadata;
    }
    if (Object.keys(patch).length > 0) {
      await supabase.from('widget_conversations').update(patch).eq('id', conversation.id);
    }
    void recordEvent({
      siteId: site.id,
      conversationId: conversation.id,
      eventName: 'messenger_opened',
      payload: { locale: localeHint ?? undefined, verified: Boolean(identity) },
    }).catch(() => {});

    const messages = await listMessages(conversation.id, { limit: 60 });

    return NextResponse.json({
      anonymousId: sessionId,
      conversationId: conversation.id,
      status: conversation.status,
      aiEnabled: site.config.ai.enabled && site.status === 'active',
      storeName: site.name,
      v: site.settings_version,
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.created_at,
        author: m.metadata.author ?? (m.role === 'assistant' ? 'ai' : undefined),
      })),
    });
  } catch (error) {
    console.error('[messenger] bootstrap failed:', error instanceof Error ? error.message : error);
    return bad('unavailable', 503);
  }
}
