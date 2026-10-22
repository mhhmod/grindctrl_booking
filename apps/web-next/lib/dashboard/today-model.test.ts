import { describe, expect, it } from 'vitest';
import { getTodayCopy } from './today-copy';
import { INBOX_HREF, PLAN_HREF, buildTodayView, relativeAgo, runOutProjection, type TodayFacts } from './today-model';

const en = getTodayCopy('en');
const ar = getTodayCopy('ar');
// Friday 2 October 2026, 14:00 in Cairo.
const NOW = Date.parse('2026-10-02T11:00:00Z');
const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();

// Plenty of looks left at this pace, so nothing runs out by default.
const TRY_ON: NonNullable<TodayFacts['tryOn']> = {
  looksLeft: 300,
  looksIncluded: 350,
  available: true,
  planName: 'Growth',
  planActive: true,
  resetAt: '2026-10-18T00:00:00Z',
  looksLast7: 98,
  looksPrev7: 83,
  looksToday: 14,
};

const CHAT: NonNullable<TodayFacts['chat']> = {
  lastSeenAt: minutesAgo(2),
  waiting: [],
  chatsToday: 18,
  handedOffToday: 0,
  solved7: 120,
  handedOff7: 20,
  handoffs7: 20,
  alertProblems7: 0,
  teamReplyMinutes: 9,
  emailsTeam: true,
};

function facts(over: Partial<TodayFacts> = {}): TodayFacts {
  return { now: NOW, timeZone: 'Africa/Cairo', canBilling: true, tryOn: TRY_ON, chat: CHAT, ...over };
}
const view = (over: Partial<TodayFacts> = {}, copy = en, locale: 'en' | 'ar' = 'en') => buildTodayView(facts(over), copy, locale);

describe('the health strip', () => {
  it('says everything is working, with what is live and when Store Chat was seen', () => {
    expect(view().health).toEqual({
      tone: 'ok',
      lead: 'Everything is working',
      items: [
        { icon: 'shirt', text: 'Try-on live' },
        { icon: 'chat', text: 'Store Chat live, seen 2 min ago' },
      ],
    });
  });

  it('leads with what stops sales, and tells used-up looks from a plan that is not active', () => {
    expect(view({ tryOn: { ...TRY_ON, available: false, looksLeft: 0 } }).health).toMatchObject({
      tone: 'danger',
      lead: 'Try it on is hidden, no looks left',
    });
    expect(view({ tryOn: { ...TRY_ON, available: false, planActive: false } }).health.lead).toBe(
      'Try it on is hidden, the plan is not active',
    );
  });

  it('names a Store Chat never seen or quiet for a day, and alerts that reach nobody', () => {
    expect(view({ chat: { ...CHAT, lastSeenAt: null } }).health).toMatchObject({
      tone: 'attention',
      lead: 'Store Chat not seen on your store yet',
    });
    expect(view({ chat: { ...CHAT, lastSeenAt: minutesAgo(26 * 60) } }).health.lead).toBe('Store Chat last seen 1 day ago');
    const alerts = view({ chat: { ...CHAT, alertProblems7: 2 } }).health;
    expect(alerts.lead).toBe('Handoff emails are not reaching anyone');
    expect(alerts.items.map((item) => item.text)).toContain('Store Chat live, seen 2 min ago');
  });

  it('leaves out a part the store does not have', () => {
    expect(view({ tryOn: null }).health.items.map((item) => item.text)).toEqual(['Store Chat live, seen 2 min ago']);
    expect(view({ chat: null }).health.items.map((item) => item.text)).toEqual(['Try-on live']);
  });
});

