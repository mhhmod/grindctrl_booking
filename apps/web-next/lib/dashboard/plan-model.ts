/* What the v16 Plan page shows (04-dashboard.md, the Plan board), from the
   store's own plan, its catalogue and its looks. Left out until their back
   ends exist (item 21), rather than guessed: billing through Shopify, Add
   80 looks and top-ups with their cap, switching plans in the page, the
   recommendation, "Is it paying off?" (N3, N4), and the alerts at 20% and
   5% by email or WhatsApp. Today the team changes plans and adds looks, so
   the page says so and offers the call. */

import type { ShopEntitlement, PlanCatalogItem } from '@/lib/try-on/entitlement';
import { formatStorePrice } from '@/lib/try-on/store-product';
import { displayCurrencyFor, isCurrency, plansForCurrency, type Currency } from '@/lib/pricing/currency';
import { intlLocale } from '@/lib/copy/rules';
import { addStoreDays, startOfStoreDay } from '@/lib/time/store-day';
import type { SiteLocale } from '@/lib/landing/landing-i18n';
import type { PlanCopy } from './plan-copy';
import { dayMonth } from './today-model';

const DAY = 86_400_000;
/** Days of looks the pace is read from, as on Today. */
const PACE_DAYS = 7;

export type PlanState = Pick<
  ShopEntitlement,
  | 'planKey'
  | 'planName'
  | 'status'
  | 'isFree'
  | 'rendersIncluded'
  | 'topUpCreditsRemaining'
  | 'totalCreditsRemaining'
  | 'currentPeriodStart'
  | 'currentPeriodEnd'
  | 'available'
>;

export type PlanFacts = {
  now: number;
  timeZone: string;
  plan: PlanState;
  plans: PlanCatalogItem[];
  /** The currency to list plans in when the store's own plan does not set
   *  one (a free plan): the person's choice on the pricing page, else USD. */
  currency: Currency;
  /** When each look of the last three cycles was made, test looks left out. */
  looks: number[];
};

export type BadgeTone = 'ok' | 'attention' | 'danger';
export type ChartPoint = { at: number; used: number; label: string };

export type PlanChart = {
  start: number;
  end: number;
  /** One point a day from the start of the cycle to today, looks used so far. */
  used: ChartPoint[];
  /** Today, then the day the looks run out or the reset, at this pace. */
  projection: ChartPoint[];
  limit: number;
  limitLabel: string;
  todayLabel: string;
  /** The reset, under the end of the axis. */
  endLabel: string;
  /** One sentence saying what the chart shows, for screen readers. */
  description: string;
  /** From the day the looks run out to the reset, when that comes first. */
  noTryOn: { from: number; to: number; label: string } | null;
};

export type PlanView = {
  headline: { left: string; sub: string; added: string | null; badge: { tone: BadgeTone; label: string } | null };
  /** At this pace, while there are looks to use. */
  pace: string | null;
  hides: string | null;
  chart: PlanChart | null;
  meter: { used: number; limit: number; label: string } | null;
  plan: { name: string; status: string; tone: BadgeTone; price: string | null; line: string | null; renews: string | null } | null;
  cycles: { rows: Array<{ label: string; used: number; current: boolean }>; limit: number; limitLabel: string } | null;
  plans: Array<{ key: string; name: string; price: string; looks: string; current: boolean }>;
};

function shortDate(at: number, locale: SiteLocale, timeZone: string): string {
  return new Intl.DateTimeFormat(locale === 'ar' ? intlLocale('ar') : 'en-GB', { day: 'numeric', month: 'short', timeZone }).format(
    new Date(at),
  );
}

function count(looks: number[], from: number, to: number): number {
  let n = 0;
  for (const at of looks) if (at > from && at <= to) n += 1;
  return n;
}

/** The start of the cycle `back` cycles before the one starting at `start`,
 *  by the plan's own period: calendar months and years, not their length
 *  today (18 August to 18 September is 31 days, the cycle after it 30). */
export function earlierCycleStart(start: number, back: number, period: Pick<PlanCatalogItem, 'periodUnit' | 'periodCount'> | null, fallbackLength: number): number {
  if (!period || back === 0) return start - back * fallbackLength;
  const d = new Date(start);
  if (period.periodUnit === 'month') d.setUTCMonth(d.getUTCMonth() - back * period.periodCount);
  else if (period.periodUnit === 'year') d.setUTCFullYear(d.getUTCFullYear() - back * period.periodCount);
  else return start - back * period.periodCount * DAY;
  return d.getTime();
}

function planPrice(item: PlanCatalogItem, currency: Currency, copy: PlanCopy, locale: SiteLocale) {
  const shown = displayCurrencyFor(item, currency);
  // Dollars read "$29" in both languages, as the boards write them.
  const price = formatStorePrice(item.priceMinor, shown, shown === 'USD' ? 'en' : locale);
  return copy.perPeriod(price, item.periodUnit, item.periodCount);
}

