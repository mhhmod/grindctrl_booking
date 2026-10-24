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
  const { data, error } = await client.rpc('record_shopify_installation_event', {
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
export function installationEventClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service configuration is missing');
  return createClient(url, key, { auth: { persistSession: false } });
}
