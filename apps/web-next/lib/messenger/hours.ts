/* Opening hours, read in the store's own time zone (v16 phase zero item 7).

   A window belongs to the day it starts on. One whose end is at or before
   its start runs past midnight into the next day, so "10 am to midnight"
   (end 00:00) and "8 pm to 2 am" both work.

   Two readings exist on purpose. isWithinAvailabilityHours is today's rule,
   which also decides whether the assistant answers: no days selected means
   always open. teamHours is the n23_after_hours rule, where hours describe
   the team only: no days selected means the team is never in. */

import type { MessengerBehaviour } from './types';

const MINUTES_PER_DAY = 24 * 60;
const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type Interval = { start: number; end: number };

/** Minute of the week (Sunday 00:00 is 0) in the given time zone, or null
 *  when the zone is not one the runtime knows. */
export function minuteOfWeek(now: Date, timeZone: string): number | null {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now);
  } catch {
    return null;
  }
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  const day = WEEKDAYS.indexOf(value('weekday') ?? '');
  const hour = Number(value('hour'));
  const minute = Number(value('minute'));
  if (day < 0 || !Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  // "24" can appear with hourCycle h24 quirks; normalize.
  return day * MINUTES_PER_DAY + (hour % 24) * 60 + minute;
}

/** Each window as one span of the week, a window past midnight included. */
function intervals(behaviour: MessengerBehaviour): Interval[] {
  return behaviour.availabilityHours
    .filter((window) => window.startMinute !== window.endMinute)
    .map((window) => {
      const start = window.day * MINUTES_PER_DAY + window.startMinute;
      const length =
        window.endMinute > window.startMinute
          ? window.endMinute - window.startMinute
          : MINUTES_PER_DAY - window.startMinute + window.endMinute;
      return { start, end: start + length };
    });
}

function contains(span: Interval, minute: number): boolean {
  // A span that runs past the end of the week also covers its first minutes.
  return (
    (minute >= span.start && minute < span.end) ||
    (minute + MINUTES_PER_WEEK >= span.start && minute + MINUTES_PER_WEEK < span.end)
  );
}

function openAt(spans: Interval[], minute: number): boolean {
  return spans.some((span) => contains(span, minute));
}

/** Today's rule: is the store inside its hours? No days, or a time zone the
 *  runtime does not know, counts as open, so a setup slip never silences
 *  the assistant. */
export function isWithinAvailabilityHours(behaviour: MessengerBehaviour, now: Date): boolean {
  if (behaviour.availabilityMode === 'always') return true;
  if (!behaviour.availabilityTimezone || behaviour.availabilityHours.length === 0) return true;
  const minute = minuteOfWeek(now, behaviour.availabilityTimezone);
  if (minute === null) return true;
  return openAt(intervals(behaviour), minute);
}

export interface TeamHours {
  open: boolean;
  /** Store-local "HH:MM" the team leaves at, while it is in. */
  closesAt: string | null;
  /** Store-local "HH:MM" the team is next in, while it is away. */
  opensAt: string | null;
  /** The instant the team is next in, while it is away. */
  opensAtIso: string | null;
  timezone: string;
}

function label(minuteOfWeekValue: number): string {
  const minuteOfDay = ((minuteOfWeekValue % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = String(Math.floor(minuteOfDay / 60)).padStart(2, '0');
  const minutes = String(minuteOfDay % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/** The n23_after_hours rule: when is the team in? "Always" is always in. Hours
 *  with no days selected mean the team is never in, and say so. */
export function teamHours(behaviour: MessengerBehaviour, now: Date): TeamHours {
  const timezone = behaviour.availabilityTimezone || 'UTC';
  if (behaviour.availabilityMode === 'always') {
    return { open: true, closesAt: null, opensAt: null, opensAtIso: null, timezone };
  }
  const spans = intervals(behaviour);
  const minute = minuteOfWeek(now, timezone);
  if (minute === null || spans.length === 0) {
    return { open: false, closesAt: null, opensAt: null, opensAtIso: null, timezone };
  }

  // Lay the week out twice so a span that wraps past Saturday night can be
  // followed into the next week.
  const timeline = [...spans, ...spans.map((span) => ({ start: span.start + MINUTES_PER_WEEK, end: span.end + MINUTES_PER_WEEK }))]
    .sort((a, b) => a.start - b.start);

  if (openAt(spans, minute)) {
    // Follow touching spans, so Thursday 8 pm to midnight and Friday from
    // midnight read as one shift.
    const current =
      timeline.find((span) => minute >= span.start && minute < span.end) ??
      timeline.find((span) => minute + MINUTES_PER_WEEK >= span.start && minute + MINUTES_PER_WEEK < span.end);
    let end = current?.end ?? minute;
    for (let moved = true; moved; ) {
      moved = false;
      for (const span of timeline) {
        if (span.start <= end && span.end > end) {
          end = span.end;
          moved = true;
        }
      }
    }
    return { open: true, closesAt: label(end), opensAt: null, opensAtIso: null, timezone };
  }

  const next = timeline.find((span) => span.start > minute) ?? timeline[0];
  const wait = next.start > minute ? next.start - minute : next.start + MINUTES_PER_WEEK - minute;
  // Whole minutes, measured from the start of the current minute.
  const startOfMinute = Math.floor(now.getTime() / 60_000) * 60_000;
  return {
    open: false,
    closesAt: null,
    opensAt: label(next.start),
    opensAtIso: new Date(startOfMinute + wait * 60_000).toISOString(),
    timezone,
  };
}
