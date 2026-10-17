import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { MantineUiProvider } from '@/components/mantine/provider';
import { resolveDashboardNavItems } from '@/lib/dashboard/nav-config';
import { getWorkspaceBundle } from '@/lib/adapters/workspace';
import { requireDashboardUser } from '@/lib/auth/dashboard';
import { getRequestLocale } from '@/lib/auth/locale';
import { getDir } from '@/lib/landing/landing-i18n';
import { hasCompletedOnboarding } from '@/lib/onboarding/profile';
import { resolveDashboardPermissions } from '@/lib/rbac/dashboard-policy';
import { countAwaitingHandoff } from '@/lib/messenger/conversations';
import { listMessengerSiteIdsReadOnly } from '@/lib/messenger/provisioning';
import { getActiveStore } from '@/lib/dashboard/active-store-server';
import { getV16ShellData } from '@/lib/dashboard/shell-data';
import { storeFlags } from '@/lib/flags/store-flags';
import { V16Shell } from '@/components/dashboard/v16/v16-shell';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const headerList = await headers();
  const pathname = headerList.get('x-pathname') ?? '/dashboard';

  const clerkUserId = await requireDashboardUser(pathname);

  /* Gate here rather than in middleware: this is a database read, and
     middleware runs on every asset-adjacent request. Layouts run once per
     navigation. hasCompletedOnboarding fails open if Supabase is down. */
  if (!(await hasCompletedOnboarding(clerkUserId))) {
    redirect('/onboarding');
  }

  const workspaceBundle = await getWorkspaceBundle(clerkUserId);
  /* Same gc-locale cookie the marketing site and storefront demo use, so a
     language chosen anywhere carries into the dashboard. */
  const locale = await getRequestLocale();
  const permissions = resolveDashboardPermissions({ role: workspaceBundle.role });

  /* Cheap, read-only, indexed lookups; a failure must never take the shell
     down, so the whole thing falls back to no badge. Skipped entirely when
     the role can't see Store Chat, and listMessengerSiteIdsReadOnly (unlike
     listMessengerSites) never provisions a profile/workspace as a side
     effect of an unrelated page load — see its docstring. */
  let awaitingHandoff = 0;
  if (permissions.canViewMessenger) {
    try {
      const siteIds = await listMessengerSiteIdsReadOnly(clerkUserId);
      awaitingHandoff = await countAwaitingHandoff(siteIds);
    } catch {
      awaitingHandoff = 0;
    }
  }

  /* The v16 shell, only while the active store's v16_dashboard flag is on,
     so the owner can switch it on for the demo store first. Every other
     store keeps today's shell. */
  const activeStore = await getActiveStore();
  const flagStore = activeStore.shopDomain
    ? { shopDomain: activeStore.shopDomain }
    : activeStore.siteId
      ? { widgetSiteId: activeStore.siteId }
      : null;
  const features = flagStore ? await storeFlags(flagStore) : [];
  if (features.includes('v16_dashboard')) {
    const shell = await getV16ShellData({ activeStore, locale, role: workspaceBundle.role });
    return (
      <MantineUiProvider dir={getDir(locale)}>
        <div dir={getDir(locale)} lang={locale}>
          <V16Shell locale={locale} waitingCount={awaitingHandoff} {...shell}>
            {children}
          </V16Shell>
        </div>
      </MantineUiProvider>
    );
  }

  const navItems = resolveDashboardNavItems({
    pathname,
    permissions,
    locale,
    badges: { '/dashboard/store-chat': awaitingHandoff },
  });

  return (
    <MantineUiProvider dir={getDir(locale)}>
      <div dir={getDir(locale)} lang={locale}>
        <DashboardShell locale={locale} navItems={navItems}>
          {children}
        </DashboardShell>
      </div>
    </MantineUiProvider>
  );
}
