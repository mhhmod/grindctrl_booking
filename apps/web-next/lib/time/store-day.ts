/* Days in the store's own time zone (v16 phase zero item 32).

   "Today" and "the last 7 days" used to roll over at midnight UTC, which
   is 2 or 3 in the morning in Cairo. These helpers find the store's local
   midnight as an instant, so windows and day labels follow the store's
   calendar, daylight saving included. Pure, so they run anywhere; the
   store's zone comes from lib/shopify/shop-timezone.ts. */

export const UTC = 'UTC';

/** The zone if Intl knows it, else UTC. */
export function resolveTimeZone(timeZone: string | null | undefined): string {
  if (!timeZone) return UTC;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return timeZone;
  } catch {
    return UTC;
  }
}

type LocalDate = { year: number; month: number; day: number };

const partFormatters = new Map<string, Intl.DateTimeFormat>();

function wallClock(instant: number, timeZone: string) {
  let formatter = partFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    partFormatters.set(timeZone, formatter);
  }
  const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** How far the zone's clock is ahead of UTC at this instant, in ms. */
function offsetAt(instant: number, timeZone: string): number {
  const clock = wallClock(instant, timeZone);
  const asUtc = Date.UTC(clock.year, clock.month - 1, clock.day, clock.hour, clock.minute, clock.second);
  return asUtc - Math.floor(instant / 1000) * 1000;
}

function localDate(instant: number, timeZone: string): LocalDate {
  const { year, month, day } = wallClock(instant, timeZone);
  return { year, month, day };
}

/** The first instant of a calendar day in the zone. Where the clocks jump
 *  over midnight, the day starts at the first time that exists. */
function startOfLocalDate({ year, month, day }: LocalDate, timeZone: string): number {
  const midnightAsUtc = Date.UTC(year, month - 1, day);
  let guess = midnightAsUtc - offsetAt(midnightAsUtc, timeZone);
  guess = midnightAsUtc - offsetAt(guess, timeZone);
  // A guess that landed on the day before (midnight skipped) moves forward an hour at a time.
  for (let step = 0; step < 3 && dayKeyOf(localDate(guess, timeZone)) < dayKeyOf({ year, month, day }); step += 1) {
    guess += 60 * 60 * 1000;
  }
  return guess;
}

function dayKeyOf({ year, month, day }: LocalDate): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** The store's calendar day for an instant, as YYYY-MM-DD. */
export function storeDayKey(instant: number | Date, timeZone: string): string {
  return dayKeyOf(localDate(+instant, resolveTimeZone(timeZone)));
}

/** The instant the store's day containing `instant` began. */
export function startOfStoreDay(instant: number | Date, timeZone: string): number {
  const zone = resolveTimeZone(timeZone);
  return startOfLocalDate(localDate(+instant, zone), zone);
}

/** The instant the store's day `days` after (or before) the one containing
 *  `instant` began. Days are calendar days, so one can be 23 or 25 hours. */
export function addStoreDays(instant: number | Date, days: number, timeZone: string): number {
  const zone = resolveTimeZone(timeZone);
  const { year, month, day } = localDate(+instant, zone);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return startOfLocalDate(
    { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() },
    zone,
  );
}
