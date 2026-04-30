import {
  DashboardSquare01Icon,
  MagicWand01Icon,
  UserGroupIcon,
  ConversationIcon,
  WorkflowSquare03Icon,
  Plug01Icon,
  Settings02Icon,
  Globe02Icon,
} from '@hugeicons/core-free-icons';
import type { IconGlyph } from '@/components/icons';
import { normalizeDashboardPathname } from '@/lib/dashboard/route-meta';
import type { DashboardPermissionKey, DashboardPermissionSet } from '@/lib/rbac/dashboard-policy';

export type DashboardNavItem = {
  href: string;
  label: string;
  icon: IconGlyph;
  permissionKey: DashboardPermissionKey;
  /** Optional grouping hint for visual separators in the sidebar. */
  group?: 'core' | 'widgets' | 'platform';
};

export type DashboardResolvedNavItem = DashboardNavItem & {
  isActive: boolean;
};

const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
  // ── Core ──
  { href: '/dashboard/overview', label: 'Overview', icon: DashboardSquare01Icon, permissionKey: 'canViewOverview', group: 'core' },
  { href: '/dashboard/inbox', label: 'Inbox', icon: ConversationIcon, permissionKey: 'canViewConversations', group: 'core' },
  { href: '/dashboard/leads', label: 'Leads', icon: UserGroupIcon, permissionKey: 'canViewLeads', group: 'core' },

  // ── Widget operations ──
  { href: '/dashboard/sites', label: 'Sites', icon: Globe02Icon, permissionKey: 'canViewInstall', group: 'widgets' },
  { href: '/dashboard/routing', label: 'Routing', icon: MagicWand01Icon, permissionKey: 'canViewIntents', group: 'widgets' },

  // ── Platform ──
  { href: '/dashboard/workflows', label: 'Workflows', icon: WorkflowSquare03Icon, permissionKey: 'canViewWorkflows', group: 'platform' },
  { href: '/dashboard/integrations', label: 'Integrations', icon: Plug01Icon, permissionKey: 'canViewIntegrations', group: 'platform' },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings02Icon, permissionKey: 'canViewSettings', group: 'platform' },
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
