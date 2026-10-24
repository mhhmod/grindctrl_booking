import 'server-only';

import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { decryptToken, encryptToken } from './token-crypto';
import { normalizeShopDomain } from './shop-authorization';
import { findShopifyAppByClientId } from './app-registry';
import { APP_SCOPES } from './oauth';

let client: SupabaseClient | undefined;
function getServiceClient(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Supabase service configuration is missing');
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}
export function setShopTokenClientForTests(next: SupabaseClient | null): void { client = next ?? undefined; }

export interface InstallationToken {
  accessToken: string;
  scopes: string;
  appClientId: string;
  installationId: string;
}
export interface ShopifyTokenResponse {
  access_token?: string;
  scope?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
}
type CredentialRow = {
  id: string; shop_domain: string; app_client_id: string; status: string; scopes: string;
  access_token_ciphertext: string | null; token_iv: string | null; token_tag: string | null;
  refresh_token_ciphertext: string | null; refresh_token_iv: string | null; refresh_token_tag: string | null;
  access_expires_at: string | null; refresh_expires_at: string | null;
  credential_version: number;
  refresh_retry_after?: string | null;
};
export class ShopifyCredentialError extends Error {
  constructor(readonly code: 'busy' | 'reauthorization_required' | 'storage_unavailable' | 'exchange_failed') {
    super(code); this.name = 'ShopifyCredentialError';
  }
}
/** Never include provider bodies or credentials in an error. */
export class ShopifyTokenRequestError extends ShopifyCredentialError {
  constructor(readonly kind: 'transient' | 'terminal' | 'rejected', readonly retryAfterMs = 1000) {
    super('exchange_failed');
  }
}

/** Missing application identity is accepted ONLY when the store has exactly one
 * active, configured installation. Old domain-only rows are never guessed. */
async function credentialRow(shop: string, appClientId?: string): Promise<CredentialRow | null> {
  let query = getServiceClient().from('shopify_installations').select('*').eq('shop_domain', shop);
  if (appClientId) query = query.eq('app_client_id', appClientId);
  else query = query.eq('status', 'active');
  const { data, error } = await query.limit(2);
  if (error) throw new ShopifyCredentialError('storage_unavailable');
  if (!data || data.length !== 1) return null;
  const row = data[0] as CredentialRow;
  return findShopifyAppByClientId(row.app_client_id) ? row : null;
}

async function operation(shop: string, app: string, op: string, lease: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await getServiceClient().rpc('shopify_credential_operation', {
    p_shop: shop, p_app: app, p_operation: op, p_lease: lease, p_payload: payload,
  });
  if (error) throw new ShopifyCredentialError('storage_unavailable');
  if (op === 'acquire') {
    if (data === null) return null;
    if (!data || typeof data !== 'object' || typeof data.id !== 'string'
      || data.shop_domain !== shop || data.app_client_id !== app || typeof data.scopes !== 'string') {
      throw new ShopifyCredentialError('storage_unavailable');
    }
  } else if (!data || data.ok !== true) {
    throw new ShopifyCredentialError('storage_unavailable');
  }
  return data;
}
function expiry(seconds: unknown, now: number): string {
  if (typeof seconds !== 'number' || !Number.isSafeInteger(seconds) || seconds <= 0 || seconds > 315360000) {
    throw new ShopifyCredentialError('exchange_failed');
  }
  return new Date(now + seconds * 1000).toISOString();
}
function encryptedResponse(response: ShopifyTokenResponse, expiring: boolean, acquisition: boolean) {
  if (typeof response.access_token !== 'string' || !response.access_token.trim()
    || typeof response.scope !== 'string' || response.scope.length > 5000) {
    throw new ShopifyCredentialError('exchange_failed');
  }
  const access = encryptToken(response.access_token);
  const now = Date.now();
  const hasExpiry = response.expires_in !== undefined;
  if (expiring && !hasExpiry) throw new ShopifyCredentialError('exchange_failed');
  if (hasExpiry && (!response.refresh_token || response.refresh_token_expires_in === undefined)) {
    throw new ShopifyCredentialError('exchange_failed');
  }
  const refresh = response.refresh_token ? encryptToken(response.refresh_token) : null;
  return {
    acquisition, scopes: response.scope,
    access_token_ciphertext: access.ciphertext, token_iv: access.iv, token_tag: access.tag,
    refresh_token_ciphertext: refresh?.ciphertext ?? null,
    refresh_token_iv: refresh?.iv ?? null, refresh_token_tag: refresh?.tag ?? null,
    access_expires_at: hasExpiry ? expiry(response.expires_in, now) : null,
    refresh_expires_at: refresh ? expiry(response.refresh_token_expires_in, now) : null,
  };
}
function usable(row: CredentialRow, marginMs = 30_000): InstallationToken | null {
  if (row.status !== 'active' || !row.access_token_ciphertext || !row.token_iv || !row.token_tag) return null;
  if (row.access_expires_at && Date.parse(row.access_expires_at) <= Date.now() + marginMs) return null;
  try {
    return {
      accessToken: decryptToken({ ciphertext: row.access_token_ciphertext, iv: row.token_iv, tag: row.token_tag }),
      scopes: row.scopes, appClientId: row.app_client_id, installationId: row.id,
    };
  } catch { return null; }
}

