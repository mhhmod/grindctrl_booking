import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import { Icon } from '@/components/icons';
import { ThemeToggle } from '@/components/dashboard/theme-toggle';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
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
  children,
}: {
  navItems: DashboardResolvedNavItem[];
  breadcrumbs: DashboardBreadcrumbItem[];
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
      <SidebarProvider defaultOpen>
        <Sidebar>
        <SidebarHeader className="p-2">
          <Link href="/" className="flex h-10 items-center gap-2 rounded-lg px-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
            <span className="grid size-8 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground text-sm font-semibold">
              G
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold leading-5">GRINDCTRL</div>
              <div className="truncate text-xs text-muted-foreground">Dashboard</div>
            </div>
          </Link>
        </SidebarHeader>

        <Separator />

        <SidebarContent className="p-2">
          <SidebarMenu>
            {navItems.map((item) => {
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={item.isActive} size="sm">
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
      </Sidebar>

      <SidebarInset className="min-w-0 overflow-x-hidden bg-muted/40">
        <header className="sticky top-0 z-50 w-full border-b border-sidebar-border bg-background">
          <div className="container flex h-14 items-center justify-between gap-4 px-4">
            <div className="flex min-w-0 items-center gap-3">
              <SidebarTrigger variant="ghost" size="icon-sm" aria-label="Toggle dashboard navigation" />
              <div className="min-w-0">
                <nav aria-label="Breadcrumb" className="min-w-0">
                  <ol className="flex min-w-0 flex-wrap items-center gap-1 text-xs text-muted-foreground">
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
                <div className="truncate text-sm font-semibold leading-5 text-foreground">{title}</div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <ThemeToggle />
              <UserButton afterSignOutUrl="/" />
            </div>
          </div>
        </header>

        <main className="min-h-[calc(100svh-3.5rem)]">
          <div className="container grid gap-4 p-4">
            <div className="space-y-1 md:hidden">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
