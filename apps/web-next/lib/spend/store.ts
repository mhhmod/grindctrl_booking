import 'server-only';
import { getMessengerServiceClient } from '@/lib/messenger/db';
import { isSiteTenantKey, normalizeTenantKey } from '@/lib/tenancy/tenant-key';
import { spendLimits, type SpendLimits, type SpendLimitKey } from './limits';

export async function readSpendLimits(tenant: string): Promise<SpendLimits> {
  const key = normalizeTenantKey(tenant);
  if (!key) throw new Error('Unknown store');
  const site = isSiteTenantKey(key);
  const result = await getMessengerServiceClient().from(site ? 'widget_sites' : 'tryon_shops')
    .select('settings_json').eq(site ? 'id' : 'shop_domain', site ? key.slice(5) : key).maybeSingle();
  if (result.error || !result.data) throw new Error('Spend limits unavailable');
  return spendLimits(result.data.settings_json);
}

/** Shopify Chat and Try-On use the shop row. Other installs use their site. */
export async function readChatSpendLimits(siteId: string): Promise<SpendLimits> {
  const db = getMessengerServiceClient();
  const site = await db.from('widget_sites').select('domain, settings_json').eq('id', siteId).maybeSingle();
  if (site.error || !site.data) throw new Error('Spend limits unavailable');
  const shop = normalizeTenantKey(site.data.domain);
  if (shop && !isSiteTenantKey(shop)) {
    const row = await db.from('tryon_shops').select('settings_json, status').eq('shop_domain', shop).maybeSingle();
    if (row.error) throw new Error('Spend limits unavailable');
    if (row.data?.status === 'installed') return spendLimits(row.data.settings_json);
  }
  return spendLimits(site.data.settings_json);
}

/** RPC locks the existing store, patches one JSON leaf, and records the
 * operator in messenger_audit in the same transaction. No settings copies. */
export async function writeSpendLimit(tenant: string, key: SpendLimitKey, value: number | null, operator: string): Promise<void> {
  const { error } = await getMessengerServiceClient().rpc('set_store_spend_limit', {
    p_tenant: tenant, p_key: key, p_value: value, p_operator: operator,
  });
  if (error) throw new Error('Spend limit save failed');
}
