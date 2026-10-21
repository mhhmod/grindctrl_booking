import { NextRequest, NextResponse } from 'next/server';
import { requireRateLimit, RequestRateLimitError, rateLimitErrorResponse } from '@/lib/request-rate-limit';
import { publicApiRatelimit, clientIp } from '@/lib/ratelimit';
import { resolveShopperSession } from '@/lib/messenger/public-session';
import { appendMessage, recordAudit, recordEvent, updateConversationMetadata } from '@/lib/messenger/conversations';
import { lookupGuestOrderCard, ORDER_LOOKUP_LIFETIME_LIMIT } from '@/lib/messenger/orders';
import { orderLookupLimiter, orderNumberLimiter } from '@/lib/messenger/order-limits';
import { maskEmail, normalizeOrderNumber, ORDER_CONTACT_EMAIL_RE, orderShopDomain } from '@/lib/messenger/order-card';
import { ORDER_DENIED, ORDER_UNAVAILABLE, orderFoundLine } from '@/lib/messenger/order-copy';
import { pickLocalized } from '@/lib/messenger/ai';
import { flagStoreForSite, storeFlags } from '@/lib/flags/store-flags';
import type { MessageRecord } from '@/lib/messenger/types';

/* POST /api/messenger/order-lookup  (Chat-More, contract N48; v16_chat)
   The guest order lookup inside the chat: the order number and the email
   it was placed with, checked here and never through the model. Every
   denial answers the same `not_found` with one sentence, whatever went
   wrong. Attempts are spent before the lookup runs: per conversation (5 for
   life, shared with the chat's own lookups), per address and store (20 an
   hour) and per order number (10 a day). The shopper's line keeps only a
   masked email, and the card comes from the store's own order data. Phone
   matching waits for Shopify's protected customer data approval. */

function toWire(m: MessageRecord) {
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    createdAt: m.created_at,
    author: m.metadata.author ?? (m.role === 'assistant' ? 'ai' : 'shopper'),
    order: m.metadata.order_card ?? undefined,
  };
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request) ?? 'unknown';
  try {
    await requireRateLimit(publicApiRatelimit, `mol:${ip}`);
  } catch (error) {
    if (error instanceof RequestRateLimitError) return rateLimitErrorResponse(error);
    throw error;
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }
  const orderNumber = normalizeOrderNumber(body.orderNumber);
  const contact = typeof body.contact === 'string' ? body.contact.trim() : '';
  // The form checks these first; only a well-formed pair is ever looked up.
  if (!orderNumber || contact.length > 254 || !ORDER_CONTACT_EMAIL_RE.test(contact)) {
    return NextResponse.json({ ok: false, error: 'bad_input' }, { status: 400 });
  }
  const locale = body.locale === 'ar' ? 'ar' : 'en';

  try {
    const session = await resolveShopperSession({
      key: body.key,
      origin: body.origin,
      originToken: body.originToken,
      anonymousId: body.anonymousId,
      conversationId: body.conversationId,
    });
    if (!session.ok) {
      return NextResponse.json({ ok: false, error: session.code }, { status: session.status });
    }
    const { site, conversation } = session;

    const features = await storeFlags(flagStoreForSite(site));
    if (!features.includes('v16_chat')) {
      return NextResponse.json({ ok: false, error: 'not_enabled' }, { status: 404 });
    }
    const shopDomain = orderShopDomain(site.domain);
    if (!site.config.orderLookup.enabled || !shopDomain) {
      return NextResponse.json({ ok: false, error: 'not_enabled' }, { status: 404 });
    }

    const attempts = (conversation.metadata.order_lookup_attempts ?? 0) + 1;
    conversation.metadata.order_lookup_attempts = attempts;
    await updateConversationMetadata(conversation.id, conversation.metadata).catch(() => {});

    let gate: 'open' | 'spent' | 'unavailable' = attempts <= ORDER_LOOKUP_LIFETIME_LIMIT ? 'open' : 'spent';
    if (gate === 'open') {
      try {
        await requireRateLimit(orderLookupLimiter, `${site.id}:${ip}`);
        await requireRateLimit(orderNumberLimiter, `${site.id}:${orderNumber}`);
      } catch (error) {
        if (!(error instanceof RequestRateLimitError)) throw error;
        /* A spent budget answers like a wrong guess. Limits that cannot be
           enforced refuse too, as unavailable, which says nothing about
           the order either. */
        gate = error.status === 429 ? 'spent' : 'unavailable';
      }
    }

    const outcome =
      gate === 'open'
        ? await lookupGuestOrderCard({
            shopDomain,
            orderNumber,
            email: contact,
            withAmounts: features.includes('n47_order_cards'),
          })
        : ({ ok: false, reason: gate === 'spent' ? 'rate_limited' : 'limits_unavailable' } as const);

    const asked = await appendMessage({
      conversationId: conversation.id,
      role: 'user',
      content: `#${orderNumber} · ${maskEmail(contact)}`,
      metadata: { locale, order_lookup: true },
    });

    if (outcome.ok) {
      const reply = await appendMessage({
        conversationId: conversation.id,
        role: 'assistant',
        content: orderFoundLine(outcome.card, locale),
        metadata: { author: 'ai', locale, order_card: outcome.card },
      });
      void recordAudit({
        siteId: site.id,
        action: 'order_lookup_performed',
        detail: { conversation_id: conversation.id, order_number: orderNumber, via: 'form' },
      }).catch(() => {});
      void recordEvent({
        siteId: site.id,
        conversationId: conversation.id,
        eventName: 'order_lookup_performed',
        payload: { via: 'form' },
      }).catch(() => {});
      return NextResponse.json({
        ok: true,
        order: outcome.card,
        maskedContact: maskEmail(contact),
        messages: [toWire(asked.message), toWire(reply.message)],
      });
    }

    // The precise reason is kept here and nowhere the shopper can see it.
    void recordAudit({
      siteId: site.id,
      action: 'order_lookup_denied',
      detail: { conversation_id: conversation.id, reason: outcome.reason, attempts, via: 'form' },
    }).catch(() => {});
    void recordEvent({
      siteId: site.id,
      conversationId: conversation.id,
      eventName: 'order_lookup_denied',
      payload: { reason: outcome.reason, via: 'form' },
    }).catch(() => {});
    const unavailable =
      outcome.reason === 'not_configured' ||
      outcome.reason === 'no_scope' ||
      outcome.reason === 'provider_error' ||
      outcome.reason === 'limits_unavailable';
    const reply = await appendMessage({
      conversationId: conversation.id,
      role: 'assistant',
      content: pickLocalized(unavailable ? ORDER_UNAVAILABLE : ORDER_DENIED, locale),
      metadata: { author: 'ai', locale },
    });
    return NextResponse.json({
      ok: false,
      error: unavailable ? 'unavailable' : 'not_found',
      messages: [toWire(asked.message), toWire(reply.message)],
    });
  } catch (error) {
    console.error('[messenger] order lookup form failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503 });
  }
}
