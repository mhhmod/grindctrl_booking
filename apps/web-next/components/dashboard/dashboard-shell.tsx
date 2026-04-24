import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import { Icon } from '@/components/icons';
import { DashboardRouteTabs } from '@/components/dashboard/dashboard-route-tabs';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import type { DashboardResolvedNavItem } from '@/lib/dashboard/nav-config';
import type { DashboardBreadcrumbItem } from '@/lib/dashboard/route-meta';

export function DashboardShell({
  navItems,
  breadcrumbs,
  title,
  description,
  userEmail,
  children,
}: {
  navItems: DashboardResolvedNavItem[];
  breadcrumbs: DashboardBreadcrumbItem[];
  title: string;
  description: string;
  userEmail: string;
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider defaultOpen>
      <Sidebar>
        <SidebarHeader className="px-3 py-3">
          <Link href="/" className="flex items-center gap-3 rounded-lg px-2 py-2 text-sidebar-foreground">
            <span className="grid size-9 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground text-sm font-semibold">
              G
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold leading-5">GRINDCTRL</div>
              <div className="truncate text-xs text-muted-foreground">Dashboard</div>
            </div>
          </Link>
        </SidebarHeader>

        <Separator />

        <SidebarContent className="px-2 py-3">
          <SidebarMenu>
            {navItems.map((item) => {
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={item.isActive}>
                    <Link href={item.href}>
                      <Icon icon={item.icon} />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarContent>

        <Separator />

        <SidebarFooter className="px-3 py-3">
          <div className="rounded-lg border bg-card px-3 py-3">
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Signed in</div>
            <div className="mt-2 break-all text-sm text-card-foreground">{userEmail}</div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Clerk session</span>
              <UserButton afterSignOutUrl="/" />
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-10 lg:py-8">
          <header className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <SidebarTrigger variant="outline" size="icon-sm" className="md:hidden" aria-label="Open dashboard navigation" />
              <nav aria-label="Breadcrumb" className="min-w-0">
                <ol className="flex min-w-0 flex-wrap items-center gap-1 text-xs text-muted-foreground sm:text-sm">
                  {breadcrumbs.map((crumb, index) => {
                    const isLast = index === breadcrumbs.length - 1;

                    return (
                      <li key={`${crumb.label}-${index}`} className="inline-flex min-w-0 items-center gap-1">
                        {index > 0 ? <span aria-hidden="true" className="text-muted-foreground/60">/</span> : null}
                        {crumb.href && !isLast ? (
                          <Link href={crumb.href} className="truncate hover:text-foreground">
                            {crumb.label}
                          </Link>
                        ) : (
                          <span aria-current={isLast ? 'page' : undefined} className="truncate text-foreground">
                            {crumb.label}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </nav>
            </div>

            <div className="flex items-start gap-3 sm:items-center">
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
              </div>
            </div>

            <DashboardRouteTabs items={navItems} />
            <Separator />
          </header>

          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
