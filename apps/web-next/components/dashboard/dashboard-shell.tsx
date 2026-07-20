import React from 'react';
import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import { BrandLogo } from '@/components/brand-logo';
import { ThemeToggle } from '@/components/dashboard/theme-toggle';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { DashboardSidebarNav } from '@/components/dashboard/nav-link';
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
            <BrandLogo size="sm" subtitle="Operations Platform" />
          </Link>
        </SidebarHeader>

        <Separator />

        <SidebarContent className="p-2">
          <DashboardSidebarNav navItems={navItems} />
        </SidebarContent>
      </Sidebar>

      <SidebarInset className="min-w-0 bg-muted/40">
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

        <main className="min-w-0 min-h-[calc(100svh-3.5rem)]">
          <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-4 p-4">
            <div className="space-y-1 md:hidden">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            <div className="min-w-0">{children}</div>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
