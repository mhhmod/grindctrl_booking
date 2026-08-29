import { NextRequest, NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { publicApiRatelimit, clientIp } from '@/lib/ratelimit';
import { loadPublicSite, originAllowed } from '@/lib/messenger/public-api';
import {
  MESSAGE_MAX_LENGTH,
  appendMessage,
  claimAiTurn,
  getConversationForVisitor,
  getVisitor,
  listMessages,
  recordAudit,
  recordEvent,
  updateConversationMetadata,
} from '@/lib/messenger/conversations';
import { parseModelTurn } from '@/lib/messenger/actions';
import { lookupOrder, ORDER_LOOKUP_LIFETIME_LIMIT } from '@/lib/messenger/orders';
import { shouldAskForContact } from '@/lib/messenger/contact';
import { escalateAndNotify } from '@/lib/messenger/escalate';
import { verifyShopperToken } from '@/lib/messenger/identity';
import {
  buildSystemPrompt,
  detectExplicitHandoffRequest,
  generateAssistantReply,
  phraseOrderAnswer,
  detectLocale,
  pickLocalized,
} from '@/lib/messenger/ai';
import { getActiveKnowledge } from '@/lib/messenger/knowledge';
import { isWithinAvailabilityHours } from '@/lib/messenger/public-api';
import type { MessengerLocale } from '@/lib/messenger/types';

/* POST /api/messenger/send
   One shopper turn. Guarantees:
   - Idempotent on clientKey: retries never duplicate the user message or
     trigger a second AI answer (unique index collapses replays).
   - The conversation's CURRENT status decides who may speak: AI answers
     only while status === 'open'. A handoff that lands mid-flight wins
     because the guarded transition happens before any AI text is stored.
   - Escalation is executed by this server code, never by prompt text. */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ANON_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

function bad(code: string, status = 400) {
  return NextResponse.json({ error: code }, { status });
}

/* Per-session send limiter: tighter than the IP limiter because a session is
   exactly one browser tab's conversation. Redis.fromEnv() only WARNS when
   env vars are missing, leaving a client that fails per-call — check
   explicitly so an unconfigured environment skips limiting loudly instead. */
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv()
    : null;
const sessionLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(8, '60 s'),
      prefix: 'gc-msgr-send',
      analytics: false,
    })
  : null;

/* Order lookups are counted per IP as well as per conversation: a new
   conversation is one localStorage clear away, so a per-conversation budget
   alone would not slow down someone guessing order numbers. Counted on
   attempts, not successes — guessing is what spends it. */
const orderLookupLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, '1 h'),
      prefix: 'gc-msgr-order',
      analytics: false,
    })
  : null;

/* Every denial reads the same, whatever went wrong. Wrong order number,
   wrong email, another store's order, budget exhausted — one sentence, so
   the chat cannot be used to discover which orders or addresses exist. */
const ORDER_DENIED = {
  en: "I couldn't find an order matching those details. If you'd like, I can bring in the team.",
  ar: 'لم أتمكن من العثور على طلب مطابق لهذه التفاصيل. يمكنني توصيلك بالفريق إذا أردت.',
};
const ORDER_UNAVAILABLE = {
  en: "I couldn't reach the store's order system just now. The team can check it for you.",
  ar: 'تعذّر الوصول إلى نظام الطلبات الآن. يمكن للفريق التحقق منه نيابةً عنك.',
};

