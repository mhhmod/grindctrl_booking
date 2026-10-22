import { describe, expect, it } from 'vitest';
import { getPanelCopy } from '../i18n';
import { opensNextDay } from '../panel-state';
import { friendlyMinutes, replyTimeLine } from './handoff-states';

const en = getPanelCopy('en');
const ar = getPanelCopy('ar');

describe('the team reply time on the handoff cards (Chat-States)', () => {
  it('rounds to a number a shopper reads at a glance', () => {
    expect([0.4, 1, 3, 10, 12, 13, 23, 47].map(friendlyMinutes)).toEqual([1, 1, 3, 10, 10, 15, 25, 45]);
  });

  it('is said only when measured and only while the team is in', () => {
    expect(replyTimeLine(en, 10, true)).toBe('The team usually replies in about 10 minutes.');
    expect(replyTimeLine(en, 1, true)).toBe('The team usually replies in about a minute.');
    expect(replyTimeLine(en, null, true)).toBeNull();
    expect(replyTimeLine(en, undefined, true)).toBeNull();
    // At night "about 10 minutes" would be a promise nobody keeps.
    expect(replyTimeLine(en, 10, false)).toBeNull();
  });

  it('counts minutes as Arabic does, with Western digits', () => {
    expect(ar.teamUsuallyReplies(1)).toBe('يرد الفريق عادةً خلال دقيقة تقريباً.');
    expect(ar.teamUsuallyReplies(2)).toBe('يرد الفريق عادةً خلال دقيقتين تقريباً.');
    expect(ar.teamUsuallyReplies(10)).toBe('يرد الفريق عادةً خلال 10 دقائق تقريباً.');
    expect(ar.teamUsuallyReplies(25)).toBe('يرد الفريق عادةً خلال 25 دقيقة تقريباً.');
  });
});

describe('"first thing tomorrow" only when the team is back tomorrow', () => {
  // Wednesday 21 October 2026, 23:30 in Cairo (20:30 UTC).
  const lateWednesday = new Date('2026-10-21T20:30:00Z');

  it('is tomorrow when the team opens the next calendar day in the store’s zone', () => {
    expect(opensNextDay('2026-10-22T07:00:00Z', 'Africa/Cairo', lateWednesday)).toBe(true);
  });

  it('is not tomorrow after midnight, when the opening is later the same day', () => {
    const earlyThursday = new Date('2026-10-21T23:30:00Z'); // 02:30 Thursday in Cairo
    expect(opensNextDay('2026-10-22T07:00:00Z', 'Africa/Cairo', earlyThursday)).toBe(false);
  });

  it('is not tomorrow over a weekend, nor without a time or a known zone', () => {
    expect(opensNextDay('2026-10-24T07:00:00Z', 'Africa/Cairo', lateWednesday)).toBe(false);
    expect(opensNextDay(null, 'Africa/Cairo', lateWednesday)).toBe(false);
    expect(opensNextDay('2026-10-22T07:00:00Z', 'Not/AZone', lateWednesday)).toBe(false);
  });

  it('reads the day in the store’s zone, not the shopper’s', () => {
    // 22:30 UTC Wednesday is already Thursday 01:30 in Cairo, so 09:00 UTC
    // Thursday is the same day there, not tomorrow.
    expect(opensNextDay('2026-10-22T09:00:00Z', 'Africa/Cairo', new Date('2026-10-21T22:30:00Z'))).toBe(false);
    expect(opensNextDay('2026-10-22T09:00:00Z', 'UTC', new Date('2026-10-21T22:30:00Z'))).toBe(true);
  });
});
