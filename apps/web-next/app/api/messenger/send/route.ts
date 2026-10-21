import { NextRequest, NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { publicApiRatelimit, clientIp } from '@/lib/ratelimit';
import { requireRateLimit, RequestRateLimitError, rateLimitErrorResponse } from '@/lib/request-rate-limit';
import { loadPublicSite, originAllowed, provenOrigin } from '@/lib/messenger/public-api';
import {
  MESSAGE_MAX_LENGTH,
  appendMessage,
  claimAiTurn,
  claimAiTurnWhileWaiting,
  ensureOpenConversation,
  getConversationForVisitor,
  getVisitor,
  listMessages,
  patchConversationMetadata,
  recordAudit,
  recordEvent,
  updateConversationMetadata,
} from '@/lib/messenger/conversations';
import { parseModelTurn } from '@/lib/messenger/actions';
import { lookupOrder, ORDER_LOOKUP_LIFETIME_LIMIT } from '@/lib/messenger/orders';
import { orderLookupLimiter } from '@/lib/messenger/order-limits';
import { ORDER_DENIED, ORDER_UNAVAILABLE } from '@/lib/messenger/order-copy';
import { shouldAskForContact } from '@/lib/messenger/contact';
import { escalateAndNotify, type Escalation } from '@/lib/messenger/escalate';
import { handoffLine } from '@/lib/messenger/handoff-copy';
import { toPublicHandoffAlert } from '@/lib/messenger/handoff-alert';
import { teamHours } from '@/lib/messenger/hours';
import { flagStoreForSite, storeFlags } from '@/lib/flags/store-flags';
import { verifyShopperTokenAnyApp } from '@/lib/messenger/identity';
import {
  buildSystemPrompt,
  detectExplicitHandoffRequest,
  generateAssistantReply,
  phraseOrderAnswer,
  resolveReplyLocale,
  pickLocalized,
  isFrancoArabic,
} from '@/lib/messenger/ai';
import { getActiveKnowledge } from '@/lib/messenger/knowledge';
import { isWithinAvailabilityHours } from '@/lib/messenger/public-api';
import { readShopperMessage } from '@/lib/messenger/handoff-intent';
import {
  isBigCart,
  mergeTags,
  ruleHandoffReason,
  tagsFor,
  type HandoffRuleReason,
} from '@/lib/messenger/handoff-rules';
import { parseCart } from '@/lib/messenger/cart';
import { recordUnansweredQuestion } from '@/lib/messenger/questions';
import type { MessengerLocale } from '@/lib/messenger/types';

/* POST /api/messenger/send
   One shopper turn. Guarantees:
   - Idempotent on clientKey: retries never duplicate the user message or
     trigger a second AI answer (unique index collapses replays).
   - The conversation's CURRENT status decides who may speak: AI answers
     only while status === 'open'. A handoff that lands mid-flight wins
     because the guarded transition happens before any AI text is stored.
   - Escalation is executed by this server code, never by prompt text.
     With n25_handoff_rules on, the store's rules decide it too: from a
     reading of the message before the model, and from the model's reply
     verdict after it (phase zero item 10). */

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

export async function POST(request: NextRequest) {
  try {
    await requireRateLimit(publicApiRatelimit, `ms:${clientIp(request) ?? 'unknown'}`);
  } catch (error) {
    if (error instanceof RequestRateLimitError) return rateLimitErrorResponse(error);
    throw error;
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return bad('bad_json');
  }

  const key = typeof body.key === 'string' ? body.key : '';
  const { origin, trusted: originTrusted } = provenOrigin(
    typeof body.key === 'string' ? body.key : '',
    body,
  );
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
    if (!originAllowed(site, origin, { trusted: originTrusted })) {
      return bad('origin_not_allowed', 403);
    }

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

    await requireRateLimit(sessionLimiter, `${site.id}:${anonymousId}`);

    const visitor = await getVisitor(site.id, anonymousId);
    if (!visitor) return bad('bad_session');
    let conversation = await getConversationForVisitor(conversationId, visitor.id);
    if (!conversation) return bad('bad_conversation', 403);

    /* A shopper writing into a thread the merchant already resolved is
       starting a new conversation, not continuing a finished one.

       Without this the message was accepted with a 200 and appended to the
       closed thread, where nothing could ever answer it: aiMayAnswer requires
       status 'open', and a resolved conversation is not flagged for the team
       either. The shopper saw their message delivered and waited for a reply
       that no one would ever be asked to write. Reviving here rather than in
       the client keeps a stale conversation id in one browser's localStorage
       from being able to strand a shopper the same way. */
    if (conversation.status === 'closed') {
      conversation = await ensureOpenConversation(site.id, visitor.id);
    }

    /* The conversation can therefore change mid-request, so every successful
       response states which one the client should now be on. */
    const conv = () => conversation;
    function ok(body: Record<string, unknown>) {
      return NextResponse.json({ conversationId: conv().id, ...body });
    }

    const now = new Date();
    const withinHours = isWithinAvailabilityHours(site.config.behaviour, now);

    /* n23_after_hours (phase zero item 7): opening hours describe the team
       only. The assistant answers at any hour, and a request for a person
       while the team is away alerts nobody until it is back. Off, hours
       keep deciding whether the assistant answers, as before. */
    const features = await storeFlags(flagStoreForSite(site));
    const afterHoursMode = features.includes('n23_after_hours');
    const team = afterHoursMode ? teamHours(site.config.behaviour, now) : null;
    const teamIsIn = team ? team.open : withinHours;
    /* n24_assistant_down (phase zero item 8): when both model providers
       fail, the message reads as saved and the team is one tap away. */
    const assistantDownMode = features.includes('n24_assistant_down');
    /* n25_handoff_rules: refunds, exchanges and order changes, an upset
       shopper and big orders reach a person, and the conversation is tagged
       for the Inbox. n8_unanswered_questions: what the assistant could not
       answer is kept for Knowledge. Either one asks the model for its reply
       verdict. */
    const handoffRulesOn = features.includes('n25_handoff_rules');
    const questionsOn = features.includes('n8_unanswered_questions');
    const rules = site.config.ai.handoffRules;

    /** Hands the conversation to the team, deferring the alert to opening
     *  time when the team is away and n23_after_hours is on. */
    function escalate(reason: string, summary: string): Promise<Escalation | null> {
      return escalateAndNotify(
        conversation!.id,
        reason,
        summary,
        notifySite,
        team && !team.open ? { deferUntil: team.opensAtIso } : {},
      );
    }

    /** The transcript line and the answer fields for a won handoff. */
    async function handedOff(escalation: Escalation, locale: MessengerLocale) {
      const line = await appendMessage({
        conversationId: conversation!.id,
        role: 'system',
        content: pickLocalized(handoffLine(escalation.alert.status), locale),
        contentType: 'event',
        metadata: { author: 'system', escalated: true },
      });
      // A later write from this turn's copy of the row must keep the outcome.
      conversation!.metadata.handoff_alert = escalation.alert;
      return {
        line: line.message,
        alert: toPublicHandoffAlert(escalation.alert),
        team,
      };
    }

    /** Adds topic tags (N25) to the conversation, merged with its own. */
    async function tag(signal: Parameters<typeof tagsFor>[0]): Promise<void> {
      if (!handoffRulesOn) return;
      const before = conversation!.metadata.tags ?? [];
      const next = mergeTags(before, tagsFor(signal));
      if (next.length === before.length) return;
      conversation!.metadata.tags = next;
      await patchConversationMetadata(conversation!.id, { tags: next }).catch(() => {});
    }

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
          withinHours: teamIsIn,
        })
      ) {
        return undefined;
      }
      try {
        const promptedAt = new Date().toISOString();
        conversation!.metadata.contact_prompted_at = promptedAt;
        // Merged into the row as it is now, so the handoff alert outcome
        // written meanwhile survives.
        await patchConversationMetadata(conversation!.id, { contact_prompted_at: promptedAt });
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
    if (shopperToken) {
      const claims = verifyShopperTokenAnyApp(shopperToken, anonymousId, site.domain);
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
      metadata: { locale: resolveReplyLocale(text, localeHint) },
    });

    if (replayed) {
      // Same clientKey already processed: reply with whatever exists now so
      // the caller converges without re-running the model.
      const existing = await listMessages(conversation.id, { afterIso: new Date(Date.now() - 120_000).toISOString(), limit: 10 });
      const priorReply = [...existing].reverse().find((m) => m.role === 'assistant' && m.created_at >= userMessage.created_at);
      return ok({ userMessage: toWire(userMessage), reply: priorReply ? toWire(priorReply) : null });
    }

    /* What the message is about, read before the model (phase zero item
       10): asking for a person, a request about the shopper's own order, a
       big order, a policy question. And the cart the panel last posted. */
    const reading = readShopperMessage(text, { piecesOfOne: rules.bigOrder.piecesOfOne });
    const bigCart = handoffRulesOn && isBigCart(parseCart(conversation.metadata.cart), rules.bigOrder);
    // A big cart brings in a person once; the tag records that it did.
    const bigCartHandled = (conversation.metadata.tags ?? []).includes('bulk_order');
    await tag({ intent: reading.intent, bigCart, language: reading.language });

    /** Hands off before the model runs, answering with the handoff line. */
    async function handOffBeforeModel(reason: string, summary: string) {
      const escalation = site!.config.ai.escalationEnabled ? await escalate(reason, summary) : null;
      if (!escalation) return null;
      const handed = await handedOff(escalation, resolveReplyLocale(text, localeHint));
      void recordEvent({ siteId: site!.id, conversationId: conversation!.id, eventName: 'handoff_triggered', payload: { reason, alert: escalation.alert.status } }).catch(() => {});
      return ok({
        userMessage: toWire(userMessage),
        reply: toWire(handed.line),
        status: escalation.conversation.status,
        alert: handed.alert,
        team: handed.team,
        askContact: await contactPrompt(true),
      });
    }

    // 2) Explicit "I want a human" short-circuits the model entirely.
    if (detectExplicitHandoffRequest(text)) {
      const handed = await handOffBeforeModel(
        'shopper_requested_human',
        `Shopper asked for a person. Last message: "${text.slice(0, 160)}"`,
      );
      if (handed) return handed;
    }

    // 2b) The store's rules (n25): a request to refund, exchange or change
    //     an order, or a big order, goes to the team the same way.
    const readingReason = handoffRulesOn ? ruleHandoffReason(rules, { intent: reading.intent }) : null;
    if (readingReason) {
      const handed = await handOffBeforeModel(`rule_${readingReason}`, ruleSummary(readingReason, text));
      if (handed) return handed;
    }

    // 3) AI gate: enabled + published + within hours + still owns the mic.
    //    With n23_after_hours on, hours no longer silence the assistant, and
    //    it keeps helping a shopper who is waiting for the team to come in.
    const aiEnabled = site.config.ai.enabled && (afterHoursMode || withinHours);
    const waitingAfterHours = Boolean(team && !team.open) && conversation.status === 'handoff_requested';
    const ownsMic = conversation.status === 'open' || waitingAfterHours;

    if (!aiEnabled || !ownsMic) {
      // Closed, handed off, or outside business hours: accept the message
      // for the record. Out-of-hours is exactly when an address is worth
      // asking for, since the reply is arriving hours from now.
      return ok({
        userMessage: toWire(userMessage),
        reply: null,
        status: conversation.status,
        askContact: await contactPrompt(false),
      });
    }

    // 4) Grounded generation.
    const locale = resolveReplyLocale(text, localeHint);
    const knowledge = await getActiveKnowledge(site.id);
    /* The newest messages, not the oldest: listMessages returns the oldest
       first unless asked (phase zero item 11), so a long conversation used
       to show the model its opening instead of what was just said. */
    const history = (await listMessages(conversation.id, { limit: 20, newestFirst: true }))
      .reverse()
      .filter((m) => m.id !== userMessage.id)
      .slice(-16)
      .map((m) => ({ role: m.role === 'user' ? ('user' as const) : ('assistant' as const), content: m.content }));
    const askVerdict = handoffRulesOn || questionsOn;

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
          franco: locale === 'ar' && isFrancoArabic(text),
          query: text,
          handoffRules: handoffRulesOn ? rules : null,
          verdict: askVerdict,
        }),
        history,
        userMessage: text,
        verdict: askVerdict,
      });
    } catch (error) {
      console.error('[messenger] ai failed:', error instanceof Error ? error.message : error);
      void recordEvent({ siteId: site.id, conversationId: conversation.id, eventName: 'ai_failed' }).catch(() => {});
      if (assistantDownMode) {
        // The message was stored before the model ran: it is saved, and the
        // panel offers to send it to the team.
        return ok({
          userMessage: toWire(userMessage),
          reply: null,
          saved: true,
          assistant: 'unavailable',
          status: conversation.status,
        });
      }
      return NextResponse.json({ userMessage: toWire(userMessage), error: 'ai_unavailable' }, { status: 502 });
    }

    /* The model takes seconds; `ownsMic` above is a read from before it ran.
       Re-assert ownership atomically before anything generated is stored,
       so a staff takeover that lands mid-generation is not talked over. */
    if (!(await (waitingAfterHours ? claimAiTurnWhileWaiting(conversation.id) : claimAiTurn(conversation.id)))) {
      void recordEvent({
        siteId: site.id,
        conversationId: conversation.id,
        eventName: 'ai_reply_discarded',
        payload: { reason: 'human_took_over_mid_turn' },
      }).catch(() => {});
      const current = await getConversationForVisitor(conversation.id, visitor.id);
      return ok({
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
    const verdict = result.verdict;
    if (questionsOn && verdict && !verdict.answered) {
      // Kept for Knowledge (N8). Losing the record never costs the reply.
      await recordUnansweredQuestion({
        siteId: site.id,
        conversationId: conversation.id,
        messageId: userMessage.id,
        question: text,
        language: reading.language,
        product: verdict.product,
        pageUrl: conversation.metadata.last_page_url ?? null,
      }).catch((error) => {
        console.error('[messenger] unanswered question not kept:', error instanceof Error ? error.message : error);
      });
    }

    const parsedTurn = parseModelTurn(result.raw || result.reply);
    /* The store's rules, from the verdict and the cart (n25). A shopper
       already waiting for the team after hours has nothing new to hand
       off, and an order lookup the model asked for runs first. */
    /* Where the reading saw a question about a policy, a verdict calling it
       a request is not enough on its own: in a live test the model labelled
       "ينفع أبدل المقاس؟" (can I exchange the size?) an exchange request
       while answering it from the policy. */
    const verdictIntent =
      reading.intent === 'policy_question' &&
      (verdict?.intent === 'refund_request' || verdict?.intent === 'exchange_request' || verdict?.intent === 'order_change')
        ? 'policy_question'
        : (verdict?.intent ?? null);
    await tag({ intent: verdictIntent, upset: verdict?.upset });
    const verdictReason =
      handoffRulesOn && !waitingAfterHours && parsedTurn.kind === 'prose'
        ? ruleHandoffReason(rules, {
            intent: verdictIntent,
            upset: verdict?.upset,
            bigCart: bigCart && !bigCartHandled,
          })
        : null;
    const escalating = (result.escalate || Boolean(verdictReason)) && site.config.ai.escalationEnabled;
    const turn = escalating ? ({ kind: 'prose', text: result.reply } as const) : parsedTurn;

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
      return ok({ userMessage: toWire(userMessage), reply: toWire(saved.message), status: conversation.status });
    }

    if (turn.kind === 'action' && orderShopDomain) {
      const attempts = (conversation.metadata.order_lookup_attempts ?? 0) + 1;
      let lookupAllowed = false;
      try {
        await requireRateLimit(orderLookupLimiter, `${site.id}:${clientIp(request) ?? 'unknown'}`);
        lookupAllowed = true;
      } catch (error) {
        if (!(error instanceof RequestRateLimitError)) throw error;
        // Keep order-denial copy identical: never disclose order existence
        // or execute a lookup when its anti-enumeration gate is unavailable.
      }

      // Attempts are spent before the lookup runs, so a wrong guess costs
      // the same as a right one. Persisted regardless of the outcome.
      conversation.metadata.order_lookup_attempts = attempts;
      await updateConversationMetadata(conversation.id, conversation.metadata).catch(() => {});

      const overBudget = attempts > ORDER_LOOKUP_LIFETIME_LIMIT || !lookupAllowed;
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
              franco: locale === 'ar' && isFrancoArabic(text),
              query: text,
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
        return ok({ userMessage: toWire(userMessage), reply: toWire(saved.message), status: conversation.status });
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
      return ok({ userMessage: toWire(userMessage), reply: toWire(saved.message), status: conversation.status });
    }

    if (escalating) {
      // Already waiting on the team (after hours): nothing new to hand off.
      const escalationReason = result.escalate || !verdictReason ? 'assistant_escalated' : `rule_${verdictReason}`;
      const escalation = waitingAfterHours
        ? null
        : await escalate(
            escalationReason,
            verdictReason && !result.escalate
              ? ruleSummary(verdictReason, text)
              : `Conversation handed off after shopper message: "${text.slice(0, 160)}"`,
          );
      const saved = await appendMessage({
        conversationId: conversation.id,
        role: 'assistant',
        content: result.reply,
        metadata: { author: 'ai', locale, escalated: escalation ? true : undefined },
      });
      if (escalation) {
        const handed = await handedOff(escalation, locale);
        void recordEvent({ siteId: site.id, conversationId: conversation.id, eventName: 'handoff_triggered', payload: { reason: escalationReason, alert: escalation.alert.status } }).catch(() => {});
        return ok({
          userMessage: toWire(userMessage),
          reply: toWire(saved.message),
          status: escalation.conversation.status,
          alert: handed.alert,
          team: handed.team,
          askContact: await contactPrompt(true),
        });
      }
      return ok({ userMessage: toWire(userMessage), reply: toWire(saved.message), status: conversation.status });
    }

    const saved = await appendMessage({
      conversationId: conversation.id,
      role: 'assistant',
      content: result.reply,
      metadata: { author: 'ai', locale },
    });
    void recordEvent({ siteId: site.id, conversationId: conversation.id, eventName: 'ai_replied' }).catch(() => {});
    return ok({ userMessage: toWire(userMessage), reply: toWire(saved.message), status: conversation.status });
  } catch (error) {
    if (error instanceof RequestRateLimitError) return rateLimitErrorResponse(error);
    console.error('[messenger] send failed:', error instanceof Error ? error.message : error);
    return bad('unavailable', 503);
  }
}

/** The line the team reads in the alert and the Inbox for a rule handoff. */
function ruleSummary(reason: HandoffRuleReason, text: string): string {
  const quoted = `"${text.slice(0, 160)}"`;
  if (reason === 'order_change') return `Shopper asked to refund, exchange or change an order: ${quoted}`;
  if (reason === 'big_order') return `Big order: ${quoted}`;
  return `Shopper seems upset: ${quoted}`;
}

function toWire(m: {
  id: string;
  role: string;
  content: string;
  created_at: string;
  metadata?: { author?: string; escalated?: boolean; feedback?: 'up' | 'down' };
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
    feedback: m.metadata?.feedback ?? undefined,
  };
}