/** One bounded call. Only refresh grants may be retried by the lease owner. */
export async function requestShopifyToken(shop: string, body: Record<string, string | number>): Promise<ShopifyTokenResponse> {
  if (!normalizeShopDomain(shop)) throw new ShopifyTokenRequestError('rejected');
  let response: Response;
  try {
    response = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(10_000), cache: 'no-store', redirect: 'error',
    });
  } catch { throw new ShopifyTokenRequestError('transient'); }
  if (response.status === 429 || response.status >= 500) {
    const header = response.headers.get('retry-after');
    const seconds = header && /^\d+(\.\d+)?$/.test(header) ? Number(header) * 1000 : NaN;
    const dateDelay = header ? Date.parse(header) - Date.now() : NaN;
    const delay = Number.isFinite(seconds) ? seconds : Number.isFinite(dateDelay) ? dateDelay : 1000;
    throw new ShopifyTokenRequestError('transient', Math.max(1000, Math.min(delay, 365 * 86400000)));
  }
  if (!response.ok) throw new ShopifyTokenRequestError(response.status === 401 ? 'terminal' : 'rejected');
  try { return await response.json() as ShopifyTokenResponse; }
  catch { throw new ShopifyTokenRequestError('transient'); } // Lost/truncated refresh response is recoverable.
}

/** Acquisition and refresh share the same distributed DB lease, including the
 * network call AND persistence. A lifecycle event fences an in-flight writer. */
export async function acquireShopToken(input: {
  shopDomain: string; appClientId: string;
  exchange: () => Promise<ShopifyTokenResponse>;
  force?: boolean;
}): Promise<InstallationToken> {
  const shop = normalizeShopDomain(input.shopDomain);
  const app = findShopifyAppByClientId(input.appClientId);
  if (!shop || !app) throw new ShopifyCredentialError('reauthorization_required');
  const lease = randomUUID();
  const row = await operation(shop, app.clientId, 'acquire', lease) as CredentialRow | null;
  if (!row) throw new ShopifyCredentialError('busy');
  try {
    const existing = usable(row);
    if (existing && hasRequiredScopes(existing.scopes) && !input.force) {
      await operation(shop, app.clientId, 'release', lease);
      return existing;
    }
    const granted = await input.exchange();
    await operation(shop, app.clientId, 'commit', lease, encryptedResponse(granted, app.tokenMode !== 'non-expiring', true));
    const stored = await credentialRow(shop, app.clientId);
    const token = stored && usable(stored);
    if (!token) throw new ShopifyCredentialError('reauthorization_required');
    return token;
  } catch (error) {
    // Unknown exchange result is not retried with the same code/refresh token.
    await operation(shop, app.clientId, 'reauthorize', lease).catch(() => {});
    throw error instanceof ShopifyCredentialError ? error : new ShopifyCredentialError('exchange_failed');
  }
}