describe('Needs you', () => {
  const waiting = [
    { since: minutesAgo(12), alertSent: true, cart: { totalMinor: 650_000, currency: 'EGP' } },
    { since: minutesAgo(3), alertSent: true, cart: { totalMinor: 335_000, currency: 'EGP' } },
    { since: minutesAgo(1), alertSent: false, cart: null },
  ];

  it('lists waiting shoppers with the longest wait and what their carts hold', () => {
    const needs = view({ chat: { ...CHAT, waiting } }).needsYou!;
    expect(needs.count).toBe('1 thing');
    expect(needs.rows[0]).toMatchObject({
      kind: 'waiting',
      title: '3 shoppers are waiting for a person',
      action: { label: 'Open inbox', href: INBOX_HREF },
    });
    expect(needs.rows[0].line.replace(/ /g, ' ')).toBe('Longest wait 12 min · their carts hold EGP 9,850');
  });

  it('says one shopper waits and that the team was emailed, and never sums mixed currencies', () => {
    const one = view({ chat: { ...CHAT, waiting: [{ since: minutesAgo(4), alertSent: true, cart: null }] } }).needsYou!;
    expect(one.rows[0].title).toBe('1 shopper wants a person');
    expect(one.rows[0].line).toBe('Waiting 4 min · your team was emailed');
    const mixed = view({
      chat: {
        ...CHAT,
        waiting: [
          { since: minutesAgo(5), alertSent: true, cart: { totalMinor: 1000, currency: 'EGP' } },
          { since: minutesAgo(2), alertSent: true, cart: { totalMinor: 1000, currency: 'USD' } },
        ],
      },
    }).needsYou!;
    expect(mixed.rows[0].line).toBe('Longest wait 5 min');
  });

  it('warns when looks run out inside 14 days and before the reset, for the owner only', () => {
    const lowLooks = { ...TRY_ON, looksLeft: 140, looksLast7: 98, resetAt: '2026-10-18T11:00:00Z' };
    const needs = view({ tryOn: lowLooks }).needsYou!;
    expect(needs.rows[0]).toMatchObject({
      kind: 'run_out',
      title: 'Looks run out in about 10 days',
      line: "At this pace, 6 days before your 18 October reset. Try it on hides while you're out.",
      action: { label: 'See your plan', href: PLAN_HREF },
    });
    expect(view({ tryOn: lowLooks, canBilling: false }).needsYou).toBeNull();
  });

  it('ranks what stops sales first, then waiting shoppers, then the run-out', () => {
    const rows = view({
      tryOn: { ...TRY_ON, available: false, looksLeft: 0 },
      chat: { ...CHAT, waiting },
    }).needsYou!.rows;
    expect(rows.map((row) => row.kind)).toEqual(['try_on_hidden', 'waiting']);
    expect(rows[0].line).toBe('The looks for this cycle are used up, so Try it on is hidden. They come back on 18 October.');
    expect(view({ tryOn: { ...TRY_ON, available: false, looksLeft: 0 } }, en).needsYou!.count).toBe('1 thing');
  });

  it('offers no plan link to a member', () => {
    const rows = view({ tryOn: { ...TRY_ON, available: false, looksLeft: 0 }, canBilling: false }).needsYou!.rows;
    expect(rows[0].action).toBeNull();
  });
});

describe('the run-out projection', () => {
  it('runs at the last 7 days’ pace and says nothing when the looks outlast the cycle', () => {
    expect(runOutProjection({ looksLeft: 140, looksLast7: 98, resetAt: '2026-10-18T11:00:00Z' }, NOW)).toEqual({
      days: 10,
      daysBeforeReset: 6,
    });
    expect(runOutProjection({ looksLeft: 140, looksLast7: 98, resetAt: '2026-10-08T00:00:00Z' }, NOW)).toBeNull();
    expect(runOutProjection({ looksLeft: 300, looksLast7: 98, resetAt: null }, NOW)).toBeNull();
    expect(runOutProjection({ looksLeft: 140, looksLast7: 0, resetAt: null }, NOW)).toBeNull();
    expect(runOutProjection({ looksLeft: 20, looksLast7: 98, resetAt: null }, NOW)).toEqual({ days: 1, daysBeforeReset: null });
  });
});

describe('Nothing needs you', () => {
  it('says plainly the assistant handled the day, and promises an email only when one goes out', () => {
    expect(view().calm).toEqual({
      body: "The assistant handled all 18 chats today and nobody is waiting. We'll email you if a shopper needs a person.",
      chips: ['14 looks today'],
    });
    expect(view({ chat: { ...CHAT, emailsTeam: false } }).calm!.body).toBe(
      'The assistant handled all 18 chats today and nobody is waiting.',
    );
    expect(view({ chat: { ...CHAT, handedOffToday: 3 } }).calm!.body).toMatch(/^The assistant handled 15 of 18 chats today/);
    expect(view({ chat: { ...CHAT, chatsToday: 0 } }).calm!.body).toMatch(/^No chats yet today/);
  });
});

