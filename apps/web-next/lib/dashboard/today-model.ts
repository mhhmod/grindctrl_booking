/* What the v16 Today page shows (04-dashboard.md, Today and Today-States),
   worked out from facts the app already has, so the rules can be tested
   without rendering. Every number has a source or is left out: sales, the
   50/50 card, Right now, "Added to cart after a look", who is online and
   the unanswered-questions row wait for their back ends (N4, N6, N44, N3,
   N14, N8), and the theme checks for item 24. */

import type { SiteLocale } from '@/lib/landing/landing-i18n';
import { intlLocale } from '@/lib/copy/rules';
import { formatStorePrice } from '@/lib/try-on/store-product';
import type { TodayCopy } from './today-copy';

const MINUTE = 60_000;
const DAY = 86_400_000;
/** Store Chat unseen this long reads as a problem, not a quiet store. */
export const CHAT_QUIET_AFTER_MS = DAY;
/** The board's rule: a run-out inside 14 days needs the owner. */
export const RUN_OUT_WITHIN_DAYS = 14;
export const MAX_ROWS = 5;

export type TodayFacts = {
  now: number;
  timeZone: string;
  /** Plan rows and links are billing, so only the owner sees them (item 12). */
  canBilling: boolean;
  tryOn: null | {
    looksLeft: number;
    looksIncluded: number;
    /** False while Try it on is hidden because no looks are left. */
    available: boolean;
    planName: string | null;
    /** The subscription is active (or trialing). */
    planActive: boolean;
    resetAt: string | null;
    looksLast7: number;
    looksPrev7: number;
    looksToday: number;
  };
  chat: null | {
    lastSeenAt: string | null;
    waiting: Array<{ since: string; alertSent: boolean; cart: { totalMinor: number; currency: string } | null }>;
    chatsToday: number;
    handedOffToday: number;
    solved7: number;
    handedOff7: number;
    handoffs7: number;
    alertProblems7: number;
    teamReplyMinutes: number | null;
    /** A handoff emails someone (the store's alert setting is on). */
    emailsTeam: boolean;
  };
};

export type Tone = 'ok' | 'attention' | 'danger';

export type NeedsYouRow = {
  kind: 'try_on_hidden' | 'waiting' | 'run_out';
  tone: Tone;
  icon: 'shirt' | 'chat' | 'gauge';
  title: string;
  line: string;
  action: { label: string; href: string } | null;
};

export type HealthItem = { icon: 'shirt' | 'chat' | 'mail'; text: string };

export type HealthStrip = {
  tone: Tone;
  lead: string;
  items: HealthItem[];
};

export type Tile = { key: string; label: string; value: string; sub: string; trend?: 'up' | 'down' };

export type DetailRow = { key: string; title: string; tone: Tone; result: string };

export type TodayView = {
  health: HealthStrip;
  details: { rows: DetailRow[]; notChecked: string };
  needsYou: { rows: NeedsYouRow[]; count: string } | null;
  calm: { body: string; chips: string[] } | null;
  tiles: Tile[];
};

export const PLAN_HREF = '/dashboard/try-on';
export const INBOX_HREF = '/dashboard/store-chat?tab=conversations';

export function relativeAgo(iso: string, now: number, copy: TodayCopy): string {
  const minutes = Math.floor((now - Date.parse(iso)) / MINUTE);
  if (minutes < 1) return copy.ago.justNow;
  if (minutes < 60) return copy.ago.minutes(minutes);
  if (minutes < 24 * 60) return copy.ago.hours(Math.floor(minutes / 60));
  return copy.ago.days(Math.floor(minutes / (24 * 60)));
}

export function dayMonth(iso: string, locale: SiteLocale, timeZone: string): string {
  return new Intl.DateTimeFormat(locale === 'ar' ? intlLocale('ar') : 'en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone,
  }).format(new Date(iso));
}

/** When the looks run out at the last 7 days' pace, and how long before the
 *  cycle resets. Null when they last until the reset, or at no pace at all. */
export function runOutProjection(
  tryOn: { looksLeft: number; looksLast7: number; resetAt: string | null },
  now: number,
): { days: number; daysBeforeReset: number | null } | null {
  const perDay = tryOn.looksLast7 / 7;
  if (perDay <= 0 || tryOn.looksLeft <= 0) return null;
  const days = Math.max(1, Math.round(tryOn.looksLeft / perDay));
  if (days > RUN_OUT_WITHIN_DAYS) return null;
  const resetAt = tryOn.resetAt ? Date.parse(tryOn.resetAt) : NaN;
  if (!Number.isFinite(resetAt)) return { days, daysBeforeReset: null };
  const runsOutAt = now + days * DAY;
  if (runsOutAt >= resetAt) return null;
  return { days, daysBeforeReset: Math.max(1, Math.round((resetAt - runsOutAt) / DAY)) };
}

function money(minor: number, currency: string, locale: SiteLocale): string {
  return formatStorePrice(minor, currency, locale);
}

