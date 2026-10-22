/* Pure pieces of the shopper's panel, kept apart so they can be tested
   without rendering it (v16 phase zero items 6, 7 and 8). */

import type { MessengerLocale } from '@/lib/messenger/types';

export interface PanelMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  /** The idempotency key the message was sent with; a retry reuses it, so
   *  the server stores it once and answers once. */
  clientKey?: string;
  pending?: boolean;
  failed?: boolean;
  /** Offline: kept in the outbox and sent in order when back online. */
  queued?: boolean;
  /** The assistant could not answer, and the message is saved (N24). */
  saved?: boolean;
}

/**
 * Merges messages from sync into what the panel shows, by id. Messages the
 * shopper wrote that are not confirmed yet (sending, failed or waiting to
 * send) stay where they are; a staff reply arriving meanwhile no longer
 * wipes them out. Anything already shown is not added twice.
 */
export function mergeMessages<T extends PanelMessage>(shown: T[], incoming: T[]): T[] {
  const ids = new Set(shown.map((message) => message.id));
  const fresh = incoming.filter((message) => !ids.has(message.id));
  if (fresh.length === 0) return shown;
  const confirmed = shown.filter((message) => !message.pending && !message.failed && !message.queued);
  const unconfirmed = shown.filter((message) => message.pending || message.failed || message.queued);
  return [...confirmed, ...fresh, ...unconfirmed];
}

/** Replaces an optimistic message with the server's copy, once, even when
 *  sync already brought that copy in. */
export function confirmMessage<T extends PanelMessage>(shown: T[], optimisticId: string, confirmed: T): T[] {
  const withoutDuplicate = shown.filter((message) => message.id !== confirmed.id);
  return withoutDuplicate.map((message) => (message.id === optimisticId ? confirmed : message));
}

/** "10:00" as the store's shoppers read it: "10 am" or "10 صباحاً". */
export function formatTeamTime(hhmm: string, locale: MessengerLocale): string {
  const [hours, minutes] = hhmm.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return hhmm;
  const twelve = hours % 12 === 0 ? 12 : hours % 12;
  const time = minutes === 0 ? String(twelve) : `${twelve}:${String(minutes).padStart(2, '0')}`;
  if (locale === 'ar') return `${time} ${hours < 12 ? 'صباحاً' : 'مساءً'}`;
  return `${time} ${hours < 12 ? 'am' : 'pm'}`;
}

const CITY_AR: Record<string, string> = {
  'Africa/Cairo': 'القاهرة',
  'Asia/Riyadh': 'الرياض',
  'Asia/Dubai': 'دبي',
  'Asia/Kuwait': 'الكويت',
  'Asia/Qatar': 'الدوحة',
  'Asia/Bahrain': 'البحرين',
  'Asia/Amman': 'عمّان',
  'Asia/Beirut': 'بيروت',
  'Africa/Casablanca': 'الدار البيضاء',
};

/** "Cairo time" or "بتوقيت القاهرة" from an IANA zone; null when the zone
 *  names no city a shopper would recognise. */
export function cityTime(timezone: string, locale: MessengerLocale): string | null {
  if (locale === 'ar') return CITY_AR[timezone] ? `بتوقيت ${CITY_AR[timezone]}` : null;
  const city = timezone.split('/').pop()?.replace(/_/g, ' ');
  return city && timezone.includes('/') ? `${city} time` : null;
}

/** True when the team comes back on the next calendar day in the store's
 *  own time zone, so "first thing tomorrow" is the truth; a later day (a
 *  weekend) or later today is not "tomorrow". */
export function opensNextDay(opensAtIso: string | null, timezone: string | null, now: Date = new Date()): boolean {
  if (!opensAtIso || !timezone) return false;
  const opens = new Date(opensAtIso);
  if (Number.isNaN(opens.getTime())) return false;
  let day: (date: Date) => string;
  try {
    const format = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
    day = (date) => format.format(date);
  } catch {
    return false;
  }
  // The calendar day after today's, counted on the date itself, so a
  // daylight saving change cannot skip or repeat a day.
  const [year, month, date] = day(now).split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, date + 1)).toISOString().slice(0, 10);
  return day(opens) === next;
}

export interface PanelTeam {
  open: boolean;
  opensAt: string | null;
  closesAt: string | null;
  timezone: string;
  /** Measured minutes from an alert to the team's first reply (v16 only). */
  replyMinutes?: number | null;
  /** When the team is next in, as an instant (v16 only). */
  opensAtIso?: string | null;
}

export type HandoffCard =
  | { kind: 'alerted' }
  | { kind: 'saved' }
  | { kind: 'after_hours'; opensAt: string | null; timezone: string | null };

/** Which card the panel shows while a conversation waits on the team. Only
 *  an alert that really went out says the team has the message. */
export function handoffCard(
  alert: { status: 'sent' | 'pending' | 'none'; afterHours: boolean } | null,
  team: PanelTeam | null,
): HandoffCard {
  if (alert?.status === 'sent') return { kind: 'alerted' };
  if (alert?.afterHours || (team && !team.open)) {
    return { kind: 'after_hours', opensAt: team?.opensAt ?? null, timezone: team?.timezone ?? null };
  }
  return { kind: 'saved' };
}
