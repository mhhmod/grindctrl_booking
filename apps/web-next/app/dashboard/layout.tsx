import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { resolveDashboardNavItems } from '@/lib/dashboard/nav-config';
import { getDashboardRouteMeta } from '@/lib/dashboard/route-meta';
import { getWorkspaceBundle } from '@/lib/adapters/workspace';
import { requireDashboardUser } from '@/lib/auth/dashboard';
import { getRequestLocale } from '@/lib/auth/locale';
import { getDir } from '@/lib/landing/landing-i18n';
import { hasCompletedOnboarding } from '@/lib/onboarding/profile';
import { resolveDashboardPermissions } from '@/lib/rbac/dashboard-policy';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const headerList = await headers();
  const pathname = headerList.get('x-pathname') ?? '/dashboard/overview';

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
  const routeMeta = getDashboardRouteMeta(pathname, locale);
  const permissions = resolveDashboardPermissions({ role: workspaceBundle.role });
  const navItems = resolveDashboardNavItems({ pathname, permissions, locale });

  return (
    <div dir={getDir(locale)} lang={locale}>
      <DashboardShell
        locale={locale}
        navItems={navItems}
        breadcrumbs={routeMeta.breadcrumbs}
        title={routeMeta.title}
        description={routeMeta.description}
      >
        {children}
      </DashboardShell>
    </div>
  );
}
