import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { authenticateShopifyRequest } from '@/lib/shopify/session-token';
import { ensureShopOwnedSite } from '@/lib/messenger/shop-provisioning';
import { shopProfileId } from '@/lib/messenger/shop-tenancy';
import { getSiteAssigneeProfileId } from '@/lib/messenger/provisioning';
import {
  appendMessage,
  closeConversation,
  getConversationForSite,
  listMessages,
  markConversationRead,
  recordAudit,
  returnConversationToAi,
  takeOverConversation,
} from '@/lib/messenger/conversations';
import { listConversationAttachments, signAttachmentUrls } from '@/lib/messenger/attachments';

type ThreadBody =
  | { op: 'messages'; conversationId: string }
  | { op: 'reply'; conversationId: string; text: string }
  | { op: 'takeover'; conversationId: string }
  | { op: 'markRead'; conversationId: string }
  | { op: 'release'; conversationId: string }
  | { op: 'close'; conversationId: string };

/* Embedded equivalent of the dashboard's fetchConversationMessages / staffReply /
   takeoverConversation / releaseConversation / closeConversationAction actions.
   The site is always resolved from the verified session token's shop, and the
   conversation is always scoped to that site via getConversationForSite —
   never trusted from the request body — the same invariant every other
   Phase 2 route documents and enforces.

   The audit actor stays shopProfileId(shop): the store, not a specific
   person, because an embedded session proves which shop is calling and never
   which member of staff. That string is only ever recorded, so it needs no
   profile row.

   Assignment is a different question and must resolve to a profile that
   exists. It used to look up the shop- profile, which only exists for a
   store that installed the app before it had a dashboard account; a
   dashboard-first store has a Clerk-owned profile and no shop- row, so the
   lookup threw and every Take over and reply failed. The workspace owner
   covers both shapes — see getSiteAssigneeProfileId. */
export async function POST(request: NextRequest) {
  const session = authenticateShopifyRequest(request);
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  let site;
  try {
    site = await ensureShopOwnedSite(session.shop);
  } catch (error) {
    console.error('[store-chat thread] failed to resolve shop-owned site', error);
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503 });
  }

  const body = (await request.json()) as ThreadBody;
  const conversation = await getConversationForSite(body.conversationId, site.id);
  if (!conversation) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });

  const actorClerkUserId = shopProfileId(session.shop);

  if (body.op === 'messages') {
    try {
      const [messages, rows] = await Promise.all([
        listMessages(conversation.id, { limit: 200 }),
        listConversationAttachments(conversation.id),
      ]);
      const linked = rows.filter((row) => row.message_id);
      const signed = await signAttachmentUrls(linked.map((row) => row.storage_path));
      const attachments: Record<string, { url: string; mime: string; triage: unknown }> = {};
      for (const row of linked) {
        const url = signed[row.storage_path];
        if (url) attachments[row.message_id as string] = { url, mime: row.mime, triage: row.triage };
      }
      return NextResponse.json({
        ok: true,
        status: conversation.status,
        messages: messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.created_at,
          author: m.metadata.author ?? (m.role === 'assistant' ? 'ai' : undefined),
        })),
        attachments,
      });
    } catch (error) {
      console.error('[store-chat thread] failed to load messages', error);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
  }

  try {
    switch (body.op) {
      case 'reply': {
        const trimmed = body.text.trim().slice(0, 2000);
        if (!trimmed) return NextResponse.json({ ok: false, error: 'Message is empty.' }, { status: 400 });
        if (conversation.status === 'open') {
          const taken = await takeOverConversation(conversation.id, await getSiteAssigneeProfileId(site.workspace_id));
          if (!taken) {
            return NextResponse.json({ ok: false, error: 'Conversation state changed. Refresh and retry.' }, { status: 400 });
          }
        }
        await appendMessage({ conversationId: conversation.id, role: 'assistant', content: trimmed, metadata: { author: 'human' } });
        await recordAudit({
          siteId: site.id,
          actorClerkUserId,
          action: 'conversation_taken_over',
          detail: { conversationId: conversation.id },
        });
        return NextResponse.json({ ok: true });
      }
      case 'takeover': {
        const taken = await takeOverConversation(conversation.id, await getSiteAssigneeProfileId(site.workspace_id));
        if (!taken) {
          return NextResponse.json({ ok: false, error: 'Conversation is no longer available for takeover.' }, { status: 400 });
        }
        await recordAudit({
          siteId: site.id,
          actorClerkUserId,
          action: 'conversation_taken_over',
          detail: { conversationId: conversation.id },
        });
        return NextResponse.json({ ok: true });
      }
      case 'markRead': {
        await markConversationRead(conversation.id, conversation.metadata);
        return NextResponse.json({ ok: true });
      }
      case 'release': {
        const released = await returnConversationToAi(conversation.id);
        if (!released) {
          return NextResponse.json({ ok: false, error: 'Only an active human conversation can be returned to AI.' }, { status: 400 });
        }
        return NextResponse.json({ ok: true });
      }
      case 'close': {
        const closed = await closeConversation(conversation.id);
        if (!closed) return NextResponse.json({ ok: false, error: 'Conversation already closed.' }, { status: 400 });
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ ok: false, error: 'Unknown operation.' }, { status: 400 });
    }
  } catch (error) {
    /* Reported, not just logged. Every merchant-facing failure here collapses
       to one deliberately generic sentence — right for a client-facing route,
       and useless for finding out what broke. A takeover that failed for days
       left nothing in Sentry at all, because a caught error never reaches it,
       so the only trace was a console line on the server nobody was reading. */
    Sentry.captureException(error, {
      tags: { surface: 'store-chat-embedded', op: String(body.op ?? 'unknown') },
      extra: { siteId: site.id, shop: session.shop },
    });
    console.error('[store-chat thread] operation failed', error);
    return NextResponse.json({ ok: false, error: 'Action failed. Please try again.' }, { status: 500 });
  }
}
