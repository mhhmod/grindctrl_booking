import 'server-only';

import { auth } from '@clerk/nextjs/server';
import { randomInt } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const LINK_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const LINK_CODE_LENGTH = 8;
const LINK_CODE_LIFETIME_MS = 10 * 60 * 1_000;

export type ShopLinkCode = { code: string; expiresAt: string };

export type ConsumeShopLinkResult = 'linked' | 'invalid' | 'expired' | 'already_owned';

type ShopLinkRow = {
  clerk_user_id: string;
  expires_at: string;
  consumed_at: string | null;
};

type ShopOwnerRow = {
  owner_clerk_user_id: string | null;
};

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service configuration is missing');

  return createClient(url, key, { auth: { persistSession: false } });
}

async function requireDashboardOwner(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');
  return userId;
}

function generateCode(): string {
  return Array.from(
    { length: LINK_CODE_LENGTH },
    () => LINK_CODE_ALPHABET[randomInt(LINK_CODE_ALPHABET.length)],
  ).join('');
}

function normalizeCode(code: string): string {
  return code.replace(/[\s-]/g, '').toUpperCase();
}

export async function createShopLinkCode(): Promise<ShopLinkCode> {
  const clerkUserId = await requireDashboardOwner();
  const supabase = getServiceClient();

  const { error: deleteError } = await supabase
    .from('tryon_shop_links')
    .delete()
    .eq('clerk_user_id', clerkUserId)
    .is('consumed_at', null);
  if (deleteError) throw new Error(`Unable to replace shop link code: ${deleteError.message}`);

  const code = generateCode();
  const expiresAt = new Date(Date.now() + LINK_CODE_LIFETIME_MS).toISOString();
  const { error: insertError } = await supabase.from('tryon_shop_links').insert({
    code,
    clerk_user_id: clerkUserId,
    expires_at: expiresAt,
  });
  if (insertError) throw new Error(`Unable to create shop link code: ${insertError.message}`);

  return { code, expiresAt };
}

async function markCodeConsumed(
  code: string,
  shopDomain: string,
  consumedAt: string,
): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await supabase
    .from('tryon_shop_links')
    .update({ consumed_at: consumedAt, consumed_shop_domain: shopDomain })
    .eq('code', code)
    .is('consumed_at', null);
  if (error) throw new Error(`Unable to consume shop link code: ${error.message}`);
}

export async function consumeShopLinkCode(
  code: string,
  shopDomain: string,
): Promise<ConsumeShopLinkResult> {
  const normalizedCode = normalizeCode(code);
  const supabase = getServiceClient();
  const { data: link, error: linkError } = await supabase
    .from('tryon_shop_links')
    .select('clerk_user_id, expires_at, consumed_at')
    .eq('code', normalizedCode)
    .maybeSingle();

  if (linkError) throw new Error(`Unable to read shop link code: ${linkError.message}`);
  if (!link) return 'invalid';

  const linkRow = link as ShopLinkRow;
  if (new Date(linkRow.expires_at).getTime() < Date.now()) return 'expired';
  if (linkRow.consumed_at) return 'invalid';

  const { data: shop, error: shopError } = await supabase
    .from('tryon_shops')
    .select('owner_clerk_user_id')
    .eq('shop_domain', shopDomain)
    .maybeSingle();
  if (shopError) throw new Error(`Unable to read Shopify shop: ${shopError.message}`);
  if (!shop) throw new Error('Unable to link unknown Shopify shop');

  const owner = (shop as ShopOwnerRow).owner_clerk_user_id;
  if (owner && owner !== linkRow.clerk_user_id) return 'already_owned';

  if (!owner) {
    /* Keep the ownership check true at write time too. If two accounts race
       after both reading NULL, only the first update may claim the shop; the
       second must observe the winner instead of silently overwriting it. */
    const { data: claimed, error: claimError } = await supabase
      .from('tryon_shops')
      .update({ owner_clerk_user_id: linkRow.clerk_user_id })
      .eq('shop_domain', shopDomain)
      .is('owner_clerk_user_id', null)
      .select('owner_clerk_user_id')
      .maybeSingle();
    if (claimError) throw new Error(`Unable to link Shopify shop: ${claimError.message}`);

    if (!claimed) {
      const { data: current, error: currentError } = await supabase
        .from('tryon_shops')
        .select('owner_clerk_user_id')
        .eq('shop_domain', shopDomain)
        .maybeSingle();
      if (currentError) {
        throw new Error(`Unable to confirm Shopify shop owner: ${currentError.message}`);
      }
      if ((current as ShopOwnerRow | null)?.owner_clerk_user_id !== linkRow.clerk_user_id) {
        return 'already_owned';
      }
    }
  }

  await markCodeConsumed(normalizedCode, shopDomain, new Date().toISOString());
  return 'linked';
}

export async function isShopLinked(shopDomain: string): Promise<boolean> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('tryon_shops')
    .select('owner_clerk_user_id')
    .eq('shop_domain', shopDomain)
    .maybeSingle();
  if (error) throw new Error(`Unable to read Shopify shop link: ${error.message}`);

  return (data as ShopOwnerRow | null)?.owner_clerk_user_id != null;
}
