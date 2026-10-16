import 'server-only';

import { getMessengerServiceClient } from './db';
import {
  claimHandoffNotification,
  getConversationForSite,
  listMessages,
  recordEvent,
  patchConversationMetadata,
  releaseHandoffNotification,
} from './conversations';
import {
  readHandoffAlert,
  type HandoffAlert,
  type HandoffAlertReason,
  type HandoffAlertStatus,
} from './handoff-alert';
import { sendHandoffNotification } from '@/lib/email/handoff-notification-sender';
import { hasSmtpConfigured } from '@/lib/email/transport';
import { isPlaceholderEmail } from './emails';
import { MAX_RECIPIENTS } from './config';
import type { MessengerLocale, MessengerNotifications } from './types';

/* Handoff notifier. Called right after a conversation transitions to
   handoff_requested — the transition has already happened by the time this
   runs, so nothing in here may throw: a lost email must not lose the
   handoff itself (that's why notifyHandoff wraps everything and only ever
   logs). Wiring this into the escalation path is a separate change. */

const HOURLY_SITE_CAP = 10;

export interface NotifyHandoffInput {
  site: {
    id: string;
    name: string;
    workspace_id: string;
    locale: MessengerLocale;
    notifications: MessengerNotifications;
  };
  conversation: {
    id: string;
    handoff_reason: string | null;
    handoff_summary: string | null;
    metadata: Record<string, unknown>;
  };
}

/** Workspace owners/admins with a real (non-placeholder) address, used when
 *  the merchant hasn't configured explicit recipients. Caps at MAX_RECIPIENTS
 *  — this is an alert, not a mailing list. */
async function resolveRecipients(workspaceId: string): Promise<string[]> {
  const supabase = getMessengerServiceClient();
  const res = await supabase
    .from('workspace_members')
    .select('profiles(email)')
    .eq('workspace_id', workspaceId)
    .in('role', ['owner', 'admin']);
  if (res.error) return [];

  // workspace_members.profile_id is a single NOT NULL FK, so PostgREST
  // embeds profiles as one object (or null), never an array.
  const addresses = new Set<string>();
  for (const row of (res.data ?? []) as Array<{ profiles: { email?: string | null } | null }>) {
    const email = row.profiles?.email?.trim().toLowerCase();
    if (email && !isPlaceholderEmail(email)) addresses.add(email);
    if (addresses.size >= MAX_RECIPIENTS) break;
  }
  return [...addresses];
}

/** True once a site has hit the hourly notification cap. Fails OPEN on a
 *  query error — better an occasional duplicate email than a silent outage
 *  of every handoff alert for a site. */
async function overHourlyCap(siteId: string): Promise<boolean> {
  const supabase = getMessengerServiceClient();
  const sinceIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const res = await supabase
    .from('widget_events')
    .select('id', { count: 'exact', head: true })
    .eq('widget_site_id', siteId)
    .eq('event_name', 'handoff_notified')
    .gte('created_at', sinceIso);
  if (res.error) return false;
  return (res.count ?? 0) >= HOURLY_SITE_CAP;
}

function shopperLabel(conversation: NotifyHandoffInput['conversation'], locale: MessengerLocale): string {
  const identity = conversation.metadata?.identity as { name?: string; email?: string } | null | undefined;
  if (identity?.name) return identity.name;
  if (identity?.email) return identity.email;
  return locale === 'ar' ? 'عميل زائر' : 'anonymous shopper';
}

/** Stores this attempt's outcome on the conversation (phase zero item 6),
 *  read fresh and merged so other metadata survives. Never throws: a lost
 *  record must not turn a sent alert into an error. */
async function recordAlertOutcome(
  siteId: string,
  conversationId: string,
  status: HandoffAlertStatus,
  reason: HandoffAlertReason | null,
): Promise<HandoffAlert> {
  const at = new Date().toISOString();
  let alert: HandoffAlert = { status, reason, channels: status === 'sent' ? ['email'] : [], at, attempts: 1 };
  try {
    const current = await getConversationForSite(conversationId, siteId);
    if (!current) return alert;
    const previous = readHandoffAlert(current.metadata as Record<string, unknown>);
    alert = { ...alert, attempts: (previous?.attempts ?? 0) + 1 };
    await patchConversationMetadata(conversationId, { handoff_alert: alert });
  } catch (error) {
    console.error('[messenger] alert outcome not recorded:', error instanceof Error ? error.message : error);
  }
  return alert;
}

