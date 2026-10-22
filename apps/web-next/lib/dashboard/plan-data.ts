import 'server-only';

import { getMessengerServiceClient } from '@/lib/messenger/db';
import { withoutTestLooks } from '@/lib/try-on/test-looks';
import { getShopPlanState, listPlansCatalog } from '@/app/dashboard/try-on/plan-actions';
import type { Currency } from '@/lib/pricing/currency';
import type { PlanFacts } from './plan-model';

const DAY = 86_400_000;
/** Cycles of looks the page reads: this one and the two before it. */
const CYCLES = 3;
const MAX_LOOKS = 20_000;

/* The facts behind the v16 Plan page, for the active store's shop. The plan
   and the catalogue come through the Try-On page's own reads, which allow
   only the owner (item 12) and reconcile the subscription first; the looks
   are the shop's completed ones over three cycles, test looks left out. A
   failure throws, and the page says so. */
export async function getPlanFacts({
  shop,
  timeZone,
  currency,
  now = Date.now(),
}: {
  shop: string;
  timeZone: string;
  currency: Currency;
  now?: number;
}): Promise<PlanFacts> {
  const [plan, catalog] = await Promise.all([getShopPlanState(shop), listPlansCatalog(shop)]);
  const start = plan.currentPeriodStart ? Date.parse(plan.currentPeriodStart) : NaN;
  const end = plan.currentPeriodEnd ? Date.parse(plan.currentPeriodEnd) : NaN;
  const cycleLength = Number.isFinite(start) && Number.isFinite(end) && end > start ? end - start : 30 * DAY;
  // Earlier cycles follow the calendar, so read a few days more than their length.
  const since = new Date((Number.isFinite(start) ? start : now - cycleLength) - (CYCLES - 1) * cycleLength - 4 * DAY).toISOString();

  const supabase = getMessengerServiceClient();
  const result = await withoutTestLooks((excludeTestLooks) => {
    const query = supabase
      .from('tryon_jobs')
      .select('created_at')
      .eq('shop', shop)
      .eq('status', 'completed')
      .gte('created_at', since)
      .limit(MAX_LOOKS);
    return excludeTestLooks ? query.eq('is_test', false) : query;
  });
  if (result.error) throw new Error(result.error.message);
  const looks = ((result.data ?? []) as Array<{ created_at: string }>)
    .map((row) => Date.parse(row.created_at))
    .filter(Number.isFinite);

  return { now, timeZone, plan, plans: catalog.plans, currency, looks };
}
