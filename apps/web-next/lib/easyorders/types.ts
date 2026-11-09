import type { EncryptedToken } from '@/lib/shopify/token-crypto';

export type EasyOrdersStatus = 'pending' | 'pending_confirmation' | 'active' | 'disconnected' | 'error';
/** Server-only connection. Never return this row from dashboard actions. */
export type EasyOrdersConnection = {
  widget_site_id: string;
  store_id: string | null;
  store_name: string | null;
  api_key: EncryptedToken | null;
  webhook_token: string;
  webhook_secret: EncryptedToken | null;
  callback_origin: string;
  status: EasyOrdersStatus;
  connected_at: string | null;
  last_webhook_at: string | null;
  last_error: string | null;
  order_cache_version: number;
  products_synced_at: string | null;
};
/** Server-only install state. `staged_key` is the credential the provider
 *  delivered, held until the link's creator confirms it on our dashboard. */
export type EasyOrdersInstallState = {
  widget_site_id: string;
  nonce_hash: string;
  created_by: string;
  expires_at: string;
  consumed_at: string | null;
  staged_key: EncryptedToken | null;
  staged_store_id: string | null;
  staged_expires_at: string | null;
  outcome: 'active' | 'rejected' | 'expired' | 'unverified' | null;
};
export type EasyOrdersSummary = Pick<EasyOrdersConnection,
  'store_id' | 'store_name' | 'status' | 'connected_at' | 'last_webhook_at' | 'last_error' | 'products_synced_at'>;
export type EasyOrdersResult<T> = { ok: true; data: T } | {
  ok: false; code: 'forbidden' | 'invalid_request' | 'invalid_state' | 'connection_conflict' | 'rate_limited' | 'unavailable';
  retryAfterSeconds?: number;
};
/** What the dashboard return page shows after the provider redirect. */
export type EasyOrdersInstallResult =
  | { status: 'pending_confirmation'; storeId: string | null;
      /** Absent when the store is staged and waiting for the owner's confirmation. */
      reason?: 'awaiting_callback' | 'provider_unavailable' | 'rate_limited'; retryAfterSeconds?: number }
  | { status: 'active'; storeId: string; storeName?: string }
  | { status: 'expired' }
  | { status: 'failed'; reason: EasyOrdersInstallFailure; retryAfterSeconds?: number };
export type EasyOrdersInstallFailure = 'signed_out' | 'wrong_account' | 'forbidden' | 'invalid_link' | 'cancelled'
  | 'provider_rejected' | 'store_already_connected' | 'rate_limited' | 'unavailable';
export class EasyOrdersError extends Error {
  constructor(readonly code: 'invalid_state' | 'connection_conflict' | 'unavailable') { super(code); }
}
