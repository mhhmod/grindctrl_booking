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
  alertIsDue,
  readHandoffAlert,
  type HandoffAlert,
  type HandoffAlertReason,
  type HandoffAlertStatus,
} from './handoff-alert';
import { sendHandoffNotification } from '@/lib/email/handoff-notification-sender';
import { getSmtpFrom, getSmtpTransport, hasSmtpConfigured } from '@/lib/email/transport';
import { buildAiBudgetNotification } from '@/lib/email/ai-budget-notification';
import { buildHandoffDigest } from '@/lib/email/handoff-notification';
import { pasteRedis } from '@/lib/paste/redis';
import { claimAiBudgetAlert, releaseAiBudgetAlert } from './ai-budget';
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
  digest = false,
): Promise<HandoffAlert> {
  const at = new Date().toISOString();
  let alert: HandoffAlert = {
    status, reason, channels: status === 'sent' ? ['email'] : [], at, attempts: 1,
    ...(digest && status === 'pending' ? { digest: true } : {}),
  };
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

const DIGEST_WINDOW_MS = 15 * 60 * 1000;
const DIGEST_MAX_ITEMS = 25;

/** One email for every handoff of this site still waiting on a throttled
 *  alert, the given conversation included. At most one per site per
 *  DIGEST_WINDOW_MS, claimed in Redis; no claim (or no Redis) means the
 *  alerts stay pending for a later window, never lost. Each conversation in
 *  the digest takes its once-per-handoff claim, so none is emailed again.
 *  True when `conversationId` went out in this digest. */
async function sendHandoffDigest(site: NotifyHandoffInput['site'], recipients: string[], conversationId: string): Promise<boolean> {
  const transport = getSmtpTransport();
  const from = getSmtpFrom();
  if (!transport || !from) return false;
  const windowKey = `gc-msgr-handoff-digest:${site.id}:${Math.floor(Date.now() / DIGEST_WINDOW_MS)}`;
  let redis: ReturnType<typeof pasteRedis>;
  try {
    redis = pasteRedis();
    if ((await redis.set(windowKey, '1', { nx: true, ex: Math.ceil(DIGEST_WINDOW_MS / 1000) })) !== 'OK') return false;
  } catch {
    return false;
  }

  const supabase = getMessengerServiceClient();
  const waiting = await supabase
    .from('widget_conversations')
    .select('id, handoff_reason, handoff_summary, metadata')
    .eq('widget_site_id', site.id)
    .eq('status', 'handoff_requested')
    .is('handoff_notified_at', null)
    .order('started_at', { ascending: true })
    .limit(DIGEST_MAX_ITEMS * 2);
  type Row = { id: string; handoff_reason: string | null; handoff_summary: string | null; metadata: Record<string, unknown> | null };
  const now = Date.now();
  const rows = ((waiting.error ? [] : waiting.data ?? []) as Row[]).filter((row) => {
    if (row.id === conversationId) return true;
    const alert = readHandoffAlert(row.metadata);
    return alert?.reason === 'throttled' && alertIsDue(alert, now);
  });
  if (!rows.some((row) => row.id === conversationId)) {
    const current = await getConversationForSite(conversationId, site.id).catch(() => null);
    if (current) rows.unshift(current as unknown as Row);
  }

  // A claim that errors is simply not in this digest; it stays pending.
  const claimed: Row[] = [];
  for (const row of rows.slice(0, DIGEST_MAX_ITEMS)) {
    if (await claimHandoffNotification(row.id).catch(() => false)) claimed.push(row);
  }
  const release = async () => {
    await Promise.all(claimed.map((row) => releaseHandoffNotification(row.id).catch(() => {})));
    await redis.del(windowKey).catch(() => {});
  };
  if (claimed.length === 0) {
    await release();
    return false;
  }
  const { subject, html, text } = buildHandoffDigest({
    storeName: site.name,
    siteId: site.id,
    locale: site.locale,
    items: claimed.map((row) => ({
      shopperLabel: shopperLabel({ id: row.id, handoff_reason: row.handoff_reason, handoff_summary: row.handoff_summary, metadata: row.metadata ?? {} }, site.locale),
      summary: row.handoff_summary || row.handoff_reason || '',
    })),
  });
  try {
    await transport.sendMail({
      from, to: from.address, bcc: recipients, subject, html, text, textEncoding: 'base64',
      headers: { 'X-GrindCTRL-Notification': 'store-chat-handoff-digest' },
    });
  } catch (error) {
    console.error('[messenger] handoff digest failed:', error instanceof Error ? error.message : error);
    await release();
    return false;
  }
  await Promise.all(claimed.filter((row) => row.id !== conversationId).map((row) =>
    recordAlertOutcome(site.id, row.id, 'sent', null)));
  await recordEvent({ siteId: site.id, eventName: 'handoff_digest_sent', payload: { count: claimed.length } }).catch(() => {});
  return claimed.some((row) => row.id === conversationId);
}

/** Tells the merchant, at most once a UTC day, that the assistant reached
 *  the day's AI limit and new questions go to the team. Same recipients and
 *  mail transport as the handoff alert. Never throws. */
export async function notifyAiBudgetReached(site: NotifyHandoffInput['site']): Promise<void> {
  try {
    if (!hasSmtpConfigured()) return;
    if (!(await claimAiBudgetAlert(site.id))) return;
    const recipients =
      site.notifications.recipients.length > 0
        ? site.notifications.recipients
        : await resolveRecipients(site.workspace_id);
    const transport = getSmtpTransport();
    const from = getSmtpFrom();
    if (recipients.length === 0 || !transport || !from) {
      await releaseAiBudgetAlert(site.id);
      return;
    }
    const { subject, html, text } = buildAiBudgetNotification({ storeName: site.name, siteId: site.id, locale: site.locale });
    try {
      await transport.sendMail({
        from, to: from.address, bcc: recipients, subject, html, text, textEncoding: 'base64',
        headers: { 'X-GrindCTRL-Notification': 'store-chat-ai-limit' },
      });
    } catch (error) {
      await releaseAiBudgetAlert(site.id);
      throw error;
    }
    await recordEvent({ siteId: site.id, eventName: 'ai_budget_alert_sent' }).catch(() => {});
  } catch (error) {
    console.error('[messenger] ai budget alert failed:', error instanceof Error ? error.message : error);
  }
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

    // Over the site's hourly cap, or throttled for its visitor: never an
    // email of its own, and never dropped. It goes out in the site's digest,
    // at most one per DIGEST_WINDOW_MS, or waits for the retry worker.
    const digestOnly = readHandoffAlert(conversation.metadata)?.digest === true;
    if (digestOnly || (await overHourlyCap(site.id))) {
      if (await sendHandoffDigest(site, recipients, conversation.id)) return await outcome('sent', null);
      await recordEvent({
        siteId: site.id,
        conversationId: conversation.id,
        eventName: 'handoff_notify_throttled',
      });
      return await recordAlertOutcome(site.id, conversation.id, 'pending', 'throttled', true);
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
