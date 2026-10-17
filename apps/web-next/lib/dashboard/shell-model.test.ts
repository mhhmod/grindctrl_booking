import { describe, expect, it } from 'vitest';
import { getShellCopy } from './shell-copy';
import {
  buildShellStores,
  looksMeterView,
  shellRole,
  storeInitials,
  storeSwitchHref,
  todayHeading,
  type MeterEntitlement,
} from './shell-model';

const SITE_SHOP = '11111111-1111-4111-8111-111111111111';
const SITE_WEB = '22222222-2222-4222-8222-222222222222';
const en = getShellCopy('en');
const ar = getShellCopy('ar');

const shops = [
  { domain: 'maison-noor.myshopify.com', status: 'installed' as const, lastSeenAt: '2026-10-16T00:00:00Z' },
  { domain: 'kids.myshopify.com', status: 'installed' as const, lastSeenAt: '2026-10-10T00:00:00Z' },
];
const sites = [
  { id: SITE_SHOP, name: 'Maison Noor', domain: 'maison-noor.myshopify.com' },
  { id: SITE_WEB, name: 'My store', domain: 'maison.example' },
];

describe('buildShellStores', () => {
  it('lists each shop, named after its Store Chat site, then sites on other websites', () => {
    const stores = buildShellStores(shops, sites, { shopDomain: 'maison-noor.myshopify.com', siteId: SITE_SHOP });
    expect(stores.map((s) => [s.label, s.domain, s.current])).toEqual([
      ['Maison Noor', 'maison-noor.myshopify.com', true],
      ['kids', 'kids.myshopify.com', false],
      ['My store', 'maison.example', false],
    ]);
    expect(stores.map((s) => s.choice)).toEqual([
      { shop: 'maison-noor.myshopify.com' },
      { shop: 'kids.myshopify.com' },
      { site: SITE_WEB },
    ]);
  });

  it('marks a Store Chat site on another website as current when it is the active store', () => {
    const stores = buildShellStores(shops, sites, { shopDomain: null, siteId: SITE_WEB });
    expect(stores.filter((s) => s.current).map((s) => s.label)).toEqual(['My store']);
  });

  it('gives each store initials', () => {
    expect(storeInitials('Maison Noor')).toBe('MN');
    expect(storeInitials('kids')).toBe('KI');
    expect(storeInitials('noor-kids.myshopify.com')).toBe('NK');
  });
});

describe('storeSwitchHref', () => {
  it('switches on the page the person is on', () => {
    expect(storeSwitchHref('/dashboard/try-on', { shop: 'kids.myshopify.com' })).toBe(
      '/dashboard/try-on?shop=kids.myshopify.com',
    );
    expect(storeSwitchHref('/dashboard', { site: SITE_WEB })).toBe(`/dashboard?site=${SITE_WEB}`);
  });
});

describe('looksMeterView', () => {
  const growth: MeterEntitlement = {
    available: true,
    isFree: false,
    rendersIncluded: 350,
    totalCreditsRemaining: 150,
    bannerState: 'none',
  };

  it('reads like the board on a paid plan', () => {
    expect(looksMeterView(growth, en)).toEqual({
      title: 'Looks this cycle',
      value: '150 left of 350',
      percent: 43,
      low: false,
    });
    expect(looksMeterView(growth, ar)?.value).toBe('150 متبقية من 350');
  });

  it('reads like Today-Setup on the free plan', () => {
    expect(looksMeterView({ ...growth, isFree: true, rendersIncluded: 15, totalCreditsRemaining: 15 }, en)).toEqual({
      title: 'Free looks',
      value: '15 left of 15 this month',
      percent: 100,
      low: false,
    });
  });

  it('turns to the attention colour at the low and critical warnings', () => {
    for (const bannerState of ['low', 'critical', 'exhausted']) {
      expect(looksMeterView({ ...growth, bannerState }, en)?.low).toBe(true);
    }
  });

  it('is left out without a plan it can read', () => {
    expect(looksMeterView(null, en)).toBeNull();
    expect(looksMeterView({ ...growth, available: false }, en)).toBeNull();
    expect(looksMeterView({ ...growth, rendersIncluded: 0 }, en)).toBeNull();
  });
});

describe('todayHeading', () => {
  // Friday 2 October 2026, 13:30 in Cairo (UTC+3 in summer time).
  const afternoon = new Date('2026-10-02T10:30:00Z');

  it('dates and greets in the store’s time zone', () => {
    expect(todayHeading(afternoon, 'Africa/Cairo', 'en', 'Hana', en)).toEqual({
      date: 'Friday, 2 October',
      greeting: 'Good afternoon, Hana',
    });
    expect(todayHeading(afternoon, 'Africa/Cairo', 'ar', 'هناء', ar)).toEqual({
      date: 'الجمعة، 2 أكتوبر',
      greeting: 'مساء الخير يا هناء',
    });
  });

  it('uses the morning and evening greetings', () => {
    expect(todayHeading(new Date('2026-10-02T05:00:00Z'), 'Africa/Cairo', 'en', 'Hana', en).greeting).toBe(
      'Good morning, Hana',
    );
    expect(todayHeading(new Date('2026-10-02T18:00:00Z'), 'Africa/Cairo', 'ar', null, ar).greeting).toBe('مساء الخير');
  });

  it('falls back to UTC for an unknown time zone, and keeps Western digits in Arabic', () => {
    const heading = todayHeading(afternoon, 'Not/AZone', 'ar', null, ar);
    expect(heading.date).toBe('الجمعة، 2 أكتوبر');
    expect(heading.date).not.toMatch(/[٠-٩]/);
  });
});

describe('shellRole', () => {
  it('names only the three workspace roles', () => {
    expect(['owner', 'admin', 'member', 'viewer', null].map(shellRole)).toEqual(['owner', 'admin', 'member', null, null]);
    expect(en.roles).toEqual({ owner: 'Owner', admin: 'Admin', member: 'Member' });
  });
});

describe('shell copy', () => {
  it.each(['en', 'ar'] as const)('has no em dashes or Eastern digits in %s', (locale) => {
    const copy = getShellCopy(locale);
    const text = JSON.stringify(copy) + [copy.looksLeft(1, 2), copy.freeLooksLeft(1, 2), copy.switchStore('X'), copy.waiting(3)].join(' ');
    expect(text).not.toContain('—');
    expect(text).not.toMatch(/[٠-٩۰-۹]/);
  });
});
