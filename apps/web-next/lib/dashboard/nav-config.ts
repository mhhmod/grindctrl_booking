import {
  DashboardSquare01Icon,
  Download01Icon,
  Globe02Icon,
  MagicWand01Icon,
  Palette,
  UserGroupIcon,
} from '@hugeicons/core-free-icons';
import type { IconGlyph } from '@/components/icons';
import { normalizeDashboardPathname } from '@/lib/dashboard/route-meta';
import type { DashboardPermissionKey, DashboardPermissionSet } from '@/lib/rbac/dashboard-policy';

export type DashboardNavItem = {
  href: string;
  label: string;
  icon: IconGlyph;
  permissionKey: DashboardPermissionKey;
};

export type DashboardResolvedNavItem = DashboardNavItem & {
  isActive: boolean;
};

const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
  { href: '/dashboard/overview', label: 'Overview', icon: DashboardSquare01Icon, permissionKey: 'canViewOverview' },
  { href: '/dashboard/install', label: 'Install Widget', icon: Download01Icon, permissionKey: 'canViewInstall' },
  { href: '/dashboard/branding', label: 'Branding', icon: Palette, permissionKey: 'canViewBranding' },
  { href: '/dashboard/intents', label: 'Intents', icon: MagicWand01Icon, permissionKey: 'canViewIntents' },
  { href: '/dashboard/domains', label: 'Domains', icon: Globe02Icon, permissionKey: 'canViewDomains' },
  { href: '/dashboard/leads', label: 'Leads', icon: UserGroupIcon, permissionKey: 'canViewLeads' },
];

function isDashboardNavItemActive(pathname: string, itemHref: string) {
  if (pathname === '/dashboard' && itemHref === '/dashboard/overview') {
    return true;
  }

  return pathname === itemHref || pathname.startsWith(`${itemHref}/`);
}

export function resolveDashboardNavItems({
  pathname,
  permissions,
}: {
  pathname: string;
  permissions: DashboardPermissionSet;
}): DashboardResolvedNavItem[] {
  const normalizedPathname = normalizeDashboardPathname(pathname);

  return DASHBOARD_NAV_ITEMS.filter((item) => permissions[item.permissionKey]).map((item) => ({
    ...item,
    isActive: isDashboardNavItemActive(normalizedPathname, item.href),
  }));
}
