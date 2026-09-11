import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { decryptToken, encryptToken } from './token-crypto';
import { normalizeShopDomain } from './shop-authorization';
import { APP_SCOPES } from './oauth';

/* Per-shop Shopify Admin API tokens (offline access).

   Stored encrypted (see token-crypto.ts) in a service_role-only table with
   RLS on and no policies, so no browser role can read a row even before
   decryption is considered. */

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

/** Test seam, mirroring lib/messenger/db.ts. */
export function setShopTokenClientForTests(next: SupabaseClient | null): void {
  client = next ?? undefined;
}

export async function storeShopToken(input: {
  shopDomain: string;
  accessToken: string;
  scopes: string;
}): Promise<void> {
  const domain = normalizeShopDomain(input.shopDomain);
  if (!domain) throw new Error('Invalid shop domain');

  const encrypted = encryptToken(input.accessToken);
  const now = new Date().toISOString();
  const res = await getServiceClient()
    .from('shopify_shop_tokens')
    .upsert(
      {
        shop_domain: domain,
        access_token_ciphertext: encrypted.ciphertext,
        token_iv: encrypted.iv,
        token_tag: encrypted.tag,
        scopes: input.scopes.slice(0, 500),
        rotated_at: now,
      },
      { onConflict: 'shop_domain' },
    );
  if (res.error) throw new Error(`shop token store failed: ${res.error.message}`);
}

/* Whether this store has granted order access, without decrypting the token.
   The Support Desk panel offered "Grant order access" with no way of knowing
   whether it had ever been granted, so the merchant could only find out by
   pressing it again and watching what happened. */
export async function hasShopOrderAccess(shopDomain: string): Promise<boolean> {
  const domain = normalizeShopDomain(shopDomain);
  if (!domain) return false;
  const res = await getServiceClient()
    .from('shopify_shop_tokens')
    .select('scopes')
    .eq('shop_domain', domain)
    .maybeSingle();
  return !res.error && typeof res.data?.scopes === 'string' && hasOrderScope(res.data.scopes);
}

/** Null means "this store has not authorized order access", which every
 *  caller must treat as a normal state rather than an error. */
export async function getShopToken(shopDomain: string): Promise<{ accessToken: string; scopes: string } | null> {
  const domain = normalizeShopDomain(shopDomain);
  if (!domain) return null;

  const res = await getServiceClient()
    .from('shopify_shop_tokens')
    .select('access_token_ciphertext, token_iv, token_tag, scopes')
    .eq('shop_domain', domain)
    .maybeSingle();
  if (res.error || !res.data) return null;

  const row = res.data as Record<string, string>;
  try {
    return {
      accessToken: decryptToken({
        ciphertext: row.access_token_ciphertext,
        iv: row.token_iv,
        tag: row.token_tag,
      }),
      scopes: row.scopes ?? '',
    };
  } catch (error) {
    /* Wrong key, rotated key, or a tampered row. Never fall through to a
       partial value: an unreadable token is an absent token. */
    console.error('[shopify] token decrypt failed:', error instanceof Error ? error.message : error);
    return null;
  }
}

/** Called on app/uninstalled. A token we can no longer use is a credential
 *  we should no longer hold. */
export async function deleteShopToken(shopDomain: string): Promise<boolean> {
  const domain = normalizeShopDomain(shopDomain);
  if (!domain) return false;
  try {
    const res = await getServiceClient().from('shopify_shop_tokens').delete().eq('shop_domain', domain);
    if (res.error) throw new Error('Token deletion did not complete');
    // A missing row is already clean; repeated deliveries are safe.
    return true;
  } catch {
    // Database/provider errors can contain sensitive context. Keep the event
    // useful for alerting without logging their payload or credential data.
    console.error('[shopify] token delete failed');
    return false;
  }
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