export async function getShopToken(shopDomain: string, appClientId?: string): Promise<InstallationToken | null> {
  const shop = normalizeShopDomain(shopDomain);
  if (!shop || (appClientId !== undefined && !findShopifyAppByClientId(appClientId))) return null;
  const row = await credentialRow(shop, appClientId);
  if (!row || row.status !== 'active') return null;
  const token = usable(row);
  if (token) return token;
  if (!row.access_expires_at || !row.refresh_token_ciphertext || !row.refresh_token_iv || !row.refresh_token_tag
    || !row.refresh_expires_at || !(Date.parse(row.refresh_expires_at) > Date.now())) return null;
  const app = findShopifyAppByClientId(row.app_client_id)!;
  const lease = randomUUID();
  const locked = await operation(shop, app.clientId, 'acquire', lease, { refresh: true }) as CredentialRow | null;
  if (!locked) return null; // Another acquisition/refresh is in flight; fail closed.
  try {
    const fresh = usable(locked);
    if (fresh) { await operation(shop, app.clientId, 'release', lease); return fresh; }
    if (locked.status !== 'active') { await operation(shop, app.clientId, 'release', lease); return null; }
    if (!locked.refresh_token_ciphertext || !locked.refresh_token_iv || !locked.refresh_token_tag
      || !locked.refresh_expires_at || !(Date.parse(locked.refresh_expires_at) > Date.now())) {
      await operation(shop, app.clientId, 'reauthorize', lease); return null;
    }
    const refresh = decryptToken({ ciphertext: locked.refresh_token_ciphertext, iv: locked.refresh_token_iv, tag: locked.refresh_token_tag });
    // Shopify permits replay of the presented refresh token until its replacement
    // is used (subject to provider expiry/grace). Do not invent a grace lifetime.
    let granted: ShopifyTokenResponse | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        granted = await requestShopifyToken(shop, {
          client_id: app.clientId, client_secret: app.secret, grant_type: 'refresh_token', refresh_token: refresh,
        });
        break;
      } catch (error) {
        if (!(error instanceof ShopifyTokenRequestError) || error.kind !== 'transient') throw error;
        if (attempt === 2 || error.retryAfterMs > 2000) {
          await operation(shop, app.clientId, 'defer', lease, {
            retry_after: new Date(Date.now() + Math.max(60000, error.retryAfterMs)).toISOString(),
          });
          return null; // Do not hand out a near-expiry credential during cooldown.
        }
        await new Promise(resolve => setTimeout(resolve, error.retryAfterMs));
      }
    }
    if (!granted) return null;
    const encrypted = encryptedResponse(granted, true, false);
    // Persistence can fail after Shopify rotated. Preserve the old encrypted
    // refresh token and release/defer under the SAME fence for safe recovery.
    try { await operation(shop, app.clientId, 'commit', lease, encrypted); }
    catch {
      await operation(shop, app.clientId, 'defer', lease, { retry_after: new Date(Date.now() + 60000).toISOString() }).catch(() => {});
      return null;
    }
    const updated = await credentialRow(shop, app.clientId);
    return updated ? usable(updated) : null;
  } catch (error) {
    // A database outage, malformed/lost success response or crypto/configuration
    // failure is not evidence that Shopify rejected the refresh token.
    const action = error instanceof ShopifyTokenRequestError && error.kind !== 'transient' ? 'reauthorize' : 'defer';
    await operation(shop, app.clientId, action, lease, { retry_after: new Date(Date.now() + 60000).toISOString() }).catch(() => {});
    return null;
  }
}

/** Uninstall verification uses the current app's credential under the shared
 * lease. A valid old body/unsigned header cannot itself retire a newer token. */
