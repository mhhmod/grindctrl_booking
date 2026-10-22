import { describe, expect, it } from 'vitest';
import type { PlanCatalogItem } from '@/lib/try-on/entitlement';
import { getPlanCopy } from './plan-copy';
import { buildPlanView, type PlanFacts, type PlanState } from './plan-model';

const DAY = 86_400_000;
const NOW = Date.parse('2026-10-02T12:00:00Z');
const START = Date.parse('2026-09-18T00:00:00Z');
const END = Date.parse('2026-10-18T00:00:00Z');
const en = getPlanCopy('en');
const ar = getPlanCopy('ar');

const catalogItem = (over: Partial<PlanCatalogItem>): PlanCatalogItem => ({
  id: 'p',
  planKey: 'growth-v1',
  name: 'Growth',
  description: null,
  priceMinor: 2900,
  currency: 'USD',
  rendersIncluded: 350,
  modelKey: 'lite',
  periodUnit: 'month',
  periodCount: 1,
  graceDays: 3,
  isFree: false,
  active: true,
  sortOrder: 30,
  ...over,
});
const PLANS = [
  catalogItem({ id: 'f', planKey: 'free-v1', name: 'Free', priceMinor: 0, rendersIncluded: 15, isFree: true, sortOrder: 10 }),
  catalogItem({ id: 'l', planKey: 'launch-v1', name: 'Launch', priceMinor: 1500, rendersIncluded: 150, sortOrder: 20 }),
  catalogItem({}),
  catalogItem({ id: 'o', planKey: 'old-v0', name: 'Old', active: false, sortOrder: 5 }),
];

const PLAN: PlanState = {
  planKey: 'growth-v1',
  planName: 'Growth',
  status: 'active',
  isFree: false,
  rendersIncluded: 350,
  topUpCreditsRemaining: 0,
  totalCreditsRemaining: 150,
  currentPeriodStart: new Date(START).toISOString(),
  currentPeriodEnd: new Date(END).toISOString(),
  available: true,
};

/** `perDay` looks a day for `days` days before now, spread through each day. */
function looksAt(perDay: number, days: number, until = NOW): number[] {
  const out: number[] = [];
  for (let d = 0; d < days; d++) for (let i = 0; i < perDay; i++) out.push(until - d * DAY - (i + 1) * 60_000);
  return out;
}

function facts(over: Partial<PlanFacts> = {}, plan: Partial<PlanState> = {}): PlanFacts {
  return { now: NOW, timeZone: 'Africa/Cairo', plan: { ...PLAN, ...plan }, plans: PLANS, currency: 'USD', looks: looksAt(14, 14), ...over };
}

describe('Plan, looks this cycle', () => {
  it('says what is left of the plan, when it resets, and when the looks run out at this pace', () => {
    const v = buildPlanView(facts(), en, 'en');
    expect(v.headline).toEqual({
      left: '150 left',
      sub: 'of 350, resets 18 October',
      added: null,
      badge: { tone: 'attention', label: 'Runs out about 13 October' },
    });
    expect(v.pace).toBe('At this pace, about 14 looks a day, you’ll run out 5 days before the reset.');
    expect(v.hides).toBe('The Try it on button hides while you’re out.');
  });

  it('says the looks last to the reset at a slower pace, and plainly when none were made', () => {
    const slow = buildPlanView(facts({ looks: looksAt(3, 14) }), en, 'en');
    expect(slow.headline.badge).toEqual({ tone: 'ok', label: 'Should last to the reset' });
    expect(slow.pace).toBe('At this pace, about 3 looks a day, they’ll last to your 18 October reset.');
    expect(slow.hides).toBeNull();
    expect(buildPlanView(facts({ looks: [] }), en, 'en').pace).toBe('No looks were made in the last 7 days.');
  });

  it('leads with the button being hidden when the looks are gone or the plan is not active', () => {
    // No pace once there is nothing left to use at it.
    expect(buildPlanView(facts({}, { totalCreditsRemaining: 0, available: false }), en, 'en')).toMatchObject({
      headline: { badge: { tone: 'danger', label: 'Out of looks' } },
      pace: null,
      hides: 'The Try it on button is hidden until the looks reset on 18 October.',
    });
    expect(buildPlanView(facts({}, { status: 'expired', available: false }), en, 'en')).toMatchObject({
      headline: { badge: { tone: 'danger', label: 'Plan not active' } },
      pace: null,
      hides: 'The Try it on button is hidden until the plan is active again.',
      plan: { status: 'Expired', tone: 'danger', renews: null },
    });
  });

  it('counts looks the owner added into what is left', () => {
    expect(buildPlanView(facts({}, { topUpCreditsRemaining: 80, totalCreditsRemaining: 230 }), en, 'en').headline).toMatchObject({
      left: '230 left',
      added: 'Includes 80 looks you added.',
    });
  });
});