export function buildPlanView(facts: PlanFacts, copy: PlanCopy, locale: SiteLocale): PlanView {
  const { now, timeZone, plan } = facts;
  const start = plan.currentPeriodStart ? Date.parse(plan.currentPeriodStart) : NaN;
  const end = plan.currentPeriodEnd ? Date.parse(plan.currentPeriodEnd) : NaN;
  const hasCycle = Number.isFinite(start) && Number.isFinite(end) && end > start;
  const left = Math.max(0, plan.totalCreditsRemaining);
  const usedThisCycle = hasCycle ? count(facts.looks, start, now) : 0;
  const limit = usedThisCycle + left;
  const perDay = count(facts.looks, now - PACE_DAYS * DAY, now) / PACE_DAYS;
  const reset = hasCycle ? dayMonth(new Date(end).toISOString(), locale, timeZone) : null;
  const active = plan.status === 'active' || plan.status === 'grace';

  // When the looks run out at this pace, if that comes before the reset.
  const runOutAt = perDay > 0 && left > 0 ? now + (left / perDay) * DAY : null;
  const runsOut = hasCycle && runOutAt !== null && runOutAt < end;

  let badge: PlanView['headline']['badge'] = null;
  let hides: string | null = null;
  if (!active && !plan.available) {
    badge = { tone: 'danger', label: copy.planNotActive };
    hides = copy.hiddenPlan;
  } else if (left <= 0) {
    badge = { tone: 'danger', label: copy.outOfLooks };
    hides = reset ? copy.hiddenUntil(reset) : copy.hiddenPlan;
  } else if (runsOut) {
    badge = { tone: 'attention', label: copy.runsOutAbout(dayMonth(new Date(runOutAt!).toISOString(), locale, timeZone)) };
    hides = copy.hidesWhileOut;
  } else if (hasCycle) {
    badge = { tone: 'ok', label: copy.shouldLast };
  }

  const roundedPace = Math.max(1, Math.round(perDay));
  const daysBefore = runsOut ? Math.max(1, Math.round((end - runOutAt!) / DAY)) : 0;
  // Once the looks are gone, or the plan is not active, the hidden button is the news.
  const pace =
    left <= 0 || (!active && !plan.available)
      ? null
      : perDay <= 0
        ? copy.paceNone
        : runsOut
          ? copy.paceRunsOut(roundedPace, daysBefore)
          : reset
            ? copy.paceLasts(roundedPace, reset)
            : copy.paceNone;

  let chart: PlanChart | null = null;
  if (hasCycle) {
    const used: ChartPoint[] = [];
    for (let day = startOfStoreDay(start, timeZone); day <= now; day = addStoreDays(day, 1, timeZone)) {
      const dayEnd = Math.min(addStoreDays(day, 1, timeZone), now);
      used.push({ at: Math.max(day, start), used: count(facts.looks, start, dayEnd), label: shortDate(day, locale, timeZone) });
    }
    const projectionEnd = runsOut ? runOutAt! : end;
    const projection =
      perDay > 0 && left > 0
        ? [
            { at: now, used: usedThisCycle, label: shortDate(now, locale, timeZone) },
            {
              at: projectionEnd,
              used: Math.min(limit, Math.round(usedThisCycle + perDay * ((projectionEnd - now) / DAY))),
              label: shortDate(projectionEnd, locale, timeZone),
            },
          ]
        : [];
    chart = {
      start,
      end,
      used,
      projection,
      limit,
      limitLabel: copy.chartYour(limit),
      todayLabel: copy.chartToday(usedThisCycle),
      endLabel: shortDate(end, locale, timeZone),
      description: copy.chartDesc({
        used: usedThisCycle,
        limit,
        today: dayMonth(new Date(now).toISOString(), locale, timeZone),
        added: plan.topUpCreditsRemaining,
        perDay: perDay > 0 && left > 0 ? roundedPace : 0,
        runOut: runsOut ? dayMonth(new Date(runOutAt!).toISOString(), locale, timeZone) : null,
        daysBefore,
        reset: reset!,
      }),
      noTryOn: runsOut ? { from: runOutAt!, to: end, label: copy.chartDaysWithout(daysBefore) } : null,
    };
  }

  const current = facts.plans.find((item) => item.planKey === plan.planKey) ?? null;
  // Each paid plan is a row per currency; list one currency, the store's own.
  const currency = current && !current.isFree && isCurrency(current.currency) ? current.currency : facts.currency;
  const cycleLength = hasCycle ? end - start : 0;
  const cycles = hasCycle
    ? {
        rows: [2, 1].map((back) => {
          const from = earlierCycleStart(start, back, current, cycleLength);
          const to = earlierCycleStart(start, back - 1, current, cycleLength);
          return {
            label: copy.cycleRange(dayMonth(new Date(from).toISOString(), locale, timeZone), dayMonth(new Date(to).toISOString(), locale, timeZone)),
            used: count(facts.looks, from, to),
            current: false,
          };
        }).concat([{ label: copy.thisCycleSoFar, used: usedThisCycle, current: true }]),
        limit: plan.rendersIncluded,
        limitLabel: copy.yourLimit(plan.rendersIncluded),
      }
    : null;

  return {
    headline: {
      left: copy.left(left),
      sub: reset ? copy.ofResets(String(plan.rendersIncluded), reset) : copy.of(String(plan.rendersIncluded)),
      added: plan.topUpCreditsRemaining > 0 ? copy.addedIncluded(plan.topUpCreditsRemaining) : null,
      badge,
    },
    pace,
    hides,
    chart,
    meter: hasCycle ? { used: usedThisCycle, limit, label: badge?.label ?? '' } : null,
    plan: plan.planName
      ? {
          name: plan.planName,
          status: copy.status[plan.status],
          tone: plan.status === 'active' ? 'ok' : plan.status === 'grace' ? 'attention' : 'danger',
          price: current ? planPrice(current, currency, copy, locale) : null,
          line: current ? copy.planLine(copy.looksPer(current.rendersIncluded, current.periodUnit, current.periodCount)) : null,
          renews: reset && active ? copy.renewsOn(reset) : null,
        }
      : null,
    cycles,
    plans: plansForCurrency(
      facts.plans.filter((item) => item.active),
      currency,
    )
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((item) => ({
        key: item.planKey,
        name: item.name,
        price: planPrice(item, currency, copy, locale),
        looks: copy.looksPer(item.rendersIncluded, item.periodUnit, item.periodCount),
        current: item.planKey === plan.planKey,
      })),
  };
}