function needsYouRows(facts: TodayFacts, copy: TodayCopy, locale: SiteLocale): NeedsYouRow[] {
  const rows: NeedsYouRow[] = [];
  const { tryOn, chat } = facts;
  const plan = facts.canBilling ? { label: copy.seePlan, href: PLAN_HREF } : null;

  // 1. Anything broken that stops sales now.
  if (tryOn && !tryOn.available) {
    // Out of looks comes back with the cycle; a plan that is not active does not.
    const line =
      tryOn.looksLeft <= 0
        ? copy.hiddenLine + (tryOn.resetAt ? ` ${copy.hiddenBack(dayMonth(tryOn.resetAt, locale, facts.timeZone))}` : '')
        : copy.hiddenPlanLine;
    rows.push({ kind: 'try_on_hidden', tone: 'danger', icon: 'shirt', title: copy.hiddenTitle, line, action: plan });
  }

  // 2. Shoppers waiting for a person, the longest wait leading the line.
  if (chat && chat.waiting.length > 0) {
    const n = chat.waiting.length;
    const longest = Math.max(...chat.waiting.map((w) => facts.now - Date.parse(w.since)).filter(Number.isFinite), 0);
    const wait = copy.waitMinutes(Math.floor(longest / MINUTE));
    const parts = [n === 1 ? copy.waitingFor(wait) : copy.longestWait(wait)];
    // Carts in one currency add up; mixed currencies are not summed.
    const carts = chat.waiting.map((w) => w.cart).filter((cart): cart is NonNullable<typeof cart> => !!cart && cart.totalMinor > 0);
    const currencies = new Set(carts.map((cart) => cart.currency));
    if (carts.length > 0 && currencies.size === 1) {
      const total = carts.reduce((sum, cart) => sum + cart.totalMinor, 0);
      parts.push(copy.cartsHold(n, money(total, carts[0].currency, locale)));
    }
    if (n === 1 && chat.waiting[0].alertSent) parts.push(copy.teamEmailed);
    rows.push({
      kind: 'waiting',
      tone: 'attention',
      icon: 'chat',
      title: copy.waitingTitle(n),
      line: parts.join(' · '),
      action: { label: copy.openInbox, href: INBOX_HREF },
    });
  }

  // 3. Looks running out inside 14 days (owner only: it is the plan).
  if (tryOn && tryOn.available && facts.canBilling) {
    const projection = runOutProjection(tryOn, facts.now);
    if (projection) {
      rows.push({
        kind: 'run_out',
        tone: 'attention',
        icon: 'gauge',
        title: copy.runOutTitle(projection.days),
        line:
          projection.daysBeforeReset !== null && tryOn.resetAt
            ? copy.runOutLine(projection.daysBeforeReset, dayMonth(tryOn.resetAt, locale, facts.timeZone))
            : copy.runOutNoReset,
        action: plan,
      });
    }
  }
  return rows.slice(0, MAX_ROWS);
}

function healthStrip(facts: TodayFacts, copy: TodayCopy): HealthStrip {
  const problems: Array<{ tone: Tone } & HealthItem> = [];
  const items: HealthItem[] = [];
  const { tryOn, chat } = facts;
  if (tryOn) {
    if (!tryOn.available) problems.push({ tone: 'danger', icon: 'shirt', text: tryOn.looksLeft <= 0 ? copy.tryOnHidden : copy.tryOnHiddenPlan });
    else items.push({ icon: 'shirt', text: copy.tryOnLive });
  }
  if (chat) {
    const seen = chat.lastSeenAt ? Date.parse(chat.lastSeenAt) : NaN;
    if (!Number.isFinite(seen)) problems.push({ tone: 'attention', icon: 'chat', text: copy.chatNotSeen });
    else if (facts.now - seen > CHAT_QUIET_AFTER_MS)
      problems.push({ tone: 'attention', icon: 'chat', text: copy.chatLastSeen(relativeAgo(chat.lastSeenAt!, facts.now, copy)) });
    else items.push({ icon: 'chat', text: copy.chatSeen(relativeAgo(chat.lastSeenAt!, facts.now, copy)) });
    if (chat.alertProblems7 > 0) problems.push({ tone: 'attention', icon: 'mail', text: copy.alertsFailing });
  }
  const worst = problems.find((p) => p.tone === 'danger') ?? problems[0];
  return worst
    ? {
        tone: worst.tone,
        lead: worst.text,
        items: [...problems.filter((p) => p !== worst).map(({ icon, text }) => ({ icon, text })), ...items],
      }
    : { tone: 'ok', lead: copy.everythingWorking, items };
}

