import 'server-only';

import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { getTryOnSettings, type TryOnSettings } from '@/lib/try-on/settings';
import {
  authorizeDashboardShop,
  normalizeShopDomain,
} from './shop-authorization';

export type TryOnShopStatus = 'installed' | 'uninstalled';

export type ManagedTryOnShop = {
  domain: string;
  status: TryOnShopStatus;
  installedAt: string;
  uninstalledAt: string | null;
  lastSeenAt: string;
  jobCount: number;
  lastJobAt: string | null;
};

type ShopRow = {
  shop_domain: string;
  status: TryOnShopStatus;
  installed_at: string;
  uninstalled_at: string | null;
  last_seen_at: string;
};

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service configuration is missing');

  return createClient(url, key, { auth: { persistSession: false } });
}

async function requireDashboardOwner() {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');
}

export async function recordTryOnShopSeen(shop: unknown): Promise<boolean> {
  const domain = normalizeShopDomain(shop);
  if (!domain) return false;

  try {
    const supabase = getServiceClient();
    const now = new Date().toISOString();
    const { data: current, error: selectError } = await supabase
      .from('tryon_shops')
      .select('status')
      .eq('shop_domain', domain)
      .maybeSingle();

    if (selectError) throw selectError;

    const payload: Record<string, unknown> = {
      shop_domain: domain,
      status: 'installed',
      uninstalled_at: null,
      last_seen_at: now,
      updated_at: now,
    };
    if (!current || current.status === 'uninstalled') payload.installed_at = now;

    const { error } = await supabase
      .from('tryon_shops')
      .upsert(payload, { onConflict: 'shop_domain' });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('tryon_shops seen update failed:', error instanceof Error ? error.message : error);
    return false;
  }
}

export async function markTryOnShopUninstalled(shop: unknown): Promise<boolean> {
  const domain = normalizeShopDomain(shop);
  if (!domain) return false;

  try {
    const supabase = getServiceClient();
    const now = new Date().toISOString();
    const { error } = await supabase.from('tryon_shops').upsert(
      {
        shop_domain: domain,
        status: 'uninstalled',
        uninstalled_at: now,
        last_seen_at: now,
        updated_at: now,
      },
      { onConflict: 'shop_domain' },
    );

    if (error) throw error;
    return true;
  } catch (error) {
    console.error(
      'tryon_shops uninstall update failed:',
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}

export async function requireManagedTryOnShop(selectedShop: unknown): Promise<string> {
  await requireDashboardOwner();
  if (selectedShop === 'default') return 'default';

  const domain = normalizeShopDomain(selectedShop);
  if (!domain) throw new Error('Unknown Shopify shop');

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('tryon_shops')
    .select('shop_domain')
    .eq('shop_domain', domain)
    .eq('status', 'installed')
    .maybeSingle();

  if (error) throw new Error(`Shop authorization failed: ${error.message}`);
  return authorizeDashboardShop(domain, data ? [data.shop_domain] : []);
}

export async function listManagedTryOnShops(): Promise<ManagedTryOnShop[]> {
  await requireDashboardOwner();

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('tryon_shops')
    .select('shop_domain, status, installed_at, uninstalled_at, last_seen_at')
    .order('last_seen_at', { ascending: false });

  if (error) throw new Error(`Unable to list Shopify shops: ${error.message}`);

  return Promise.all(
    ((data ?? []) as ShopRow[]).map(async (shop) => {
      const { data: jobs, count, error: jobsError } = await supabase
        .from('tryon_jobs')
        .select('created_at', { count: 'exact' })
        .eq('shop', shop.shop_domain)
        .order('created_at', { ascending: false })
        .limit(1);

      if (jobsError) {
        throw new Error(`Unable to load job stats for ${shop.shop_domain}: ${jobsError.message}`);
      }

      return {
        domain: shop.shop_domain,
        status: shop.status,
        installedAt: shop.installed_at,
        uninstalledAt: shop.uninstalled_at,
        lastSeenAt: shop.last_seen_at,
        jobCount: count ?? 0,
        lastJobAt: jobs?.[0]?.created_at ?? null,
      };
    }),
  );
}

export async function getManagedTryOnShopSettings(
  selectedShop: unknown,
): Promise<TryOnSettings> {
  const shop = await requireManagedTryOnShop(selectedShop);
  return getTryOnSettings(shop);
}
