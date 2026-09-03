import { NextRequest, NextResponse } from 'next/server';
import { publicApiRatelimit, clientIp } from '@/lib/ratelimit';
import { resolveShopperSession } from '@/lib/messenger/public-session';
import { appendMessage, recordAudit, recordEvent } from '@/lib/messenger/conversations';
import {
  checkAttachmentQuota,
  linkAttachmentToMessage,
  saveTriage,
  storeAttachment,
  triageBudgetRemaining,
} from '@/lib/messenger/attachments';
import { inspectAttachment, MAX_ATTACHMENT_BYTES } from '@/lib/messenger/image';
import { triageAttachment, triageNote } from '@/lib/messenger/triage';
import { pickLocalized } from '@/lib/messenger/ai';
import { describeProviderError } from '@/lib/assistant/errors';
import type { MessengerLocale } from '@/lib/messenger/types';

/* POST /api/messenger/attachment  (multipart)
   A shopper sends a photo. The server does the storing and the looking:
   nothing about this path hands a storage credential to a storefront, and
   the file's own bytes decide its type. */

export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/* Multipart framing adds a few hundred bytes around the file. This header
   check is a cheap early exit for an obviously oversized upload, NOT the
   size rule — Content-Length is client-supplied, so the decision is made
   against the bytes actually received, below. */
const REQUEST_BYTES_CEILING = MAX_ATTACHMENT_BYTES + 64 * 1024;

const REJECTION_STATUS: Record<string, number> = {
  too_large: 413,
  bad_type: 415,
  too_many_pixels: 413,
  unreadable: 400,
};

function bad(code: string, status = 400) {
  return NextResponse.json({ error: code }, { status });
}

export async function POST(request: NextRequest) {
  const limit = await publicApiRatelimit.limit(`ma:${clientIp(request) ?? 'unknown'}`);
  if (!limit.success) return bad('rate_limited', 429);

  const declared = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > REQUEST_BYTES_CEILING) return bad('too_large', 413);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return bad('bad_form');
  }

  const clientKey = String(form.get('clientKey') ?? '');
  if (!UUID_RE.test(clientKey)) return bad('client_key_required');
  const localeHint = form.get('locale');
  const file = form.get('file');
  if (!(file instanceof File)) return bad('file_required');

  try {
    const session = await resolveShopperSession({
      key: form.get('key'),
      origin: form.get('origin'),
      originToken: form.get('originToken'),
      anonymousId: form.get('anonymousId'),
      conversationId: form.get('conversationId'),
    });
    if (!session.ok) return bad(session.code, session.status);
    const { site, conversation } = session;

    if (!site.config.attachments.enabled) return bad('attachments_disabled', 403);
    if (conversation.status === 'closed') return bad('conversation_closed', 409);

    const quota = await checkAttachmentQuota(conversation.id);
    if (quota !== 'ok') return bad(quota === 'burst' ? 'too_many_uploads' : 'upload_limit_reached', 429);

    const raw = Buffer.from(await file.arrayBuffer());
    const inspected = inspectAttachment(raw);
    if ('rejected' in inspected) {
      void recordEvent({
        siteId: site.id,
        conversationId: conversation.id,
        eventName: 'attachment_rejected',
        payload: { reason: inspected.rejected },
      }).catch(() => {});
      return bad(inspected.rejected, REJECTION_STATUS[inspected.rejected] ?? 400);
    }

    const stored = await storeAttachment({
      siteId: site.id,
      conversationId: conversation.id,
      mime: inspected.mime,
      bytes: inspected.bytes,
    });

    const locale: MessengerLocale = localeHint === 'ar' || localeHint === 'en' ? localeHint : 'en';
    const { message } = await appendMessage({
      conversationId: conversation.id,
      role: 'user',
      content: pickLocalized({ en: 'Sent a photo', ar: 'أرسل صورة' }, locale),
      clientKey,
      metadata: {
        locale,
        attachment: { id: stored.id, mime: inspected.mime, bytes: inspected.bytes.length },
      },
    });
    await linkAttachmentToMessage(stored.id, message.id);

    void recordEvent({
      siteId: site.id,
      conversationId: conversation.id,
      eventName: 'attachment_uploaded',
      payload: { mime: inspected.mime, bytes: inspected.bytes.length },
    }).catch(() => {});
    void recordAudit({
      siteId: site.id,
      action: 'attachment_uploaded',
      detail: { conversation_id: conversation.id, mime: inspected.mime },
    }).catch(() => {});

    /* Triage is best-effort by design: a photo that reaches staff untriaged
       is a working support request, whereas a failed upload is not. It runs
       inline because the note belongs in the transcript the shopper is
       looking at, not thirty seconds later. */
    let note: { id: string; role: string; content: string; createdAt: string; author: string } | null = null;
    if (site.config.attachments.triageEnabled && (await triageBudgetRemaining(site.id))) {
      try {
        const triage = await triageAttachment({ bytes: inspected.bytes, mime: inspected.mime });
        if (triage) {
          await saveTriage(stored.id, triage);
          /* Returned as a real stored message, not a synthesized one: the
             panel's reconnect sync dedupes by message id, and a client-made
             id would show the same note twice after the next sync. */
          const saved = await appendMessage({
            conversationId: conversation.id,
            role: 'system',
            content: triageNote(triage, locale),
            contentType: 'event',
            metadata: { author: 'system', locale },
          });
          note = {
            id: saved.message.id,
            role: saved.message.role,
            content: saved.message.content,
            createdAt: saved.message.created_at,
            author: 'system',
          };
        }
      } catch (error) {
        const reason = describeProviderError(error);
        console.error('[messenger] triage failed:', reason);
        /* The reason goes in the payload, not just the container log: this
           fails for boring, findable causes (a retired vision model, a
           missing key, a rate limit) and an empty event turns each one into
           an afternoon. Capped, and the message never carries a credential —
           the provider wrapper reports status and model, not auth. */
        void recordEvent({
          siteId: site.id,
          conversationId: conversation.id,
          eventName: 'attachment_triage_failed',
          payload: { reason: reason.slice(0, 1000) },
        }).catch(() => {});
      }
    }

    return NextResponse.json({
      userMessage: {
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.created_at,
        author: 'shopper',
      },
      note,
    });
  } catch (error) {
    console.error('[messenger] attachment failed:', error instanceof Error ? error.message : error);
    return bad('unavailable', 503);
  }
}
