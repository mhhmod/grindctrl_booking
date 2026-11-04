import 'server-only';

import { auth } from '@clerk/nextjs/server';
import { listMessengerSitesReadOnly } from '@/lib/messenger/provisioning';
import { RoleNotAllowedError, roleCan, type DashboardCapability } from '@/lib/rbac/dashboard-policy';
import { requireManagedTryOnShop } from '@/lib/shopify/shops';
import { isActiveTenant } from '@/lib/shopify/tokens';
import { isSiteTenantKey, normalizeTenantKey } from './tenant-key';

/** requireManagedTryOnShop for either tenant namespace. A Shopify shop goes
 *  through the shop check unchanged. A `site:<uuid>` key is authorized only
 *  for a Store Chat site the caller owns or has a team role on, whose
 *  WooCommerce connection is active, and only for roles that can do
 *  `capability`. Every failure reads like an unowned shop. */
export async function requireManagedTenant(
  selected: unknown,
  options: { allowGlobalDefault?: boolean; capability?: DashboardCapability } = {},
): Promise<string> {
  const key = normalizeTenantKey(selected);
  if (!key || !isSiteTenantKey(key)) return requireManagedTryOnShop(selected, options);

  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');
  const siteId = key.slice('site:'.length);
  const sites = await listMessengerSitesReadOnly(userId);
  const site = sites.find((candidate) => candidate.id.toLowerCase() === siteId);
  if (!site || !(await isActiveTenant(key))) throw new Error('Unknown Shopify shop');
  if (options.capability && !roleCan(site.role, options.capability)) {
    throw new RoleNotAllowedError(options.capability);
  }
  return key;
}
