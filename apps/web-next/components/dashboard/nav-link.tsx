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

export function DashboardSidebarNav({
  navItems,
}: {
  navItems: DashboardResolvedNavItem[];
}) {
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
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </React.Fragment>
        );
      })}
    </SidebarMenu>
  );
}
