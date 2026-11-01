import 'server-only';

import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { getTryOnSettings, type TryOnSettings } from '@/lib/try-on/settings';
import {
  authorizeDashboardShop,
  normalizeShopDomain,
} from './shop-authorization';
import { withoutTestLooks } from '@/lib/try-on/test-looks';
import { RoleNotAllowedError, roleCan, type DashboardCapability, type DashboardWorkspaceRole } from '@/lib/rbac/dashboard-policy';
import { listTeamMemberships, shopRoleFor, teamOwnerIds } from '@/lib/rbac/store-role';

export type TryOnShopStatus = 'installed' | 'uninstalled';

export type ManagedTryOnShop = {
  domain: string;
  status: TryOnShopStatus;
  installedAt: string;
  uninstalledAt: string | null;
  lastSeenAt: string;
  jobCount: number;
  lastJobAt: string | null;
  /** The caller's role on this shop: its owner, or their role on its team. */
  role: DashboardWorkspaceRole;
};

type ShopRow = {
  shop_domain: string;
  owner_clerk_user_id: string | null;
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

async function requireDashboardOwner(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');
  return userId;
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

    if (!current || current.status !== 'installed') return false;
    const { error } = await supabase.from('tryon_shops')
      .update({ last_seen_at: now, updated_at: now }).eq('shop_domain', domain).eq('status', 'installed');
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('tryon_shops seen update failed:', error instanceof Error ? error.message : error);
    return false;
  }
}

/** The global 'default' settings row is internal platform configuration, not a
 *  shop: lib/try-on/settings.ts merges it UNDERNEATH every merchant's own row,
 *  so whoever writes it changes the inherited baseline for every other tenant.
 *  Being signed in is authority over your OWN shops, never over that baseline,
 *  so 'default' is refused unless a caller opts in — and only read paths
 *  (the plan catalog, the neutral no-shop plan state) ever do. Defaulting to
 *  refusal means a future caller is safe unless it deliberately says otherwise.
 *  Writes must never opt in; see the matching guard in saveTryOnSettings. */
export async function requireManagedTryOnShop(
  selectedShop: unknown,
  options: {
    allowGlobalDefault?: boolean;
    /** What the caller is about to do. Omitted, any role on the shop's team
     *  may read it; every write names what it needs (see dashboard-policy.ts). */
    capability?: DashboardCapability;
  } = {},
): Promise<string> {
  return (await requireTryOnShopAccess(selectedShop, options)).domain;
}

/** requireManagedTryOnShop, also answering the caller's role on the shop. */
export async function requireTryOnShopAccess(
  selectedShop: unknown,
  options: { allowGlobalDefault?: boolean; capability?: DashboardCapability } = {},
): Promise<{ domain: string; role: DashboardWorkspaceRole | null }> {
  const clerkUserId = await requireDashboardOwner();
  if (selectedShop === 'default') {
    // Same message as an unowned domain below: a merchant has no need to learn
    // that a privileged internal row exists. Only read paths opt in, and the
    // row has no team, so it carries no role.
    if (!options.allowGlobalDefault) throw new Error('Unknown Shopify shop');
    return { domain: 'default', role: null };
  }

  const domain = normalizeShopDomain(selectedShop);
  if (!domain) throw new Error('Unknown Shopify shop');

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('tryon_shops')
    .select('shop_domain')
    .eq('shop_domain', domain)
    .eq('status', 'installed')
    .eq('owner_clerk_user_id', clerkUserId)
    .maybeSingle();

  if (error) throw new Error(`Shop authorization failed: ${error.message}`);
  let role: DashboardWorkspaceRole | null = data ? 'owner' : null;
  let found = data ? [data.shop_domain as string] : [];

  /* Not the owner: the shop may belong to an account whose team the caller
     is on (item 12). The lookup is scoped to exactly those accounts. */
  if (!data) {
    const memberships = await listTeamMemberships(clerkUserId);
    const owners = teamOwnerIds(memberships);
    if (owners.length > 0) {
      const team = await supabase
        .from('tryon_shops')
        .select('shop_domain, owner_clerk_user_id')
        .eq('shop_domain', domain)
        .eq('status', 'installed')
        .in('owner_clerk_user_id', owners)
        .maybeSingle();
      if (team.error) throw new Error(`Shop authorization failed: ${team.error.message}`);
      const row = team.data as { shop_domain: string; owner_clerk_user_id: string | null } | null;
      role = row ? shopRoleFor(clerkUserId, row.owner_clerk_user_id, memberships) : null;
      found = row && role ? [row.shop_domain] : [];
    }
  }

  const authorized = authorizeDashboardShop(domain, found);
  if (options.capability && !roleCan(role, options.capability)) {
    throw new RoleNotAllowedError(options.capability);
  }
  return { domain: authorized, role };
}

export async function listManagedTryOnShops(): Promise<ManagedTryOnShop[]> {
  const clerkUserId = await requireDashboardOwner();

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('tryon_shops')
    .select('shop_domain, owner_clerk_user_id, status, installed_at, uninstalled_at, last_seen_at')
    .eq('owner_clerk_user_id', clerkUserId)
    .order('last_seen_at', { ascending: false });

  if (error) throw new Error(`Unable to list Shopify shops: ${error.message}`);

  /* Then the shops of every account whose team the caller is on (item 12),
     after their own. */
  const memberships = await listTeamMemberships(clerkUserId);
  const owners = teamOwnerIds(memberships);
  let teamRows: ShopRow[] = [];
  if (owners.length > 0) {
    const team = await supabase
      .from('tryon_shops')
      .select('shop_domain, owner_clerk_user_id, status, installed_at, uninstalled_at, last_seen_at')
      .in('owner_clerk_user_id', owners)
      .order('last_seen_at', { ascending: false });
    if (team.error) throw new Error(`Unable to list Shopify shops: ${team.error.message}`);
    teamRows = (team.data ?? []) as ShopRow[];
  }

  const rows = [
    ...((data ?? []) as ShopRow[]).map((shop) => ({ shop, role: 'owner' as const })),
    ...teamRows.flatMap((shop) => {
      const role = shopRoleFor(clerkUserId, shop.owner_clerk_user_id, memberships);
      return role ? [{ shop, role }] : [];
    }),
  ];

  return Promise.all(
    rows.map(async ({ shop, role }) => {
      // The owner's test looks do not count as the shop's looks.
      const { data: jobs, count, error: jobsError } = await withoutTestLooks((excludeTestLooks) => {
        const query = supabase
          .from('tryon_jobs')
          .select('created_at', { count: 'exact' })
          .eq('shop', shop.shop_domain);
        return (excludeTestLooks ? query.eq('is_test', false) : query)
          .order('created_at', { ascending: false })
          .limit(1);
      });

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
        role,
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
