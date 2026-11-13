import 'server-only';

import { getRequestUser } from '@/lib/auth/site-viewer-server';
import { getShopEntitlement } from '@/lib/try-on/entitlement';
import type { SiteLocale } from '@/lib/landing/landing-i18n';
import { roleCan, type DashboardWorkspaceRole } from '@/lib/rbac/dashboard-policy';
import { activeTenantKey, type ActiveStore } from './active-store';
import { listDashboardShops, listDashboardSites } from './active-store-server';
import { getShopTimezone } from '@/lib/shopify/shop-timezone';
import { getActiveWooSiteContext } from '@/lib/woo/connection';
import { getShellCopy } from './shell-copy';
import { buildShellStores, looksMeterView, shellRole, todayHeading } from './shell-model';

/* Everything the v16 shell needs, read once per full page load by the
   dashboard layout. Every read is optional: a store list, meter or name
   that cannot be read is left out, never shown as a guess. */
export async function getV16ShellData({
  activeStore,
  locale,
  role,
  now = new Date(),
}: {
  activeStore: ActiveStore;
  locale: SiteLocale;
  role: DashboardWorkspaceRole;
  now?: Date;
}) {
  const copy = getShellCopy(locale);
  const tenant = activeTenantKey(activeStore);
  // The looks meter is billing, so only the store's owner sees it (item 12).
  const meterShop = tenant && roleCan(role, 'billing') ? tenant : null;
  const [shops, sites, entitlement, timeZone, user] = await Promise.all([
    listDashboardShops().catch(() => []),
    listDashboardSites().catch(() => []),
    meterShop ? getShopEntitlement(meterShop).catch(() => null) : Promise.resolve(null),
    activeStore.shopDomain
      ? getShopTimezone(activeStore.shopDomain)
      : activeStore.platform === 'woocommerce' && activeStore.siteId
        ? getActiveWooSiteContext(activeStore.siteId).then((context) => context?.timezone ?? null, () => null)
        : Promise.resolve(null),
    getRequestUser().catch(() => null),
  ]);

  const firstName = user?.firstName?.trim() || null;
  const fullName = [user?.firstName, user?.lastName].map((part) => part?.trim()).filter(Boolean).join(' ');
  const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress ?? '';

  return {
    stores: buildShellStores(shops, sites, activeStore),
    meter: looksMeterView(entitlement, copy),
    person: { name: fullName || email, role: shellRole(role) },
    today: todayHeading(now, timeZone, locale, firstName, copy),
  };
}
