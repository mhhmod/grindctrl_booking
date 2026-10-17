import { describe, expect, it } from 'vitest';
import { addStoreDays, resolveTimeZone, startOfStoreDay, storeDayKey } from './store-day';

const iso = (ms: number) => new Date(ms).toISOString();

describe('store days', () => {
  it('rolls over at the store’s midnight, not UTC’s', () => {
    // 00:30 on 18 October in Cairo is still the 17th in UTC.
    const lateNight = Date.parse('2026-10-17T21:30:00Z');
    expect(storeDayKey(lateNight, 'UTC')).toBe('2026-10-17');
    expect(storeDayKey(lateNight, 'Africa/Cairo')).toBe('2026-10-18');
    expect(iso(startOfStoreDay(lateNight, 'Africa/Cairo'))).toBe('2026-10-17T21:00:00.000Z');
    expect(iso(startOfStoreDay(lateNight, 'Asia/Riyadh'))).toBe('2026-10-17T21:00:00.000Z');
    expect(iso(startOfStoreDay(lateNight, 'UTC'))).toBe('2026-10-17T00:00:00.000Z');
  });

  it('counts calendar days, across a clock change', () => {
    // New York moves its clocks forward on 8 March 2026, so that day has 23 hours.
    const before = startOfStoreDay(Date.parse('2026-03-08T12:00:00Z'), 'America/New_York');
    const after = addStoreDays(before, 1, 'America/New_York');
    expect(after - before).toBe(23 * 60 * 60 * 1000);
    expect(storeDayKey(after, 'America/New_York')).toBe('2026-03-09');
    expect(storeDayKey(addStoreDays(before, -13, 'America/New_York'), 'America/New_York')).toBe('2026-02-23');
  });

  it.each(['Africa/Cairo', 'Asia/Riyadh', 'America/New_York'])(
    'starts every day of 2026 in %s at an instant on that day, after the day before',
    (zone) => {
      let day = startOfStoreDay(Date.parse('2026-01-01T12:00:00Z'), zone);
      const keys = new Set<string>();
      for (let index = 0; index < 365; index += 1) {
        const key = storeDayKey(day, zone);
        keys.add(key);
        expect(storeDayKey(day - 1, zone) < key).toBe(true);
        expect(startOfStoreDay(day + 60 * 60 * 1000, zone)).toBe(day);
        day = addStoreDays(day, 1, zone);
      }
      expect(keys.size).toBe(365);
      expect(storeDayKey(day, zone)).toBe('2027-01-01');
    },
  );

  it('falls back to UTC for a zone it does not know', () => {
    expect(resolveTimeZone('Mars/Olympus')).toBe('UTC');
    expect(resolveTimeZone(null)).toBe('UTC');
    expect(resolveTimeZone('Africa/Cairo')).toBe('Africa/Cairo');
    expect(storeDayKey(Date.parse('2026-10-17T23:00:00Z'), 'Mars/Olympus')).toBe('2026-10-17');
  });
});
