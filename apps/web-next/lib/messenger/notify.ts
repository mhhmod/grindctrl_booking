import 'server-only';

import { getMessengerServiceClient } from './db';
import {
  claimHandoffNotification,
  listMessages,
  recordEvent,
  releaseHandoffNotification,
} from './conversations';
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

/** Notifies the merchant that a conversation needs a human. Never throws —
 *  the caller has already escalated the conversation regardless of whether
 *  this succeeds.
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
export async function notifyHandoff(input: NotifyHandoffInput): Promise<void> {
  try {
    const { site, conversation } = input;
    if (!site.notifications.emailOnHandoff) return;

    if (!hasSmtpConfigured()) {
      await recordEvent({
        siteId: site.id,
        conversationId: conversation.id,
        eventName: 'handoff_notify_skipped',
        payload: { reason: 'smtp_not_configured' },
      });
      return;
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
      return;
    }

    if (await overHourlyCap(site.id)) {
      await recordEvent({
        siteId: site.id,
        conversationId: conversation.id,
        eventName: 'handoff_notify_throttled',
      });
      return;
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
      return;
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
      return;
    }

    await recordEvent({
      siteId: site.id,
      conversationId: conversation.id,
      eventName: 'handoff_notified',
    });
  } catch (error) {
    console.error('[messenger] notifyHandoff failed:', error instanceof Error ? error.message : error);
  }
}
