import Link from 'next/link';
import { Icon } from '@/components/icons';
import { cn } from '@/lib/utils';
import type { DashboardResolvedNavItem } from '@/lib/dashboard/nav-config';

export function DashboardRouteTabs({ items }: { items: DashboardResolvedNavItem[] }) {
  if (items.length <= 1) {
    return null;
  }

  return (
    <nav aria-label="Dashboard sections" className="-mx-3 overflow-x-auto px-3 pb-1 sm:-mx-5 sm:px-5">
      <ul className="flex w-max min-w-full items-center gap-2">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={item.isActive ? 'page' : undefined}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm whitespace-nowrap transition-colors',
                item.isActive
                  ? 'border-border bg-card text-foreground'
                  : 'border-transparent bg-muted/40 text-muted-foreground hover:border-border/60 hover:text-foreground',
              )}
            >
              <Icon icon={item.icon} className="size-4" />
              <span>{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
