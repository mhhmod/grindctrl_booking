import { NextRequest, NextResponse } from 'next/server';
import { requireRateLimit, RequestRateLimitError, rateLimitErrorResponse } from '@/lib/request-rate-limit';
import { publicApiRatelimit, clientIp } from '@/lib/ratelimit';
import { resolveShopperSession } from '@/lib/messenger/public-session';
import { appendMessage, patchConversationMetadata, recordEvent } from '@/lib/messenger/conversations';
import { shouldAskForContact } from '@/lib/messenger/contact';
import { isWithinAvailabilityHours } from '@/lib/messenger/public-api';
import { escalateAndNotify } from '@/lib/messenger/escalate';
import { handoffLine } from '@/lib/messenger/handoff-copy';
import { toPublicHandoffAlert } from '@/lib/messenger/handoff-alert';
import { teamHours } from '@/lib/messenger/hours';
import { pickLocalized } from '@/lib/messenger/ai';
import { flagStoreForSite, storeFlags } from '@/lib/flags/store-flags';

/* POST /api/messenger/handoff  (N24, flag n24_assistant_down)
   "Send it to the team" after the assistant could not answer: the saved
   message goes to the team through the same alert flow as any handoff
   (phase zero item 6), and the panel learns whether someone was alerted.
   Answers 404 not_enabled while the store's flag is off. */

export async function POST(request: NextRequest) {
  try {
    await requireRateLimit(publicApiRatelimit, `mh:${clientIp(request) ?? 'unknown'}`);
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
  if (body.reason !== 'assistant_unavailable') {
    return NextResponse.json({ ok: false, error: 'bad_reason' }, { status: 400 });
  }

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
    const { site, visitor, conversation } = session;

    const features = await storeFlags(flagStoreForSite(site));
    if (!features.includes('n24_assistant_down')) {
      return NextResponse.json({ ok: false, error: 'not_enabled' }, { status: 404 });
    }

    // Already with the team: nothing to send twice.
    if (conversation.status !== 'open') {
      return NextResponse.json({ ok: true, status: conversation.status, alert: null });
    }

    const team = features.includes('n23_after_hours') ? teamHours(site.config.behaviour, new Date()) : null;
    const escalation = await escalateAndNotify(
      conversation.id,
      'assistant_unavailable',
      'The assistant could not answer, and the shopper sent the saved message to the team.',
      {
        id: site.id,
        name: site.name,
        workspace_id: site.workspace_id,
        // The merchant reads the alert; see send/route.ts on why English.
        locale: 'en',
        notifications: site.config.notifications,
      },
      team && !team.open ? { deferUntil: team.opensAtIso } : {},
    );
    if (!escalation) {
      return NextResponse.json({ ok: true, status: 'handoff_requested', alert: null });
    }

    const locale = body.locale === 'ar' ? 'ar' : 'en';
    const line = await appendMessage({
      conversationId: conversation.id,
      role: 'system',
      content: pickLocalized(handoffLine(escalation.alert.status), locale),
      contentType: 'event',
      metadata: { author: 'system', escalated: true },
    });
    void recordEvent({
      siteId: site.id,
      conversationId: conversation.id,
      eventName: 'handoff_triggered',
      payload: { reason: 'assistant_unavailable', alert: escalation.alert.status },
    }).catch(() => {});
    /* Where the team should reply: asked on the same terms as a handoff in
       the send route (once per conversation, never when an address is
       known), so the handoff card can offer it. */
    let askContact: true | undefined;
    if (
      shouldAskForContact({
        config: site.config.contactCapture,
        alreadyPrompted: Boolean(conversation.metadata.contact_prompted_at),
        knownEmail: conversation.metadata.identity?.email || visitor.user_email || null,
        justEscalated: true,
        withinHours: team ? team.open : isWithinAvailabilityHours(site.config.behaviour, new Date()),
      })
    ) {
      try {
        await patchConversationMetadata(conversation.id, { contact_prompted_at: new Date().toISOString() });
        askContact = true;
      } catch {
        // Without the record there is no "once", so do not ask at all.
      }
    }

    return NextResponse.json({
      ok: true,
      status: escalation.conversation.status,
      alert: toPublicHandoffAlert(escalation.alert),
      team,
      askContact,
      line: {
        id: line.message.id,
        role: line.message.role,
        content: line.message.content,
        createdAt: line.message.created_at,
        author: 'system',
        escalated: true,
      },
    });
  } catch (error) {
    console.error('[messenger] handoff failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503 });
  }
}
