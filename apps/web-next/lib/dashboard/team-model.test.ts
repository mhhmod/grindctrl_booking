import { describe, expect, it } from 'vitest';
import { getTeamCopy } from './team-copy';
import { buildTeamView, describeHours, type TeamFacts } from './team-model';

const en = getTeamCopy('en');
const ar = getTeamCopy('ar');
const h = (day: number, start: number, end: number) => ({ day, startMinute: start * 60, endMinute: end * 60 });
/** The board's hours: Saturday to Thursday 10 to 10, Friday 2 to 10. */
const BOARD_HOURS = [h(6, 10, 22), h(0, 10, 22), h(1, 10, 22), h(2, 10, 22), h(3, 10, 22), h(4, 10, 22), h(5, 14, 22)];

function facts(over: Partial<TeamFacts> = {}, site: Partial<NonNullable<TeamFacts['site']>> = {}): TeamFacts {
  return {
    people: [
      { profileId: 'p3', name: 'Nour Samir', email: 'nour@maisonnoor.com', role: 'member' },
      { profileId: 'p1', name: 'Hana Adel', email: 'hana@maisonnoor.com', role: 'owner' },
      { profileId: 'p2', name: null, email: 'youssef@maisonnoor.com', role: 'admin' },
    ],
    invites: null,
    site: {
      emailOnHandoff: true,
      recipients: [],
      availabilityMode: 'hours',
      availabilityTimezone: 'Africa/Cairo',
      availabilityHours: BOARD_HOURS,
      ...site,
    },
    afterHours: true,
    ...over,
  };
}

describe('Team, people', () => {
  it('lists the owner first, then admins and members, with their role and email', () => {
    expect(buildTeamView(facts(), en, 'en').people).toEqual([
      { key: 'p1', name: 'Hana Adel', email: 'hana@maisonnoor.com', role: 'Owner', roleKey: 'owner', owner: true, initials: 'HA', editable: false },
      { key: 'p2', name: 'youssef@maisonnoor.com', email: null, role: 'Admin', roleKey: 'admin', owner: false, initials: 'Y', editable: false },
      { key: 'p3', name: 'Nour Samir', email: 'nour@maisonnoor.com', role: 'Member', roleKey: 'member', owner: false, initials: 'NS', editable: false },
    ]);
    expect(buildTeamView(facts(), en, 'en')).toMatchObject({ manage: false, invites: [] });
  });

  it('leaves out someone with neither a name nor an address', () => {
    const view = buildTeamView(facts({ people: [{ profileId: 'p9', name: null, email: null, role: 'member' }] }), en, 'en');
    expect(view.people).toEqual([]);
  });

  it('names the roles in Arabic', () => {
    expect(buildTeamView(facts(), ar, 'ar').people.map((p) => p.role)).toEqual(['المالك', 'مسؤول', 'عضو']);
  });
});

describe('Team, email alerts', () => {
  it('says who gets them: the owners and admins with an address when Store Chat has none of its own', () => {
    expect(buildTeamView(facts(), en, 'en').alerts).toBe(
      'Email alerts go to hana@maisonnoor.com and youssef@maisonnoor.com when a shopper needs a person.',
    );
  });

  it('names the addresses Store Chat was given, in Arabic too', () => {
    const given = facts({}, { recipients: ['Desk@MaisonNoor.com', 'hana@maisonnoor.com', 'desk@maisonnoor.com'] });
    expect(buildTeamView(given, en, 'en').alerts).toBe(
      'Email alerts go to desk@maisonnoor.com and hana@maisonnoor.com when a shopper needs a person.',
    );
    expect(buildTeamView(given, ar, 'ar').alerts).toBe(
      'تُرسل تنبيهات البريد الإلكتروني إلى desk@maisonnoor.com وhana@maisonnoor.com عندما تحتاج متسوقة إلى شخص من الفريق.',
    );
  });

  it('says plainly when they are off, when nobody has an address, and when there is no Store Chat', () => {
    expect(buildTeamView(facts({}, { emailOnHandoff: false }), en, 'en').alerts).toBe(en.alertsOff);
    expect(buildTeamView(facts({ people: [{ profileId: 'p1', name: 'Hana', email: null, role: 'owner' }] }), en, 'en').alerts).toBe(
      en.alertsNobody,
    );
    expect(buildTeamView(facts({ site: null }), en, 'en')).toMatchObject({ alerts: null, hours: null, outsideHours: false });
  });
});

