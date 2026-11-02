import 'server-only';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { normalizeShopDomain } from './shop-authorization';
import { findShopifyAppByClientId } from './app-registry';
import { invalidateProxyConfig } from './proxy-config-cache';

export interface InstallationEvent {
  appClientId: string; shopDomain: string; webhookId: string;
  topic: string; payload: unknown; triggeredAt: string | null;
}
export interface EventReceipt { id: string; status: string; duplicate: boolean; alertSent: boolean }
export async function recordInstallationEvent(input: InstallationEvent): Promise<EventReceipt> {
  const shop = normalizeShopDomain(input.shopDomain);
  if (!shop || !findShopifyAppByClientId(input.appClientId) || !input.webhookId || input.webhookId.length > 200) {
    throw new Error('invalid_installation_event');
  }
  const client = installationEventClient();
  const { data, error } = await client.rpc('record_shopify_installation_event_v2', {
    p_app: input.appClientId, p_shop: shop, p_webhook: input.webhookId,
    p_topic: input.topic, p_payload: input.payload,
    p_digest: createHash('sha256').update(JSON.stringify(input.payload)).digest('hex'),
    p_triggered_at: input.triggeredAt && Number.isFinite(Date.parse(input.triggeredAt)) ? input.triggeredAt : null,
  });
  if (error || !data || typeof data.id !== 'string' || typeof data.status !== 'string') {
    throw new Error('installation_event_not_recorded');
  }
  invalidateProxyConfig(shop);
  return data as EventReceipt;
}

/** Pricing reads are retried independently of receipt status. Scope every update
 * to the verified app/shop/topic so this cannot complete another lifecycle job. */
export async function markShopifyPricingEvent(
  input: Pick<InstallationEvent, 'appClientId' | 'shopDomain'> & { eventId: string },
  status: 'received' | 'completed',
): Promise<void> {
  const shop = normalizeShopDomain(input.shopDomain);
  if (!shop || findShopifyAppByClientId(input.appClientId)?.distribution !== 'public' || !input.eventId) {
    throw new Error('invalid_pricing_event');
  }
  let query = installationEventClient().from('shopify_installation_events').update({
    status,
    reason: status === 'completed' ? 'authoritative_snapshot_reconciled' : 'authoritative_reconciliation_required',
    processed_at: status === 'completed' ? new Date().toISOString() : null,
  }).eq('id', input.eventId).eq('app_client_id', input.appClientId)
    .eq('shop_domain', shop).eq('topic', 'app_subscriptions/update');
  // A duplicate must not erase the successful outcome of an earlier delivery.
  if (status === 'received') query = query.eq('status', 'ignored');
  const { error, data } = await query.select('id');
  if (error || !Array.isArray(data) || (status === 'completed' && data.length !== 1)) {
    throw new Error('pricing_event_not_recorded');
  }
}

export function installationEventClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service configuration is missing');
  return createClient(url, key, { auth: { persistSession: false } });
}
