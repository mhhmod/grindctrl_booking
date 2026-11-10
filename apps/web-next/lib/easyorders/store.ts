import 'server-only';
import { getMessengerServiceClient } from '@/lib/messenger/db';
import { EasyOrdersError, type EasyOrdersConnection, type EasyOrdersInstallState } from './types';

export const WEBHOOK_TOKEN = /^[a-f0-9]{64}$/;

export async function easyOrdersRpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await getMessengerServiceClient().rpc(name, args);
  if (error) throw new EasyOrdersError('unavailable');
  return data as T;
}
export async function loadEasyOrdersConnection(siteId: string): Promise<EasyOrdersConnection | null> {
  const { data, error } = await getMessengerServiceClient().from('easyorders_connections')
    .select('widget_site_id,store_id,store_name,api_key,webhook_token,webhook_secret,callback_origin,status,connected_at,last_webhook_at,last_error,order_cache_version,products_synced_at')
    .eq('widget_site_id', siteId).maybeSingle();
  if (error) throw new EasyOrdersError('unavailable');
  return data as EasyOrdersConnection | null;
}
export async function loadEasyOrdersInstall(siteId: string): Promise<EasyOrdersInstallState | null> {
  const { data, error } = await getMessengerServiceClient().from('easyorders_install_states')
    .select('widget_site_id,nonce_hash,created_by,expires_at,consumed_at,staged_key,staged_store_id,staged_expires_at,outcome')
    .eq('widget_site_id', siteId).maybeSingle();
  if (error) throw new EasyOrdersError('unavailable');
  return data as EasyOrdersInstallState | null;
}
export async function connectionByWebhookToken(token: string): Promise<EasyOrdersConnection | null> {
  if (!WEBHOOK_TOKEN.test(token)) return null;
  const { data, error } = await getMessengerServiceClient().from('easyorders_connections')
    .select('widget_site_id,webhook_token,webhook_secret,status').eq('webhook_token', token).eq('status', 'active').maybeSingle();
  if (error) throw new EasyOrdersError('unavailable');
  return data as EasyOrdersConnection | null;
}