export async function verifyShopifyUninstall(shopDomain: string, appClientId: string, eventId: string): Promise<void> {
  const shop = normalizeShopDomain(shopDomain);
  if (!shop || !findShopifyAppByClientId(appClientId)) throw new ShopifyCredentialError('reauthorization_required');
  // Resolve expiry through the same serialized refresh path first. A terminal
  // refresh retires only this credential; it is not fabricated uninstall proof.
  // A successful refresh must be persisted before probing its replacement.
  await getShopToken(shop, appClientId);
  const lease = randomUUID();
  const row = await operation(shop, appClientId, 'acquire', lease) as CredentialRow | null;
  if (!row) throw new ShopifyCredentialError('busy');
  try {
    // Expired/unknown credentials cannot prove current uninstall. Keep the
    // durable request pending for refresh/re-authorization/manual inspection.
    const token = usable(row, 0);
    if (!token) throw new ShopifyCredentialError('reauthorization_required');
    const response = await fetch(`https://${shop}/admin/api/2026-07/graphql.json`, {
      method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(8000),
      headers: { 'content-type': 'application/json', 'X-Shopify-Access-Token': token.accessToken },
      body: JSON.stringify({ query: '{ currentAppInstallation { id } }' }),
    });
    let outcome: 'revoked' | 'active';
    if (response.status === 401) outcome = 'revoked';
    else if (response.ok) {
      const data = await response.json();
      if (!data?.data?.currentAppInstallation?.id || data.errors?.length) throw new Error('verification_unavailable');
      outcome = 'active';
    } else throw new Error('verification_unavailable'); // 403/429/5xx are not uninstall proof.
    const { data, error } = await getServiceClient().rpc('resolve_shopify_uninstall', {
      p_event: eventId, p_installation: row.id, p_version: row.credential_version, p_lease: lease, p_outcome: outcome,
    });
    if (error || data?.ok !== true) throw new ShopifyCredentialError('storage_unavailable');
  } finally {
    await operation(shop, appClientId, 'release', lease).catch(() => {});
  }
}

export async function hasShopOrderAccess(shopDomain: string, appClientId?: string): Promise<boolean> {
  try { const token = await getShopToken(shopDomain, appClientId); return Boolean(token && hasOrderScope(token.scopes)); }
  catch { return false; }
}

/** Order lookup needs this scope specifically; holding a token from before
 *  the scope change is not the same as being allowed to read orders. */
export function hasOrderScope(scopes: string): boolean {
  return scopes
    .split(',')
    .map((scope) => scope.trim())
    .includes('read_orders');
}

/** Whether a stored token covers everything the app currently needs. A token
 *  from before APP_SCOPES grew a new scope (e.g. a future addition) is not
 *  sufficient just because a row exists for the shop. */
export function hasRequiredScopes(scopes: string): boolean {
  const granted = new Set(
    scopes
      .split(',')
      .map((scope) => scope.trim())
      .filter(Boolean),
  );
  return APP_SCOPES.split(',').every((scope) => granted.has(scope));
}

/** Installation status check without decrypting/refreshing credentials. */
export async function isActiveShopifyInstallation(shopDomain: string, appClientId: string): Promise<boolean> {
  const shop = normalizeShopDomain(shopDomain);
  if (!shop || !findShopifyAppByClientId(appClientId)) return false;
  try { return (await credentialRow(shop, appClientId))?.status === 'active'; }
  catch { return false; }
}

/** A 401 retires only the exact credential version used by the failed request.
 * A delayed response for a rotated token cannot revoke its replacement. */
export async function retireRejectedShopToken(shopDomain: string, rejectedAccessToken: string): Promise<void> {
  const shop = normalizeShopDomain(shopDomain);
  if (!shop) return;
  const { data, error } = await getServiceClient().from('shopify_installations').select('*')
    .eq('shop_domain', shop).eq('status', 'active');
  if (error || !data) return;
  for (const row of data as Array<CredentialRow & { credential_version: number }>) {
    if (!row.access_token_ciphertext || !row.token_iv || !row.token_tag) continue;
    let value: string;
    try { value = decryptToken({ ciphertext: row.access_token_ciphertext, iv: row.token_iv, tag: row.token_tag }); }
    catch { continue; }
    if (value !== rejectedAccessToken) continue;
    await getServiceClient().rpc('retire_shopify_credential', { p_installation: row.id, p_version: row.credential_version });
  }
}
