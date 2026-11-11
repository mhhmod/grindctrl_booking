import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { MantineUiProvider } from '@/components/mantine/provider';
import { requireDashboardUser } from '@/lib/auth/dashboard';
import { getRequestLocale } from '@/lib/auth/locale';
import { rememberDashboardLocale } from '@/lib/auth/dashboard-locale';
import { getDir } from '@/lib/landing/landing-i18n';
import { hasCompletedOnboarding } from '@/lib/onboarding/profile';
import { resolveDashboardPermissions } from '@/lib/rbac/dashboard-policy';
import { countAwaitingHandoff } from '@/lib/messenger/conversations';
import { listMessengerSiteIdsReadOnly } from '@/lib/messenger/provisioning';
import { ensureActiveStorePlan, getActiveStore, getActiveStoreRole, storeLookupFailed } from '@/lib/dashboard/active-store-server';
import { activeTenantKey } from '@/lib/dashboard/active-store';
import { getV16ShellData } from '@/lib/dashboard/shell-data';
import { V16Shell } from '@/components/dashboard/v16/v16-shell';
import { V16StoreLookupFailed } from '@/components/dashboard/v16/states';
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
  await rememberDashboardLocale(clerkUserId, locale);
  /* The person's role on the active store decides the nav (item 12). Every
     page and action checks the same role again on the server. */
  const activeStore = await getActiveStore();
  const role = await getActiveStoreRole(activeStore);
  // A paired WooCommerce store with a verified domain gets its free plan on first open.
  await ensureActiveStorePlan(activeStore);
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

  /* One shell for everyone. A person with no store yet gets the same shell
     and a page that says how to connect one; stores that could not be read
     get a retry in place of the page, never the empty-account screens. */
  const [shell, lookupFailed] = await Promise.all([
    getV16ShellData({ activeStore, locale, role }),
    storeLookupFailed(),
  ]);
  return (
    <MantineUiProvider dir={getDir(locale)}>
      <div dir={getDir(locale)} lang={locale}>
        <V16Shell
          locale={locale}
          permissions={permissions}
          hasTenant={Boolean(activeTenantKey(activeStore))}
          waitingCount={awaitingHandoff}
          {...shell}
        >
          {lookupFailed ? <V16StoreLookupFailed locale={locale} /> : children}
        </V16Shell>
      </div>
    </MantineUiProvider>
  );
}
