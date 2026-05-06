import {
  ConversationIcon,
  DashboardSquare01Icon,
  Globe02Icon,
  MagicWand01Icon,
  Plug01Icon,
  Settings02Icon,
  UserGroupIcon,
  WorkflowSquare03Icon,
} from '@hugeicons/core-free-icons';
import type { IconGlyph } from '@/components/icons';
import { normalizeDashboardPathname } from '@/lib/dashboard/route-meta';
import type { DashboardPermissionKey, DashboardPermissionSet } from '@/lib/rbac/dashboard-policy';

export type DashboardNavItem = {
  href: string;
  label: string;
  icon: IconGlyph;
  permissionKey: DashboardPermissionKey;
  group?: 'core' | 'journey' | 'platform';
};

export type DashboardResolvedNavItem = DashboardNavItem & {
  isActive: boolean;
};

const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
  { href: '/dashboard/overview', label: 'Overview', icon: DashboardSquare01Icon, permissionKey: 'canViewOverview', group: 'core' },
  { href: '/dashboard/agents', label: 'AI Agents', icon: MagicWand01Icon, permissionKey: 'canViewAgents', group: 'core' },
  { href: '/dashboard/conversations', label: 'Conversations', icon: ConversationIcon, permissionKey: 'canViewConversations', group: 'core' },
  { href: '/dashboard/messages', label: 'Messages', icon: ConversationIcon, permissionKey: 'canViewMessages', group: 'core' },
  { href: '/dashboard/leads', label: 'Leads', icon: UserGroupIcon, permissionKey: 'canViewLeads', group: 'journey' },
  { href: '/dashboard/crm', label: 'CRM', icon: UserGroupIcon, permissionKey: 'canViewCrm', group: 'journey' },
  { href: '/dashboard/workflows', label: 'Workflows', icon: WorkflowSquare03Icon, permissionKey: 'canViewWorkflows', group: 'journey' },
  { href: '/dashboard/try-on', label: 'Try-On Agent', icon: MagicWand01Icon, permissionKey: 'canViewAgents', group: 'journey' },
  { href: '/dashboard/install', label: 'Widget / Embed', icon: Globe02Icon, permissionKey: 'canViewInstall', group: 'journey' },
  { href: '/dashboard/integrations', label: 'Integrations', icon: Plug01Icon, permissionKey: 'canViewIntegrations', group: 'platform' },
  { href: '/dashboard/analytics', label: 'Analytics', icon: DashboardSquare01Icon, permissionKey: 'canViewAnalytics', group: 'platform' },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings02Icon, permissionKey: 'canViewSettings', group: 'platform' },
  { href: '/dashboard/implementation', label: 'Implementation', icon: WorkflowSquare03Icon, permissionKey: 'canViewImplementation', group: 'platform' },
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