describe('Last 7 days', () => {
  it('compares looks with the week before, and leaves the comparison out without one', () => {
    expect(view().tiles[0]).toEqual({ key: 'looks', label: 'Looks', value: '98', sub: '18% more than the 7 days before', trend: 'up' });
    expect(view({ tryOn: { ...TRY_ON, looksPrev7: 120 } }).tiles[0].sub).toBe('18% fewer than the 7 days before');
    expect(view({ tryOn: { ...TRY_ON, looksPrev7: 98 } }).tiles[0].sub).toBe('Same as the 7 days before');
    expect(view({ tryOn: { ...TRY_ON, looksPrev7: 0 } }).tiles[0].sub).toBe('');
  });

  it('counts the chats the assistant solved out of the finished ones, and the team’s measured reply', () => {
    const [, solved, reply] = view().tiles;
    expect(solved).toMatchObject({ value: '86%', sub: 'Of 140 chats, the rest went to the team' });
    expect(reply).toMatchObject({ value: '9 min', sub: 'During opening hours' });
    const quiet = view({ chat: { ...CHAT, solved7: 0, handedOff7: 0, teamReplyMinutes: null } }).tiles;
    expect(quiet[1]).toMatchObject({ value: '–', sub: 'No finished chats yet' });
    expect(quiet[2]).toMatchObject({ value: '–', sub: 'Shown once your team has answered 5 handoffs' });
  });
});

describe('Health details', () => {
  it('lists each check with its result, and the plan only for the owner', () => {
    const rows = view().details.rows;
    expect(rows.map((row) => [row.key, row.tone])).toEqual([
      ['try_on', 'ok'],
      ['chat', 'ok'],
      ['alerts', 'ok'],
      ['billing', 'ok'],
    ]);
    expect(rows[0].result).toBe('Showing on your store, 300 looks left of 350.');
    expect(rows[3].result).toBe('Growth, active until 18 October.');
    expect(view({ canBilling: false }).details.rows.map((row) => row.key)).not.toContain('billing');
  });
});

describe('Today in Arabic', () => {
  it('counts as Arabic does, with Western digits and the store’s money', () => {
    const v = view({ chat: { ...CHAT, waiting: [
      { since: minutesAgo(12), alertSent: true, cart: { totalMinor: 985_000, currency: 'EGP' } },
      { since: minutesAgo(3), alertSent: true, cart: null },
      { since: minutesAgo(2), alertSent: true, cart: null },
    ] } }, ar, 'ar');
    expect(v.needsYou!.rows[0].title).toBe('3 متسوقين ينتظرون شخصاً من فريقك');
    expect(v.needsYou!.rows[0].line.replace(/\u00a0/g, ' ')).toBe('أطول انتظار 12 دقيقة · وفي سلالهم 9,850 ج.م');
    expect(v.health.items.map((item) => item.text)).toContain('دردشة المتجر تعمل، آخر نشاط قبل دقيقتين');
    expect(v.tiles[2].value).toBe('9 دقائق');
    expect(ar.thingsCount(2)).toBe('أمران، الأكثر إلحاحاً أولاً');
    expect(ar.looksToday(14)).toBe('14 إطلالة اليوم');
    expect(JSON.stringify(v)).not.toMatch(/[٠-٩]/);
  });

  it('writes the reset date with Western digits', () => {
    const v = view({ tryOn: { ...TRY_ON, looksLeft: 140, resetAt: '2026-10-18T11:00:00Z' } }, ar, 'ar');
    expect(v.needsYou!.rows[0].line).toContain('18 أكتوبر');
  });
});

describe('relativeAgo', () => {
  it('reads as minutes, hours and days', () => {
    expect(relativeAgo(minutesAgo(0), NOW, en)).toBe('just now');
    expect(relativeAgo(minutesAgo(59), NOW, en)).toBe('59 min ago');
    expect(relativeAgo(minutesAgo(61), NOW, en)).toBe('1 hour ago');
    expect(relativeAgo(minutesAgo(3 * 24 * 60), NOW, en)).toBe('3 days ago');
  });
});
