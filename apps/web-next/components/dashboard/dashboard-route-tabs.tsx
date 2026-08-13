'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/icons';
import { cn } from '@/lib/utils';
import { isDashboardNavItemActive, type DashboardResolvedNavItem } from '@/lib/dashboard/nav-config';
import { normalizeDashboardPathname } from '@/lib/dashboard/route-meta';

export function DashboardRouteTabs({ items }: { items: DashboardResolvedNavItem[] }) {
  /* Live pathname, not item.isActive — see lib/dashboard/use-route-meta.ts
     for why a value resolved once by the server layout goes stale across
     client-side navigation between routes that share it. This component is
     currently unused, but item.isActive carries the identical bug that
     dashboard-shell.tsx and nav-link.tsx had, so it would resurface the
     moment someone wires this in. */
  const pathname = normalizeDashboardPathname(usePathname() ?? '');

  if (items.length <= 1) {
    return null;
  }

  return (
    <nav aria-label="Dashboard sections" className="-mx-3 overflow-x-auto px-3 pb-1 sm:-mx-5 sm:px-5">
      <ul className="flex w-max min-w-full items-center gap-2">
        {items.map((item) => {
          const isActive = isDashboardNavItemActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm whitespace-nowrap transition-colors',
                  isActive
                    ? 'border-border bg-card text-foreground'
                    : 'border-transparent bg-muted/40 text-muted-foreground hover:border-border/60 hover:text-foreground',
                )}
              >
                <Icon icon={item.icon} className="size-4" />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
