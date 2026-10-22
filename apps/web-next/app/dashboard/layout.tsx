import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { MantineUiProvider } from '@/components/mantine/provider';
import { resolveDashboardNavItems } from '@/lib/dashboard/nav-config';
import { requireDashboardUser } from '@/lib/auth/dashboard';
import { getRequestLocale } from '@/lib/auth/locale';
import { getDir } from '@/lib/landing/landing-i18n';
import { hasCompletedOnboarding } from '@/lib/onboarding/profile';
import { resolveDashboardPermissions } from '@/lib/rbac/dashboard-policy';
import { countAwaitingHandoff } from '@/lib/messenger/conversations';
import { listMessengerSiteIdsReadOnly } from '@/lib/messenger/provisioning';
import { getActiveStore, getActiveStoreRole } from '@/lib/dashboard/active-store-server';
import { getV16ShellData } from '@/lib/dashboard/shell-data';
import { storeFlags } from '@/lib/flags/store-flags';
import { V16Shell } from '@/components/dashboard/v16/v16-shell';
import { acceptInvitesForSignedIn } from '@/lib/team/accept';
import { listTeamMemberships } from '@/lib/rbac/store-role';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const headerList = await headers();
  const pathname = headerList.get('x-pathname') ?? '/dashboard';

  const clerkUserId = await requireDashboardUser(pathname);

  // Someone a team invited joins it on their first visit (N21).
  await acceptInvitesForSignedIn();

  /* Gate here rather than in middleware: this is a database read, and
     middleware runs on every asset-adjacent request. Layouts run once per
     navigation. hasCompletedOnboarding fails open if Supabase is down. A
     team member works on their team's stores, so the questions about a
     store of their own do not stand in their way. */
  if (!(await hasCompletedOnboarding(clerkUserId)) && (await listTeamMemberships(clerkUserId)).length === 0) {
    redirect('/onboarding');
  }

  /* Same gc-locale cookie the marketing site and storefront demo use, so a
     language chosen anywhere carries into the dashboard. */
  const locale = await getRequestLocale();
  /* The person's role on the active store decides the nav (item 12). Every
     page and action checks the same role again on the server. */
  const activeStore = await getActiveStore();
  const role = await getActiveStoreRole(activeStore);
  const permissions = resolveDashboardPermissions({ role });

  /* Cheap, read-only, indexed lookups; a failure must never take the shell
     down, so the whole thing falls back to no badge. Skipped entirely when
     the role can't see Store Chat, and listMessengerSiteIdsReadOnly (unlike
     listMessengerSites) never provisions a profile/workspace as a side
     effect of an unrelated page load — see its docstring. */
  let awaitingHandoff = 0;
  if (permissions.canViewStoreChat) {
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
  const flagStore = activeStore.shopDomain
    ? { shopDomain: activeStore.shopDomain }
    : activeStore.siteId
      ? { widgetSiteId: activeStore.siteId }
      : null;
  const features = flagStore ? await storeFlags(flagStore) : [];
  if (features.includes('v16_dashboard')) {
    const shell = await getV16ShellData({ activeStore, locale, role });
    return (
      <MantineUiProvider dir={getDir(locale)}>
        <div dir={getDir(locale)} lang={locale}>
          <V16Shell locale={locale} permissions={permissions} waitingCount={awaitingHandoff} {...shell}>
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