describe('the chart of looks used this cycle', () => {
  it('runs a day at a time from the start of the cycle to today, then at this pace to the day they run out', () => {
    const chart = buildPlanView(facts(), en, 'en').chart!;
    expect(chart.used[0]).toMatchObject({ label: '18 Sept', used: 0 });
    expect(chart.used.at(-1)).toMatchObject({ used: 196 });
    expect(chart.limit).toBe(196 + 150);
    expect(chart.limitLabel).toBe('Your 346');
    expect(chart.todayLabel).toBe('Today, 196 used');
    expect(chart.projection).toHaveLength(2);
    expect(chart.projection[1].used).toBe(346);
    expect(chart.noTryOn).toMatchObject({ to: END, label: '5 days without try-on' });
    expect(chart.endLabel).toBe('18 Oct');
    expect(chart.description).toBe(
      '196 of 346 looks used by 2 October. At about 14 a day, all 346 are used around 13 October, 5 days before the 18 October reset.',
    );
    // Every day of the cycle so far, used never going down.
    expect(chart.used.length).toBeGreaterThanOrEqual(15);
    expect(chart.used.every((p, i, all) => i === 0 || p.used >= all[i - 1].used)).toBe(true);
  });

  it('has no projection or band without a pace, and no chart without a cycle', () => {
    const quiet = buildPlanView(facts({ looks: [] }), en, 'en').chart!;
    expect(quiet.projection).toEqual([]);
    expect(quiet.noTryOn).toBeNull();
    expect(quiet.description).toBe('0 of 150 looks used by 2 October.');
    expect(
      buildPlanView(facts({ looks: looksAt(3, 14) }, { topUpCreditsRemaining: 80, totalCreditsRemaining: 300 }), en, 'en').chart!.description,
    ).toBe('42 of 342 looks used by 2 October, with 80 added. At about 3 a day, they last to the 18 October reset.');
    expect(buildPlanView(facts({}, { currentPeriodStart: null, currentPeriodEnd: null }), en, 'en')).toMatchObject({ chart: null, meter: null, cycles: null });
  });
});

describe('the plan, the last three cycles and the plans', () => {
  it('names the plan with its price, looks and renewal', () => {
    expect(buildPlanView(facts(), en, 'en').plan).toEqual({
      name: 'Growth',
      status: 'Active',
      tone: 'ok',
      price: '$29 a month',
      line: '350 looks a month, Store Chat included.',
      renews: 'Renews on 18 October.',
    });
  });

  it('counts each of the last three cycles against the plan, a calendar month each', () => {
    const before = [...looksAt(150, 1, Date.parse('2026-08-01T12:00:00Z')), ...looksAt(300, 1, Date.parse('2026-09-01T12:00:00Z'))];
    const cycles = buildPlanView(facts({ looks: [...before, ...looksAt(14, 14)] }), en, 'en').cycles!;
    expect(cycles.rows.map((r) => [r.label, r.used, r.current])).toEqual([
      ['18 July to 18 August', 150, false],
      ['18 August to 18 September', 300, false],
      ['This cycle so far', 196, true],
    ]);
    expect(cycles.limitLabel).toBe('Your 350');
  });

  it('lists the active plans in their order, marking the current one', () => {
    expect(buildPlanView(facts(), en, 'en').plans).toEqual([
      { key: 'free-v1', name: 'Free', price: '$0 a month', looks: '15 looks a month', current: false },
      { key: 'launch-v1', name: 'Launch', price: '$15 a month', looks: '150 looks a month', current: false },
      { key: 'growth-v1', name: 'Growth', price: '$29 a month', looks: '350 looks a month', current: true },
    ]);
  });

  it('lists the plans in one currency, the store’s own plan’s, or the chosen one on Free', () => {
    const egp = [
      ...PLANS,
      catalogItem({ id: 'le', planKey: 'launch-v1-egp', name: 'Launch', priceMinor: 75000, currency: 'EGP', rendersIncluded: 150, sortOrder: 20 }),
      catalogItem({ id: 'ge', planKey: 'growth-v1-egp', name: 'Growth', priceMinor: 145000, currency: 'EGP', sortOrder: 30 }),
    ];
    const paid = buildPlanView(facts({ plans: egp }, { planKey: 'growth-v1-egp' }), en, 'en');
    expect(paid.plans.map((p) => [p.key, p.price, p.current])).toEqual([
      ['free-v1', 'EGP\u00a00 a month', false],
      ['launch-v1-egp', 'EGP\u00a0750 a month', false],
      ['growth-v1-egp', 'EGP\u00a01,450 a month', true],
    ]);
    expect(paid.plan?.price).toBe('EGP\u00a01,450 a month');
    // On Free, the currency the person chose; the store's plan is listed once.
    const free = buildPlanView(facts({ plans: egp, currency: 'EGP' }, { planKey: 'free-v1', planName: 'Free', isFree: true }), en, 'en');
    expect(free.plans.map((p) => p.key)).toEqual(['free-v1', 'launch-v1-egp', 'growth-v1-egp']);
    expect(buildPlanView(facts({ plans: egp }, { planKey: 'free-v1', isFree: true }), en, 'en').plans.map((p) => p.key)).toEqual([
      'free-v1',
      'launch-v1',
      'growth-v1',
    ]);
  });
});

describe('Plan in Arabic', () => {
  it('reads with counts that agree and Western digits', () => {
    const v = buildPlanView(facts(), ar, 'ar');
    expect(v.headline.left).toBe('150 متبقية');
    expect(v.headline.badge?.label).toBe('تنفد تقريباً يوم 13 أكتوبر');
    expect(v.pace).toBe('بهذا المعدل، نحو 14 إطلالة يومياً، ستنفد إطلالاتك قبل 5 أيام من تجدد الدورة.');
    expect(v.plan?.line).toBe('350 إطلالة شهرياً، ودردشة المتجر مشمولة.');
    expect(ar.chartDaysWithout(2)).toBe('يومين بدون تجربة');
    expect(v.chart?.description).toBe(
      'استُخدمت 196 من 346 إطلالة حتى 2 أكتوبر. بمعدل 14 يومياً تقريباً، تنفد الإطلالات كلها نحو 13 أكتوبر، أي قبل 5 أيام من تجدد الدورة في 18 أكتوبر.',
    );
    expect(v.plans.map((p) => p.price)).toEqual(['$0 شهرياً', '$15 شهرياً', '$29 شهرياً']);
    expect(JSON.stringify(v)).not.toMatch(/[٠-٩]/);
  });
});
