import { DashboardSquare01Icon, MagicWand01Icon } from '@hugeicons/core-free-icons';
import type { IconGlyph } from '@/components/icons';
import { normalizeDashboardPathname } from '@/lib/dashboard/route-meta';
import { getDashboardCopy } from '@/lib/dashboard/dashboard-i18n';
import { DEFAULT_SITE_LOCALE, type SiteLocale } from '@/lib/landing/landing-i18n';
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

/**
 * The dashboard ships the product we actually sell: AI try-on, run as a
 * managed service. Overview answers "how is it doing", Try-On is the work.
 *
 * Acceptance criteria for adding a tab (all four, or it stays out):
 *  1. It maps to something a customer pays for, or that the owner must do
 *     weekly to run the service. Roadmap and demo surfaces do not qualify.
 *  2. It is backed by real data, not a preview or placeholder.
 *  3. It cannot live as a section of an existing tab. A new tab is a claim
 *     that the job is separate, not just that the page is long.
 *  4. It reads and writes the same source of truth as every other surface,
 *     so nothing can disagree with the Shopify admin.
 *
 * Routes for retired tabs still exist and are reachable by URL; they are
 * simply not advertised. Delete them once nothing references them.
 */
const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
  {
    href: '/dashboard/overview',
    label: 'Overview',
    icon: DashboardSquare01Icon,
    permissionKey: 'canViewOverview',
    group: 'core',
  },
  {
    href: '/dashboard/try-on',
    label: 'Try-On',
    icon: MagicWand01Icon,
    permissionKey: 'canViewAgents',
    group: 'core',
  },
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
  locale = DEFAULT_SITE_LOCALE,
}: {
  pathname: string;
  permissions: DashboardPermissionSet;
  locale?: SiteLocale;
}): DashboardResolvedNavItem[] {
  const normalizedPathname = normalizeDashboardPathname(pathname);
  const copy = getDashboardCopy(locale);

  return DASHBOARD_NAV_ITEMS.filter((item) => permissions[item.permissionKey]).map((item) => ({
    ...item,
    /* Nav labels come from the same per-route dictionary as the page title,
       so a tab and the page it opens can never disagree. */
    label: copy.routes[item.href]?.title ?? item.label,
    isActive: isDashboardNavItemActive(normalizedPathname, item.href),
  }));
}