export async function POST(request: NextRequest) {
  const ipLimit = await publicApiRatelimit.limit(`ms:${clientIp(request) ?? 'unknown'}`);
  if (!ipLimit.success) return bad('rate_limited', 429);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return bad('bad_json');
  }

  const key = typeof body.key === 'string' ? body.key : '';
  const origin = typeof body.origin === 'string' ? body.origin : null;
  const anonymousId = typeof body.anonymousId === 'string' ? body.anonymousId : '';
  const conversationId = typeof body.conversationId === 'string' ? body.conversationId : '';
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const clientKey = typeof body.clientKey === 'string' && UUID_RE.test(body.clientKey) ? body.clientKey : null;
  const shopperToken = typeof body.shopperToken === 'string' ? body.shopperToken : null;
  const localeHint: MessengerLocale | null =
    body.locale === 'ar' || body.locale === 'en' ? (body.locale as MessengerLocale) : null;

  if (!/^[a-z0-9_]{6,80}$/i.test(key)) return bad('bad_key');
  if (!ANON_ID_RE.test(anonymousId)) return bad('bad_session');
  if (!UUID_RE.test(conversationId)) return bad('bad_conversation');
  if (!text) return bad('empty_message');
  if (text.length > MESSAGE_MAX_LENGTH) return bad('message_too_long', 413);
  if (!clientKey) return bad('client_key_required');

  try {
    const site = await loadPublicSite(key);
    if (!site || site.status !== 'active') return bad('not_found', 404);
    if (!originAllowed(site, origin)) return bad('origin_not_allowed', 403);

    /* The merchant reads this alert, not the shopper, so it is deliberately
       NOT the shopper's locale. A storefront request cannot know the
       merchant's dashboard language; English until that is stored per site. */
    const notifySite = {
      id: site.id,
      name: site.name,
      workspace_id: site.workspace_id,
      locale: 'en' as const,
      notifications: site.config.notifications,
    };

    if (sessionLimiter) {
      const sessionLimit = await sessionLimiter.limit(`${key}:${anonymousId}`);
      if (!sessionLimit.success) return bad('rate_limited', 429);
    }

    const visitor = await getVisitor(site.id, anonymousId);
    if (!visitor) return bad('bad_session');
    const conversation = await getConversationForVisitor(conversationId, visitor.id);
    if (!conversation) return bad('bad_conversation', 403);

    const withinHours = isWithinAvailabilityHours(site.config.behaviour, new Date());

    /* Order lookup needs a real Shopify store to address. A site with no
       connected domain, or one pointing at something that is not a
       myshopify domain, simply does not get the capability — and the model
       is never told it exists, so it cannot offer what we would refuse. */
    const orderShopDomain =
      site.domain && /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(site.domain) ? site.domain : null;
    const orderLookupAvailable = site.config.orderLookup.enabled && Boolean(orderShopDomain);

    /* "Where should we reply?" is offered at most once per conversation, and
       only at a moment where a reply is genuinely owed later — a handoff, or
       a message sent while the store is closed. Recording the prompt is what
       makes it once-only, so it happens here rather than when the shopper
       answers: a shopper who ignores the block must not be asked again. */
    async function contactPrompt(justEscalated: boolean): Promise<true | undefined> {
      if (
        !shouldAskForContact({
          config: site!.config.contactCapture,
          alreadyPrompted: Boolean(conversation!.metadata.contact_prompted_at),
          knownEmail: conversation!.metadata.identity?.email || visitor!.user_email || null,
          justEscalated,
          withinHours,
        })
      ) {
        return undefined;
      }
      try {
        conversation!.metadata.contact_prompted_at = new Date().toISOString();
        await updateConversationMetadata(conversation!.id, conversation!.metadata);
        return true;
      } catch {
        // Failing to record the prompt means we cannot promise "once", so
        // don't ask at all rather than risk asking on every later turn.
        return undefined;
      }
    }

    // Identity refresh (token may have just been issued by the proxy).
    let identityName: string | null = conversation.metadata.identity?.name ?? null;
    let verifiedCustomer = conversation.metadata.identity?.verified === true;
    const secret = process.env.SHOPIFY_API_SECRET;
    if (secret && shopperToken) {
      const claims = verifyShopperToken(secret, shopperToken, anonymousId);
      const bound = conversation.metadata.identity?.customer_id ?? null;
      /* A token only ever confirms the customer this conversation is already
         bound to (or binds a previously anonymous one). A token for someone
         else means the browser changed hands — refuse the upgrade and let
         the next bootstrap rotate the session rather than answering as the
         previous customer. */
      if (claims?.customerId && (!bound || bound === claims.customerId)) {
        verifiedCustomer = true;
        identityName = claims.name ?? identityName;
      }
    }

    // 1) Persist the shopper's turn first (idempotent).
    const { message: userMessage, replayed } = await appendMessage({
      conversationId: conversation.id,
      role: 'user',
      content: text,
      clientKey,
      metadata: { locale: localeHint ?? detectLocale(text) },
    });

    if (replayed) {
      // Same clientKey already processed: reply with whatever exists now so
      // the caller converges without re-running the model.
      const existing = await listMessages(conversation.id, { afterIso: new Date(Date.now() - 120_000).toISOString(), limit: 10 });
      const priorReply = [...existing].reverse().find((m) => m.role === 'assistant' && m.created_at >= userMessage.created_at);
      return NextResponse.json({ userMessage: toWire(userMessage), reply: priorReply ? toWire(priorReply) : null });
    }

    // 2) Explicit "I want a human" short-circuits the model entirely.
    if (detectExplicitHandoffRequest(text)) {
      const summary = `Shopper asked for a person. Last message: "${text.slice(0, 160)}"`;
      const transitioned = site.config.ai.escalationEnabled
        ? await escalateAndNotify(conversation.id, 'shopper_requested_human', summary, notifySite)
        : null;
      if (transitioned) {
        const ack = await appendMessage({
          conversationId: conversation.id,
          role: 'system',
          content: pickLocalized(
            { en: 'You are being connected with our team — we will reply here shortly.', ar: 'جارٍ توصيلك بفريقنا — سنرد عليك هنا قريباً.' },
            localeHint ?? detectLocale(text),
          ),
          contentType: 'event',
          metadata: { author: 'system', escalated: true },
        });
        void recordEvent({ siteId: site.id, conversationId: conversation.id, eventName: 'handoff_triggered', payload: { reason: 'shopper_requested_human' } }).catch(() => {});
        return NextResponse.json({
          userMessage: toWire(userMessage),
          reply: toWire(ack.message),
          status: transitioned.status,
          askContact: await contactPrompt(true),
        });
      }
    }

    // 3) AI gate: enabled + published + within hours + still owns the mic.
    const aiEnabled = site.config.ai.enabled && withinHours;
    const ownsMic = conversation.status === 'open';

    if (!aiEnabled || !ownsMic) {
      // Closed, handed off, or outside business hours: accept the message
      // for the record. Out-of-hours is exactly when an address is worth
      // asking for, since the reply is arriving hours from now.
      return NextResponse.json({
        userMessage: toWire(userMessage),
        reply: null,
        status: conversation.status,
        askContact: await contactPrompt(false),
      });
    }

    // 4) Grounded generation.
    const locale = localeHint ?? detectLocale(text);
    const knowledge = await getActiveKnowledge(site.id);
    const history = (await listMessages(conversation.id, { limit: 20 }))
      .filter((m) => m.id !== userMessage.id)
      .slice(-16)
      .map((m) => ({ role: m.role === 'user' ? ('user' as const) : ('assistant' as const), content: m.content }));

    let result: Awaited<ReturnType<typeof generateAssistantReply>>;
    try {
      result = await generateAssistantReply({
        prompt: buildSystemPrompt({
          storeName: site.name,
          assistantName: pickLocalized(site.config.appearance.launcherLabel, locale),
          ai: site.config.ai,
          locale,
          knowledge,
          identity:
            verifiedCustomer || conversation.metadata.identity?.verified
              ? {
                  name: identityName ?? conversation.metadata.identity?.name ?? null,
                  email: conversation.metadata.identity?.email ?? null,
                  verifiedCustomer: true,
                }
              : undefined,
          orderLookupEnabled: orderLookupAvailable,
        }),
        history,
        userMessage: text,
      });
    } catch (error) {
      console.error('[messenger] ai failed:', error instanceof Error ? error.message : error);
      void recordEvent({ siteId: site.id, conversationId: conversation.id, eventName: 'ai_failed' }).catch(() => {});
      return NextResponse.json({ userMessage: toWire(userMessage), error: 'ai_unavailable' }, { status: 502 });
    }

    /* The model takes seconds; `ownsMic` above is a read from before it ran.
       Re-assert ownership atomically before anything generated is stored,
       so a staff takeover that lands mid-generation is not talked over. */
    if (!(await claimAiTurn(conversation.id))) {
      void recordEvent({
        siteId: site.id,
        conversationId: conversation.id,
        eventName: 'ai_reply_discarded',
        payload: { reason: 'human_took_over_mid_turn' },
      }).catch(() => {});
      const current = await getConversationForVisitor(conversation.id, visitor.id);
      return NextResponse.json({
        userMessage: toWire(userMessage),
        reply: null,
        status: current?.status ?? 'handoff_active',
      });
    }

    /* ── The action seam ──────────────────────────────────────────────
       The model may have asked for an order lookup instead of answering.
       Authorization is re-derived here, not read from what it wrote: the
       customer id comes from the conversation's verified identity, and the
       model's own arguments are only ever the shopper's claimed proof. */
    // `raw` is the source of truth; `reply` only ever has the HANDOFF
    // sentinel stripped, so it is a safe fallback if raw ever arrives empty.
    /* A turn that also asked for a human loses its action: the escalation
       branch below wins. Reaching a person is the more important of the two
       and dropping it to run a lookup would strand the shopper. */
    const escalating = result.escalate && site.config.ai.escalationEnabled;
    const turn = escalating
      ? ({ kind: 'prose', text: result.reply } as const)
      : parseModelTurn(result.raw || result.reply);

    if (turn.kind === 'rejected' || (turn.kind === 'action' && !orderLookupAvailable)) {
      const reason = turn.kind === 'rejected' ? turn.reason : 'capability_disabled';
      void recordAudit({
        siteId: site.id,
        action: 'ai_action_rejected',
        detail: { conversation_id: conversation.id, reason },
      }).catch(() => {});
      const saved = await appendMessage({
        conversationId: conversation.id,
        role: 'assistant',
        content: pickLocalized(ORDER_UNAVAILABLE, locale),
        metadata: { author: 'ai', locale },
      });
      return NextResponse.json({ userMessage: toWire(userMessage), reply: toWire(saved.message), status: 'open' });
    }

    if (turn.kind === 'action' && orderShopDomain) {
      const attempts = (conversation.metadata.order_lookup_attempts ?? 0) + 1;
      const ipLookupLimit = orderLookupLimiter
        ? await orderLookupLimiter.limit(`${key}:${clientIp(request) ?? 'unknown'}`)
        : { success: true };

      // Attempts are spent before the lookup runs, so a wrong guess costs
      // the same as a right one. Persisted regardless of the outcome.
      conversation.metadata.order_lookup_attempts = attempts;
      await updateConversationMetadata(conversation.id, conversation.metadata).catch(() => {});

      const overBudget = attempts > ORDER_LOOKUP_LIFETIME_LIMIT || !ipLookupLimit.success;
      const outcome = overBudget
        ? ({ ok: false, reason: 'rate_limited' } as const)
        : await lookupOrder({
            shopDomain: orderShopDomain,
            // Server-derived. A model that invents a customer id cannot
            // reach this argument — there is no field for it in the schema.
            verifiedCustomerId:
              verifiedCustomer && conversation.metadata.identity?.customer_id
                ? conversation.metadata.identity.customer_id
                : null,
            orderNumber: turn.action.orderNumber,
            email: turn.action.email,
          });

      if (outcome.ok) {
        void recordAudit({
          siteId: site.id,
          action: 'order_lookup_performed',
          detail: { conversation_id: conversation.id, order_number: outcome.facts.order_number },
        }).catch(() => {});
        let answer: string;
        try {
          answer = await phraseOrderAnswer({
            prompt: buildSystemPrompt({
              storeName: site.name,
              assistantName: pickLocalized(site.config.appearance.launcherLabel, locale),
              ai: site.config.ai,
              locale,
              knowledge,
            }),
            history,
            userMessage: text,
            facts: outcome.facts,
          });
        } catch {
          answer = pickLocalized(ORDER_UNAVAILABLE, locale);
        }
        const saved = await appendMessage({
          conversationId: conversation.id,
          role: 'assistant',
          content: answer,
          metadata: { author: 'ai', locale },
        });
        void recordEvent({ siteId: site.id, conversationId: conversation.id, eventName: 'order_lookup_performed' }).catch(() => {});
        return NextResponse.json({ userMessage: toWire(userMessage), reply: toWire(saved.message), status: 'open' });
      }

      void recordAudit({
        siteId: site.id,
        action: 'order_lookup_denied',
        // The precise reason is recorded here and nowhere the shopper can
        // see it. That asymmetry is the point.
        detail: { conversation_id: conversation.id, reason: outcome.reason, attempts },
      }).catch(() => {});
      const unavailable =
        outcome.reason === 'not_configured' ||
        outcome.reason === 'no_scope' ||
        outcome.reason === 'provider_error';
      const saved = await appendMessage({
        conversationId: conversation.id,
        role: 'assistant',
        content: pickLocalized(unavailable ? ORDER_UNAVAILABLE : ORDER_DENIED, locale),
        metadata: { author: 'ai', locale },
      });
      void recordEvent({
        siteId: site.id,
        conversationId: conversation.id,
        eventName: 'order_lookup_denied',
        payload: { reason: outcome.reason },
      }).catch(() => {});
      return NextResponse.json({ userMessage: toWire(userMessage), reply: toWire(saved.message), status: 'open' });
    }

    if (escalating) {
      const transitioned = await escalateAndNotify(
        conversation.id,
        'assistant_escalated',
        `Conversation handed off after shopper message: "${text.slice(0, 160)}"`,
        notifySite,
      );
      const saved = await appendMessage({
        conversationId: conversation.id,
        role: 'assistant',
        content: result.reply,
        metadata: { author: 'ai', locale, escalated: transitioned ? true : undefined },
      });
      if (transitioned) {
        await appendMessage({
          conversationId: conversation.id,
          role: 'system',
          content: pickLocalized(
            { en: 'You are being connected with our team — we will reply here shortly.', ar: 'جارٍ توصيلك بفريقنا — سنرد عليك هنا قريباً.' },
            locale,
          ),
          contentType: 'event',
          metadata: { author: 'system', escalated: true },
        });
        void recordEvent({ siteId: site.id, conversationId: conversation.id, eventName: 'handoff_triggered', payload: { reason: 'assistant_escalated' } }).catch(() => {});
        return NextResponse.json({
          userMessage: toWire(userMessage),
          reply: toWire(saved.message),
          status: transitioned.status,
          askContact: await contactPrompt(true),
        });
      }
      return NextResponse.json({ userMessage: toWire(userMessage), reply: toWire(saved.message), status: 'open' });
    }

    const saved = await appendMessage({
      conversationId: conversation.id,
      role: 'assistant',
      content: result.reply,
      metadata: { author: 'ai', locale },
    });
    void recordEvent({ siteId: site.id, conversationId: conversation.id, eventName: 'ai_replied' }).catch(() => {});
    return NextResponse.json({ userMessage: toWire(userMessage), reply: toWire(saved.message), status: 'open' });
  } catch (error) {
    console.error('[messenger] send failed:', error instanceof Error ? error.message : error);
    return bad('unavailable', 503);
  }
}

function toWire(m: {
  id: string;
  role: string;
  content: string;
  created_at: string;
  metadata?: { author?: string; escalated?: boolean };
}) {
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    createdAt: m.created_at,
    author:
      m.metadata?.author ??
      (m.role === 'assistant' ? 'ai' : m.role === 'system' ? 'system' : 'shopper'),
    escalated: m.metadata?.escalated === true || undefined,
  };
}
