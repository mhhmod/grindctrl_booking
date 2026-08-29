import 'server-only';

import { getMessengerServiceClient } from './db';
import { claimHandoffNotification, listMessages, recordEvent } from './conversations';
import { sendHandoffNotification } from '@/lib/email/handoff-notification-sender';
import { isPlaceholderEmail } from './provisioning';
import type { MessengerLocale, MessengerNotifications } from './types';

/* Handoff notifier. Called right after a conversation transitions to
   handoff_requested — the transition has already happened by the time this
   runs, so nothing in here may throw: a lost email must not lose the
   handoff itself (that's why notifyHandoff wraps everything and only ever
   logs). Wiring this into the escalation path is a separate change. */

const HOURLY_SITE_CAP = 10;
const MAX_RECIPIENTS = 5;

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
 *  the merchant hasn't configured explicit recipients. Caps at 5 — this is
 *  an alert, not a mailing list. */
async function resolveRecipients(workspaceId: string): Promise<string[]> {
  const supabase = getMessengerServiceClient();
  const res = await supabase
    .from('workspace_members')
    .select('profiles(email)')
    .eq('workspace_id', workspaceId)
    .in('role', ['owner', 'admin']);
  if (res.error) return [];

  const addresses = new Set<string>();
  for (const row of (res.data ?? []) as Array<{ profiles: unknown }>) {
    // A to-one embed normally comes back as an object, but this codebase has
    // at least one spot (listConversationsForSite's widget_visitors embed)
    // that treats the same shape of embed as an array — normalize both so
    // this doesn't silently resolve zero recipients if that's the real shape.
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    const email = (profile as { email?: string | null } | null)?.email;
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
 *  Order matters: recipients and the hourly cap are checked BEFORE the
 *  claim, and the claim is taken LAST. Both of those are recoverable —
 *  a merchant with no recipients configured yet, or a site over its cap,
 *  should still be notifiable on a later call — so neither may spend the
 *  once-per-handoff claim. */
export async function notifyHandoff(input: NotifyHandoffInput): Promise<void> {
  try {
    const { site, conversation } = input;
    if (!site.notifications.emailOnHandoff) return;

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
    if (!claimed) return;

    const recentMessages = (await listMessages(conversation.id, { limit: 6 }))
      .slice(-3)
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

    await recordEvent({
      siteId: site.id,
      conversationId: conversation.id,
      eventName: sent ? 'handoff_notified' : 'handoff_notify_failed',
    });
  } catch (error) {
    console.error('[messenger] notifyHandoff failed:', error instanceof Error ? error.message : error);
  }
}
