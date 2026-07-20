'use client';

import * as React from 'react';
import Link from 'next/link';
import { Icon } from '@/components/icons';
import { Separator } from '@/components/ui/separator';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import type { DashboardResolvedNavItem } from '@/lib/dashboard/nav-config';

export function DashboardSidebarNav({
  navItems,
}: {
  navItems: DashboardResolvedNavItem[];
}) {
  const { isMobile, setOpenMobile } = useSidebar();

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
                isActive={item.isActive}
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