function healthDetails(facts: TodayFacts, copy: TodayCopy, locale: SiteLocale): DetailRow[] {
  const rows: DetailRow[] = [];
  const { tryOn, chat } = facts;
  const d = copy.details;
  if (tryOn) {
    rows.push(
      tryOn.available
        ? { key: 'try_on', title: d.tryOn, tone: 'ok', result: d.tryOnShowing(tryOn.looksLeft, tryOn.looksIncluded) }
        : {
            key: 'try_on',
            title: d.tryOn,
            tone: 'danger',
            result: tryOn.looksLeft <= 0 ? d.tryOnHiddenDetail : d.tryOnHiddenPlanDetail,
          },
    );
  }
  if (chat) {
    rows.push(
      chat.lastSeenAt
        ? {
            key: 'chat',
            title: d.chat,
            tone: facts.now - Date.parse(chat.lastSeenAt) > CHAT_QUIET_AFTER_MS ? 'attention' : 'ok',
            result: d.chatSeenDetail(relativeAgo(chat.lastSeenAt, facts.now, copy)),
          }
        : { key: 'chat', title: d.chat, tone: 'attention', result: d.chatNotSeenDetail },
    );
    rows.push(
      chat.alertProblems7 > 0
        ? { key: 'alerts', title: d.alerts, tone: 'attention', result: d.alertsFailing(chat.alertProblems7) }
        : { key: 'alerts', title: d.alerts, tone: 'ok', result: chat.handoffs7 > 0 ? d.alertsOk : d.alertsNone },
    );
  }
  if (tryOn && facts.canBilling) {
    rows.push(
      tryOn.planActive && tryOn.planName
        ? {
            key: 'billing',
            title: d.billing,
            tone: 'ok',
            result: d.billingActive(tryOn.planName, tryOn.resetAt ? dayMonth(tryOn.resetAt, locale, facts.timeZone) : null),
          }
        : { key: 'billing', title: d.billing, tone: 'attention', result: d.billingAttention },
    );
  }
  return rows;
}

function calmCard(facts: TodayFacts, copy: TodayCopy): { body: string; chips: string[] } {
  const parts: string[] = [];
  const { chat, tryOn } = facts;
  if (chat) {
    const handled = Math.max(0, chat.chatsToday - chat.handedOffToday);
    parts.push(
      chat.chatsToday === 0
        ? copy.calmNoChats
        : handled === chat.chatsToday
          ? copy.calmAllHandled(chat.chatsToday)
          : copy.calmSomeHandled(handled, chat.chatsToday),
    );
    if (chat.emailsTeam) parts.push(copy.calmEmail);
  }
  return { body: parts.join(' '), chips: tryOn ? [copy.looksToday(tryOn.looksToday)] : [] };
}

/** "18% more than the 7 days before", or nothing without a week to compare. */
function change(current: number, previous: number, copy: TodayCopy): { sub: string; trend?: 'up' | 'down' } | null {
  if (previous <= 0) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { sub: copy.sameAsBefore };
  return pct > 0 ? { sub: copy.moreThanBefore(pct), trend: 'up' } : { sub: copy.fewerThanBefore(-pct), trend: 'down' };
}

/** A round number read at a glance, as the shopper's panel says it. */
function friendlyMinutes(minutes: number): number {
  const whole = Math.max(1, Math.round(minutes));
  return whole <= 10 ? whole : Math.round(whole / 5) * 5;
}

function lastWeekTiles(facts: TodayFacts, copy: TodayCopy): Tile[] {
  const tiles: Tile[] = [];
  const { tryOn, chat } = facts;
  if (tryOn) {
    const delta = change(tryOn.looksLast7, tryOn.looksPrev7, copy);
    tiles.push({ key: 'looks', label: copy.looks, value: String(tryOn.looksLast7), sub: delta?.sub ?? '', trend: delta?.trend });
  }
  if (chat) {
    const finished = chat.solved7 + chat.handedOff7;
    tiles.push(
      finished > 0
        ? {
            key: 'solved',
            label: copy.chatsSolved,
            value: `${Math.round((chat.solved7 / finished) * 100)}%`,
            sub: copy.ofChats(finished),
          }
        : { key: 'solved', label: copy.chatsSolved, value: '–', sub: copy.noFinishedChats },
    );
    tiles.push(
      chat.teamReplyMinutes
        ? {
            key: 'team_reply',
            label: copy.teamFirstReply,
            value: copy.minutesValue(friendlyMinutes(chat.teamReplyMinutes)),
            sub: copy.duringOpeningHours,
          }
        : { key: 'team_reply', label: copy.teamFirstReply, value: '–', sub: copy.notEnoughHandoffs },
    );
  }
  return tiles;
}

export function buildTodayView(facts: TodayFacts, copy: TodayCopy, locale: SiteLocale): TodayView {
  const rows = needsYouRows(facts, copy, locale);
  return {
    health: healthStrip(facts, copy),
    details: { rows: healthDetails(facts, copy, locale), notChecked: copy.details.notChecked },
    needsYou: rows.length > 0 ? { rows, count: copy.thingsCount(rows.length) } : null,
    calm: rows.length === 0 ? calmCard(facts, copy) : null,
    tiles: lastWeekTiles(facts, copy),
  };
}
