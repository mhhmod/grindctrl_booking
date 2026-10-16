import { describe, expect, it } from 'vitest';
import { isWithinAvailabilityHours, teamHours } from './hours';
import { resolveMessengerConfig } from './config';
import type { MessengerBehaviour } from './types';

const MON = 1, THU = 4, FRI = 5, SAT = 6;

function hours(windows: Array<[number, number, number]>, timezone = 'UTC'): MessengerBehaviour {
  return {
    ...resolveMessengerConfig({}).behaviour,
    availabilityMode: 'hours',
    availabilityTimezone: timezone,
    availabilityHours: windows.map(([day, startMinute, endMinute]) => ({ day, startMinute, endMinute })),
  };
}

// 2026-10-12 is a Monday, 2026-10-16 a Friday, 2026-10-18 a Sunday.
const at = (iso: string) => new Date(iso);

describe('opening hours (phase zero item 7)', () => {
  it('reads a window that ends at midnight, such as 10 am to midnight', () => {
    const friday = hours([[FRI, 10 * 60, 0]]);
    expect(isWithinAvailabilityHours(friday, at('2026-10-16T09:59:00Z'))).toBe(false);
    expect(isWithinAvailabilityHours(friday, at('2026-10-16T10:00:00Z'))).toBe(true);
    expect(isWithinAvailabilityHours(friday, at('2026-10-16T23:59:00Z'))).toBe(true);
    expect(isWithinAvailabilityHours(friday, at('2026-10-17T00:00:00Z'))).toBe(false);
  });

  it('carries a late window past midnight into the next day', () => {
    const late = hours([[THU, 20 * 60, 2 * 60]]);
    expect(isWithinAvailabilityHours(late, at('2026-10-16T01:30:00Z'))).toBe(true);
    expect(isWithinAvailabilityHours(late, at('2026-10-16T02:00:00Z'))).toBe(false);
  });

  it('carries a Saturday night window into Sunday morning across the week boundary', () => {
    const saturday = hours([[SAT, 22 * 60, 2 * 60]]);
    expect(isWithinAvailabilityHours(saturday, at('2026-10-18T01:00:00Z'))).toBe(true);
    expect(teamHours(saturday, at('2026-10-18T01:00:00Z'))).toMatchObject({ open: true, closesAt: '02:00' });
  });

  it('keeps today\'s rule for the assistant: no days, or an unknown zone, counts as open', () => {
    expect(isWithinAvailabilityHours(hours([]), at('2026-10-16T03:00:00Z'))).toBe(true);
    expect(isWithinAvailabilityHours(hours([[MON, 540, 1020]], 'Not/AZone'), at('2026-10-16T03:00:00Z'))).toBe(true);
  });

  it('for the team, no days selected means the team is never in', () => {
    expect(teamHours(hours([]), at('2026-10-16T12:00:00Z'))).toMatchObject({ open: false, opensAt: null, opensAtIso: null });
  });

  it('says when the team leaves while it is in, following touching windows', () => {
    expect(teamHours(hours([[MON, 9 * 60, 17 * 60]]), at('2026-10-12T10:00:00Z'))).toMatchObject({
      open: true,
      closesAt: '17:00',
    });
    const split = hours([[THU, 20 * 60, 1440], [FRI, 0, 2 * 60]]);
    expect(teamHours(split, at('2026-10-15T21:00:00Z'))).toMatchObject({ open: true, closesAt: '02:00' });
  });

  it('says when the team is next in while it is away, as a time and an instant', () => {
    expect(teamHours(hours([[MON, 9 * 60, 17 * 60]]), at('2026-10-11T23:00:00Z'))).toEqual({
      open: false,
      closesAt: null,
      opensAt: '09:00',
      opensAtIso: '2026-10-12T09:00:00.000Z',
      timezone: 'UTC',
    });
  });

  it('reads the store\'s own time zone: 11 pm in Cairo is after hours for a 10 am to 10 pm team', () => {
    // 2027-01-14 is a Thursday; Cairo is UTC+2 in January.
    const cairo = hours([[THU, 10 * 60, 22 * 60], [FRI, 10 * 60, 22 * 60]], 'Africa/Cairo');
    const elevenPm = at('2027-01-14T21:00:00Z');
    expect(isWithinAvailabilityHours(cairo, elevenPm)).toBe(false);
    expect(teamHours(cairo, elevenPm)).toMatchObject({
      open: false,
      opensAt: '10:00',
      opensAtIso: '2027-01-15T08:00:00.000Z',
      timezone: 'Africa/Cairo',
    });
  });

  it('treats "always" as a team that is always in', () => {
    const always = { ...hours([]), availabilityMode: 'always' as const };
    expect(teamHours(always, at('2026-10-16T03:00:00Z'))).toMatchObject({ open: true, closesAt: null });
  });

  it('is unaffected by a start equal to the end, which is no window at all', () => {
    expect(isWithinAvailabilityHours(hours([[FRI, 600, 600], [MON, 540, 1020]]), at('2026-10-16T10:30:00Z'))).toBe(false);
  });
});
