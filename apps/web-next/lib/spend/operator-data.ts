import 'server-only';
import { getMessengerServiceClient } from '@/lib/messenger/db';
import { isSiteTenantKey } from '@/lib/tenancy/tenant-key';
import { siteDailyAiTurns } from '@/lib/messenger/ai-budget';
import { siteDailyLooks } from '@/lib/try-on/daily-budget';
import { readDailyUsage, dailyKeys } from './daily-counter';
import { readSpendLimits } from './store';
import { SPEND_LIMIT_KEYS, effectiveSpendLimit, type SpendLimitKey } from './limits';

export type OperatorLimitRow = { key: SpendLimitKey; override: number | null; defaultLimit: number; limit: number; used: number | null };
export async function operatorLimitRows(tenant: string): Promise<OperatorLimitRow[]> {
  const limits = await readSpendLimits(tenant);
  let siteId: string | null = isSiteTenantKey(tenant) ? tenant.slice(5) : null;
  if (!siteId) {
    const row = await getMessengerServiceClient().from('widget_sites').select('id').eq('domain', tenant).limit(1).maybeSingle();
    if (row.error) throw new Error('Spend usage unavailable');
    siteId = row.data?.id ?? null;
  }
  const now = new Date();
  const keys = [dailyKeys('tryon', tenant, now)[0], ...(siteId ? [dailyKeys('chat', siteId, now)[0]] : [])];
  const usage = await readDailyUsage(keys).catch(() => null);
  return SPEND_LIMIT_KEYS.map(key => {
    const defaultLimit = key === 'tryOnDailyLooks' ? siteDailyLooks() : siteDailyAiTurns();
    return { key, override: limits[key] ?? null, defaultLimit, limit: effectiveSpendLimit(limits[key], defaultLimit),
      used: usage ? key === 'tryOnDailyLooks' ? usage[0] : siteId ? usage[1] : 0 : null };
  });
}