describe('Team, opening hours', () => {
  it('reads the hours as the board does, Saturday first, in the store’s city', () => {
    expect(buildTeamView(facts(), en, 'en').hours).toBe('Saturday to Thursday 10 am to 10 pm, Friday 2 pm to 10 pm, Cairo time.');
    expect(buildTeamView(facts(), ar, 'ar').hours).toBe(
      'من السبت إلى الخميس من 10 ص إلى 10 م، والجمعة من 2 م إلى 10 م، بتوقيت القاهرة.',
    );
  });

  it('keeps a break in the week, two days, half hours, midnight and two windows a day', () => {
    const hours = [h(0, 9, 17), h(1, 9, 17), { day: 3, startMinute: 570, endMinute: 0 }, h(5, 10, 13), h(5, 16, 22)];
    expect(describeHours(hours, 'America/New_York', en, 'en')).toBe(
      'Sunday and Monday 9 am to 5 pm, Wednesday 9:30 am to midnight, Friday 10 am to 1 pm and 4 pm to 10 pm, New York time.',
    );
    // No city a shopper would know in Arabic: no zone named.
    expect(describeHours([h(1, 9, 17)], 'America/New_York', ar, 'ar')).toBe('الاثنين من 9 ص إلى 5 م.');
  });

  it('says when the team is always in, or has no hours', () => {
    expect(buildTeamView(facts({}, { availabilityMode: 'always' }), en, 'en')).toMatchObject({ hours: 'Always open.', outsideHours: false });
    expect(buildTeamView(facts({}, { availabilityHours: [] }), en, 'en')).toMatchObject({ hours: 'No opening hours are set.', outsideHours: false });
  });

  it('says nobody is alerted outside the hours only where after hours is on', () => {
    expect(buildTeamView(facts(), en, 'en').outsideHours).toBe(true);
    expect(buildTeamView(facts({ afterHours: false }), en, 'en').outsideHours).toBe(false);
  });
});

describe('Team, managing it (n21_team_invites)', () => {
  const NOW = Date.parse('2026-10-22T09:00:00Z');
  const DAY = 86_400_000;
  const invite = (id: string, sentDaysAgo: number, role: 'admin' | 'member' = 'admin') => ({
    id,
    email: `${id}@maisonnoor.com`,
    role,
    invitedAt: new Date(NOW - sentDaysAgo * DAY).toISOString(),
    expiresAt: new Date(NOW - sentDaysAgo * DAY + 7 * DAY).toISOString(),
  });

  it('offers Edit on everyone but the owner and the person reading', () => {
    const team = facts({
      now: NOW,
      invites: [],
      people: [
        { profileId: 'p1', name: 'Hana Adel', email: 'hana@maisonnoor.com', role: 'owner' },
        { profileId: 'p2', name: 'Youssef Hany', email: 'youssef@maisonnoor.com', role: 'admin', you: true },
        { profileId: 'p3', name: 'Nour Samir', email: 'nour@maisonnoor.com', role: 'member' },
      ],
    });
    const view = buildTeamView(team, en, 'en');
    expect(view.manage).toBe(true);
    expect(view.people.map((p) => [p.name, p.editable])).toEqual([
      ['Hana Adel', false],
      ['Youssef Hany', false],
      ['Nour Samir', true],
    ]);
  });

  it('lists the invites with when they went out, and says when one has expired', () => {
    const view = buildTeamView(facts({ now: NOW, invites: [invite('youssef', 2), invite('reem', 0, 'member'), invite('omar', 1), invite('old', 9)] }), en, 'en');
    expect(view.invites.map((i) => [i.email, i.role, i.sent, i.expired])).toEqual([
      ['youssef@maisonnoor.com', 'Admin', 'Invited 2 days ago', false],
      ['reem@maisonnoor.com', 'Member', 'Invited today', false],
      ['omar@maisonnoor.com', 'Admin', 'Invited yesterday', false],
      ['old@maisonnoor.com', 'Admin', 'Invite expired', true],
    ]);
  });

  it('says when they went out in Arabic, with counts that agree', () => {
    const view = buildTeamView(facts({ now: NOW, invites: [invite('a', 2), invite('b', 1), invite('c', 3), invite('d', 0)] }), ar, 'ar');
    expect(view.invites.map((i) => i.sent)).toEqual([
      'أُرسلت الدعوة قبل يومين',
      'أُرسلت الدعوة أمس',
      'أُرسلت الدعوة قبل 3 أيام',
      'أُرسلت الدعوة اليوم',
    ]);
  });
});
