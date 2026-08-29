'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/icons';
import { Separator } from '@/components/ui/separator';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { isDashboardNavItemActive, type DashboardResolvedNavItem } from '@/lib/dashboard/nav-config';
import { normalizeDashboardPathname } from '@/lib/dashboard/route-meta';
import { getDashboardCopy } from '@/lib/dashboard/dashboard-i18n';
import { DEFAULT_SITE_LOCALE, type SiteLocale } from '@/lib/landing/landing-i18n';

export function DashboardSidebarNav({
  navItems,
  locale = DEFAULT_SITE_LOCALE,
}: {
  navItems: DashboardResolvedNavItem[];
  locale?: SiteLocale;
}) {
  const copy = getDashboardCopy(locale);
  const { isMobile, setOpenMobile } = useSidebar();
  /* Live pathname, not item.isActive (resolved once by the server layout —
     see lib/dashboard/use-route-meta.ts for why that goes stale). */
  const pathname = normalizeDashboardPathname(usePathname() ?? '');

  return (
    <SidebarMenu>
      {navItems.map((item, index) => {
        const prevGroup = index > 0 ? navItems[index - 1].group : undefined;
        const showSeparator = item.group && prevGroup && item.group !== prevGroup;

        return (
          <React.Fragment key={item.href}>
            {showSeparator && <Separator className="my-1" />}
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isDashboardNavItemActive(pathname, item.href)}
                size="sm"
                className="h-11 md:h-8"
              >
                <Link
                  href={item.href}
                  onClick={() => {
                    if (isMobile) setOpenMobile(false);
                  }}
                >
                  <Icon icon={item.icon} />
                  <span>{item.label}</span>
                  {item.badgeCount ? (
                    <span
                      className="ms-auto inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-semibold text-primary-foreground"
                      aria-label={copy.navBadgeWaiting(item.badgeCount)}
                    >
                      {item.badgeCount > 9 ? '9+' : item.badgeCount}
                    </span>
                  ) : null}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </React.Fragment>
        );
      })}
    </SidebarMenu>
  );
}
