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

/* Store Chat is the only nav item with a live waiting count today, so the
   refresh below is scoped to it rather than to nav badges in general. */
const STORE_CHAT_HREF = '/dashboard/messenger';

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

  const hasStoreChat = navItems.some((item) => item.href === STORE_CHAT_HREF);
  const initialWaiting = navItems.find((item) => item.href === STORE_CHAT_HREF)?.badgeCount ?? 0;
  /* Seeded from the server-rendered count so there's no flash of a missing
     badge, then kept fresh client-side: app/dashboard/layout.tsx computes
     this once per full page load, and Next.js reuses that layout's server
     render across client-side navigation between routes sharing it (same
     reason isActive/breadcrumbs moved to usePathname() — see
     lib/dashboard/use-route-meta.ts) — so without this a merchant who clears
     the queue, or gets a new handoff mid-session, sees a stale number for
     the rest of the visit. */
  const [waitingCount, setWaitingCount] = React.useState(initialWaiting);

  /* Same request-sequence guard as components/dashboard/messenger/
     conversations-panel.tsx: a slower earlier fetch must not clobber a
     newer one's result. */
  const loadSeq = React.useRef(0);

  React.useEffect(() => {
    if (!hasStoreChat) return;
    const seq = (loadSeq.current += 1);
    fetch('/api/dashboard/store-chat-waiting')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { count?: number } | null) => {
        if (seq !== loadSeq.current) return;
        if (typeof data?.count === 'number') setWaitingCount(data.count);
      })
      .catch(() => {
        // A badge must never break the shell.
      });
  }, [pathname, hasStoreChat]);

  return (
    <SidebarMenu>
      {navItems.map((item, index) => {
        const prevGroup = index > 0 ? navItems[index - 1].group : undefined;
        const showSeparator = item.group && prevGroup && item.group !== prevGroup;
        const badgeCount = item.href === STORE_CHAT_HREF ? waitingCount : item.badgeCount;

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
                  {/* min-w-0 so this can actually shrink inside the flex row;
                      truncate explicit because [&>span:last-child]:truncate
                      on the button only guards whichever span is LAST — the
                      waiting badge below, when present, takes that spot. */}
                  <span className="min-w-0 truncate">{item.label}</span>
                  {badgeCount ? (
                    <span
                      role="status"
                      className="ms-auto inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-semibold text-primary-foreground"
                      aria-label={copy.navBadgeWaiting(badgeCount)}
                    >
                      {badgeCount > 9 ? '9+' : badgeCount}
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
