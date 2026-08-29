import { NextRequest, NextResponse } from 'next/server';
import { publicApiRatelimit, clientIp } from '@/lib/ratelimit';
import { resolveShopperSession } from '@/lib/messenger/public-session';
import {
  recordAudit,
  recordEvent,
  setVisitorEmail,
  updateConversationMetadata,
} from '@/lib/messenger/conversations';
import { normalizeContactEmail } from '@/lib/messenger/contact';

/* POST /api/messenger/contact
   The shopper answered "where should we reply?". Stores the address as a
   reply-to hint on the visitor and the conversation.

   It is explicitly NOT an identity claim: anyone can type any address, so
   nothing downstream may use this to authorize anything. Order lookup reads
   the argument the shopper supplies in that turn and matches it against the
   order, never against this. */

export async function POST(request: NextRequest) {
  const limit = await publicApiRatelimit.limit(`mc:${clientIp(request) ?? 'unknown'}`);
  if (!limit.success) return NextResponse.json({ ok: false }, { status: 429 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const email = normalizeContactEmail(body.email);
  if (!email) return NextResponse.json({ ok: false, error: 'bad_email' }, { status: 400 });

  try {
    const session = await resolveShopperSession({
      key: body.key,
      origin: body.origin,
      anonymousId: body.anonymousId,
      conversationId: body.conversationId,
    });
    if (!session.ok) {
      return NextResponse.json({ ok: false, error: session.code }, { status: session.status });
    }
    const { site, visitor, conversation } = session;

    if (!site.config.contactCapture.enabled) {
      return NextResponse.json({ ok: false, error: 'disabled' }, { status: 403 });
    }

    await setVisitorEmail(visitor.id, email);
    await updateConversationMetadata(conversation.id, {
      ...conversation.metadata,
      contact_email: email,
      // A shopper who answers has answered; make sure nothing offers again
      // even if the block was rendered before the prompt was recorded.
      contact_prompted_at: conversation.metadata.contact_prompted_at ?? new Date().toISOString(),
    });

    void recordEvent({
      siteId: site.id,
      conversationId: conversation.id,
      eventName: 'contact_captured',
    }).catch(() => {});
    // The address itself is not written to the audit detail — the audit log
    // is readable by every workspace member and this is a shopper's email.
    void recordAudit({ siteId: site.id, action: 'contact_captured', detail: { conversation_id: conversation.id } }).catch(
      () => {},
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[messenger] contact failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
