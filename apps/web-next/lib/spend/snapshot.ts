import 'server-only';
import { getMessengerServiceClient } from '@/lib/messenger/db';
import { siteDailyAiTurns, globalDailyAiTurns } from '@/lib/messenger/ai-budget';
import { siteDailyLooks, globalDailyLooks } from '@/lib/try-on/daily-budget';
import { demoDailyBudget } from '@/lib/try-on/demo-allowance';
import { dailyKeys, readDailyUsage } from './daily-counter';
import { effectiveSpendLimit, spendLimits } from './limits';

export type SpendFeature = 'Store Chat' | 'Try-On' | 'Try-On demo';
export type SpendUsage = { feature: SpendFeature; used: number; limit: number; store?: string };
export type SpendSnapshot = { global: SpendUsage[]; stores: SpendUsage[] };
type StoreRow = { id?: string; domain?: string | null; shop_domain?: string; status?: string; settings_json: unknown };

async function storeRows(table: 'widget_sites' | 'tryon_shops'): Promise<StoreRow[]> {
  const rows: StoreRow[] = [];
  const db = getMessengerServiceClient();
  for (let start = 0; ; start += 500) {
    const result = await db.from(table).select(table === 'widget_sites' ? 'id, domain, settings_json' : 'shop_domain, status, settings_json')
      .order(table === 'widget_sites' ? 'id' : 'shop_domain').range(start, start + 499).returns<StoreRow[]>();
    if (result.error) throw new Error('Spend alert stores unavailable');
    const page = (result.data ?? []) as StoreRow[];
    rows.push(...page);
    if (page.length < 500) break;
  }
  return rows;
}

/** Existing counters suffice: no Redis scan, new index, or database counter.
 * Page stores and bulk-read their keys; top stores comes from the same data. */
export async function readSpendSnapshot(now = new Date()): Promise<SpendSnapshot> {
  const [sites, shops] = await Promise.all([storeRows('widget_sites'), storeRows('tryon_shops')]);
  const shopLimits = new Map(shops.filter(shop => shop.status === 'installed').map(shop => [shop.shop_domain!, spendLimits(shop.settings_json)]));
  const candidates: Array<Omit<SpendUsage, 'used'> & { key: string }> = [];
  for (const shop of shops) {
    candidates.push({ feature: 'Try-On', store: shop.shop_domain!, limit: effectiveSpendLimit(spendLimits(shop.settings_json).tryOnDailyLooks, siteDailyLooks()), key: dailyKeys('tryon', shop.shop_domain!, now)[0] });
  }
  for (const site of sites) {
    const limits = shopLimits.get(site.domain ?? '') ?? spendLimits(site.settings_json);
    const store = shopLimits.has(site.domain ?? '') ? site.domain! : 'site:' + site.id!;
    candidates.push({ feature: 'Store Chat', store, limit: effectiveSpendLimit(limits.storeChatDailyTurns, siteDailyAiTurns()), key: dailyKeys('chat', site.id!, now)[0] });
    // Site-keyed installs (Woo and paste) do not use Shopify's billing tenant.
    const tenant = 'site:' + site.id!;
    candidates.push({ feature: 'Try-On', store: tenant, limit: effectiveSpendLimit(spendLimits(site.settings_json).tryOnDailyLooks, siteDailyLooks()), key: dailyKeys('tryon', tenant, now)[0] });
  }
  const globalKeys = [dailyKeys('chat', '', now)[1], dailyKeys('tryon', '', now)[1], 'gc-demo:{' + now.toISOString().slice(0, 10) + '}:spent'];
  const totals = await readDailyUsage(globalKeys);
  const stores: SpendUsage[] = [];
  for (let start = 0; start < candidates.length; start += 200) {
    const batch = candidates.slice(start, start + 200);
    const counts = await readDailyUsage(batch.map(row => row.key));
    stores.push(...batch.map((row, i) => ({ feature: row.feature, store: row.store, limit: row.limit, used: counts[i] })));
  }
  return { global: [
    { feature: 'Store Chat', used: totals[0], limit: globalDailyAiTurns() },
    { feature: 'Try-On', used: totals[1], limit: globalDailyLooks() },
    { feature: 'Try-On demo', used: totals[2], limit: demoDailyBudget() },
  ], stores };
}