/** Notifies the merchant that a conversation needs a human, and answers
 *  whether someone was really alerted: 'sent', 'pending' (throttled or a
 *  failed send, which the retry worker tries again) or 'none' (alerts off,
 *  no email set up, nobody to alert). Never throws — the caller has already
 *  escalated the conversation regardless of whether this succeeds.
 *
 *  Order, deliberately: emailOnHandoff → SMTP configured → recipients →
 *  hourly cap → claim LAST → send. Everything before the claim is a
 *  recoverable reason to bail — a deploy missing SMTP env vars, a merchant
 *  with no recipients configured yet, or a site over its cap should all
 *  still be notifiable on a later call — so none of those may spend the
 *  once-per-handoff claim.
 *
 *  Once claimed, a failed send (`sent: false` — SMTP rejected it, or the
 *  transport threw) must ALSO not permanently burn the claim, or the
 *  merchant is never notified again even after the problem is fixed. So we
 *  release the claim before recording handoff_notify_failed, putting that
 *  failure back in the same "try again later" state as the pre-claim
 *  bails. */
export async function notifyHandoff(input: NotifyHandoffInput): Promise<HandoffAlert> {
  const { site, conversation } = input;
  const outcome = (status: HandoffAlertStatus, reason: HandoffAlertReason | null) =>
    recordAlertOutcome(site.id, conversation.id, status, reason);
  try {
    if (!site.notifications.emailOnHandoff) return await outcome('none', 'disabled');

    if (!hasSmtpConfigured()) {
      await recordEvent({
        siteId: site.id,
        conversationId: conversation.id,
        eventName: 'handoff_notify_skipped',
        payload: { reason: 'smtp_not_configured' },
      });
      return await outcome('none', 'smtp_not_configured');
    }

    const recipients =
      site.notifications.recipients.length > 0
        ? site.notifications.recipients
        : await resolveRecipients(site.workspace_id);
    if (recipients.length === 0) {
      await recordEvent({
        siteId: site.id,
        conversationId: conversation.id,
        eventName: 'handoff_notify_skipped',
        payload: { reason: 'no_recipient' },
      });
      return await outcome('none', 'no_recipient');
    }

    if (await overHourlyCap(site.id)) {
      await recordEvent({
        siteId: site.id,
        conversationId: conversation.id,
        eventName: 'handoff_notify_throttled',
      });
      return await outcome('pending', 'throttled');
    }

    const claimed = await claimHandoffNotification(conversation.id);
    if (!claimed) {
      // Not silent: without an event, a re-escalation that loses the claim
      // race (or one that lands on a conversation whose notified_at was
      // never reset) leaves nothing to debug from.
      await recordEvent({
        siteId: site.id,
        conversationId: conversation.id,
        eventName: 'handoff_notify_skipped',
        payload: { reason: 'already_claimed' },
      });
      // Another attempt holds the claim and is sending, or has sent; its own
      // outcome replaces this one when it lands.
      const current = await getConversationForSite(conversation.id, site.id);
      return (
        readHandoffAlert(current?.metadata as Record<string, unknown> | undefined) ??
        (await outcome('pending', 'already_claimed'))
      );
    }

    // {limit: 3, newestFirst: true} + reverse(): the three most RECENT
    // messages, back in chronological order. Plain {limit: 3} would give the
    // three OLDEST — the opening of the chat — under an email heading that
    // says "Last few messages".
    const recentMessages = (await listMessages(conversation.id, { limit: 3, newestFirst: true }))
      .reverse()
      .map((m) => ({ role: m.role, content: m.content.slice(0, 400) }));

    const { sent } = await sendHandoffNotification({
      to: recipients,
      storeName: site.name,
      siteId: site.id,
      locale: site.locale,
      shopperLabel: shopperLabel(conversation, site.locale),
      reason: conversation.handoff_reason ?? '',
      summary: conversation.handoff_summary ?? '',
      recentMessages,
    });

    if (!sent) {
      await releaseHandoffNotification(conversation.id);
      await recordEvent({
        siteId: site.id,
        conversationId: conversation.id,
        eventName: 'handoff_notify_failed',
      });
      return await outcome('pending', 'send_failed');
    }

    await recordEvent({
      siteId: site.id,
      conversationId: conversation.id,
      eventName: 'handoff_notified',
    });
    return await outcome('sent', null);
  } catch (error) {
    console.error('[messenger] notifyHandoff failed:', error instanceof Error ? error.message : error);
    return outcome('pending', 'error');
  }
}
