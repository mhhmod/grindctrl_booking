import 'server-only';

import { currentUser } from '@clerk/nextjs/server';
import { getShopEntitlement } from '@/lib/try-on/entitlement';
import { getShopTimezone } from '@/lib/shopify/shop-timezone';
import type { SiteLocale } from '@/lib/landing/landing-i18n';
import { roleCan, type DashboardWorkspaceRole } from '@/lib/rbac/dashboard-policy';
import type { ActiveStore } from './active-store';
import { listDashboardShops, listDashboardSites } from './active-store-server';
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
  const shop = activeStore.shopDomain;
  // The looks meter is billing, so only the store's owner sees it (item 12).
  const meterShop = shop && roleCan(role, 'billing') ? shop : null;
  const [shops, sites, entitlement, timeZone, user] = await Promise.all([
    listDashboardShops().catch(() => []),
    listDashboardSites().catch(() => []),
    meterShop ? getShopEntitlement(meterShop).catch(() => null) : Promise.resolve(null),
    shop ? getShopTimezone(shop) : Promise.resolve(null),
    currentUser().catch(() => null),
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
