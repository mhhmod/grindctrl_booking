import 'server-only';

import { getMessengerServiceClient } from '@/lib/messenger/db';
import { getOverviewStats, getWidgetLastSeenAt } from '@/lib/messenger/conversations';
import { readHandoffAlert } from '@/lib/messenger/handoff-alert';
import { parseCart } from '@/lib/messenger/cart';
import { resolveMessengerConfig } from '@/lib/messenger/config';
import { teamReplyMinutes } from '@/lib/messenger/team-reply-time';
import { getShopEntitlement } from '@/lib/try-on/entitlement';
import { withoutTestLooks } from '@/lib/try-on/test-looks';
import { roleCan, type DashboardWorkspaceRole } from '@/lib/rbac/dashboard-policy';
import { startOfStoreDay } from '@/lib/time/store-day';
import type { ActiveStore } from './active-store';
import { listDashboardShops } from './active-store-server';
import type { TodayFacts } from './today-model';

const DAY = 86_400_000;

/* The facts behind the v16 Today page, for the active store only (it is
   resolved among the caller's own and team stores, so every read below is
   one this person may make). Each part is read on its own and a failed
   part is left out rather than guessed, so one slow table never blanks the
   page. */

type Tried<T> = T | null;
async function tried<T>(read: () => Promise<T>, what: string): Promise<Tried<T>> {
  try {
    return await read();
  } catch (error) {
    console.error(`[today] ${what} failed:`, error instanceof Error ? error.message : error);
    return null;
  }
}

/** Looks shoppers got (finished looks, test looks left out), counted per
 *  window: the last 7 days, the 7 before, and the store's today. */
async function looksCounts(shop: string, now: number, timeZone: string) {
  const supabase = getMessengerServiceClient();
  const since = new Date(now - 14 * DAY).toISOString();
  const result = await withoutTestLooks((excludeTestLooks) => {
    const query = supabase
      .from('tryon_jobs')
      .select('created_at, status')
      .eq('shop', shop)
      .gte('created_at', since)
      .eq('status', 'completed')
      .limit(10_000);
    return excludeTestLooks ? query.eq('is_test', false) : query;
  });
  if (result.error) throw new Error(result.error.message);
  const startToday = startOfStoreDay(now, timeZone);
  let last7 = 0;
  let prev7 = 0;
  let today = 0;
  for (const row of (result.data ?? []) as Array<{ created_at: string }>) {
    const at = Date.parse(row.created_at);
    if (!Number.isFinite(at)) continue;
    if (at > now - 7 * DAY) last7 += 1;
    else prev7 += 1;
    if (at >= startToday) today += 1;
  }
  return { last7, prev7, today };
}

async function tryOnFacts(shop: string, now: number, timeZone: string): Promise<TodayFacts['tryOn']> {
  const shops = await listDashboardShops().catch(() => []);
  // An uninstalled shop has no Try it on to report on.
  if (shops.find((candidate) => candidate.domain === shop)?.status !== 'installed') return null;
  const [entitlement, counts] = await Promise.all([getShopEntitlement(shop), looksCounts(shop, now, timeZone)]);
  return {
    looksLeft: entitlement.totalCreditsRemaining,
    looksIncluded: entitlement.rendersIncluded + entitlement.topUpCreditsRemaining,
    available: entitlement.available,
    planName: entitlement.planName,
    planActive: entitlement.status === 'active' || entitlement.status === 'grace',
    resetAt: entitlement.currentPeriodEnd,
    looksLast7: counts.last7,
    looksPrev7: counts.prev7,
    looksToday: counts.today,
  };
}

async function waitingShoppers(siteId: string, now: number) {
  const supabase = getMessengerServiceClient();
  const result = await supabase
    .from('widget_conversations')
    .select('id, last_message_at, handoff_notified_at, metadata')
    .eq('widget_site_id', siteId)
    .eq('status', 'handoff_requested')
    .limit(50);
  if (result.error) throw new Error(result.error.message);
  return ((result.data ?? []) as Array<{
    last_message_at: string | null;
    handoff_notified_at: string | null;
    metadata: Record<string, unknown> | null;
  }>).map((row) => {
    const alert = readHandoffAlert(row.metadata);
    return {
      // When the shopper was handed to the team: the alert's own time, else
      // when it was claimed, else their last message.
      since: alert?.at ?? row.handoff_notified_at ?? row.last_message_at ?? new Date(now).toISOString(),
      alertSent: alert?.status === 'sent',
      cart: parseCart(row.metadata?.cart),
    };
  });
}

/** Chats today that hold a message (opening the panel alone starts none),
 *  and how many of them went to the team. */
async function chatsToday(siteId: string, now: number, timeZone: string) {
  const supabase = getMessengerServiceClient();
  const result = await supabase
    .from('widget_conversations')
    .select('handoff_reason')
    .eq('widget_site_id', siteId)
    .gte('started_at', new Date(startOfStoreDay(now, timeZone)).toISOString())
    .not('last_message_at', 'is', null)
    .limit(2000);
  if (result.error) throw new Error(result.error.message);
  const rows = (result.data ?? []) as Array<{ handoff_reason: string | null }>;
  return { total: rows.length, handedOff: rows.filter((row) => row.handoff_reason).length };
}

async function emailsTeam(siteId: string): Promise<boolean> {
  const result = await getMessengerServiceClient().from('widget_sites').select('settings_json').eq('id', siteId).maybeSingle();
  if (result.error || !result.data) return false;
  return resolveMessengerConfig((result.data as { settings_json: unknown }).settings_json).notifications.emailOnHandoff;
}

async function chatFacts(siteId: string, now: number, timeZone: string): Promise<TodayFacts['chat']> {
  const [lastSeenAt, waiting, stats, today, replyMinutes, emails] = await Promise.all([
    getWidgetLastSeenAt(siteId),
    waitingShoppers(siteId, now),
    getOverviewStats(siteId),
    chatsToday(siteId, now, timeZone),
    teamReplyMinutes(siteId, now),
    emailsTeam(siteId),
  ]);
  return {
    lastSeenAt,
    waiting,
    chatsToday: today.total,
    handedOffToday: today.handedOff,
    solved7: stats.aiResolved7d,
    handedOff7: stats.handedOff7d,
    handoffs7: stats.handedOff7d,
    alertProblems7: Object.values(stats.alertProblems7d).reduce((sum, n) => sum + (n ?? 0), 0),
    teamReplyMinutes: replyMinutes,
    emailsTeam: emails,
  };
}

export async function getTodayFacts({
  activeStore,
  role,
  timeZone,
  now = Date.now(),
}: {
  activeStore: ActiveStore;
  role: DashboardWorkspaceRole;
  timeZone: string;
  now?: number;
}): Promise<TodayFacts> {
  const [tryOn, chat] = await Promise.all([
    activeStore.shopDomain ? tried(() => tryOnFacts(activeStore.shopDomain!, now, timeZone), 'try-on') : null,
    activeStore.siteId ? tried(() => chatFacts(activeStore.siteId!, now, timeZone), 'store chat') : null,
  ]);
  return { now, timeZone, canBilling: roleCan(role, 'billing'), tryOn, chat };
}
