import { currentUser } from '@clerk/nextjs/server';
import { headers } from 'next/headers';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { requireDashboardUser } from '@/lib/auth/dashboard';

function titleFromPathname(pathname: string) {
  if (pathname.endsWith('/install')) return 'Install Widget';
  if (pathname.endsWith('/branding')) return 'Branding';
  if (pathname.endsWith('/intents')) return 'Intents';
  if (pathname.endsWith('/domains')) return 'Domains';
  if (pathname.endsWith('/leads')) return 'Leads';
  return 'Overview';
}

function descriptionFromPathname(pathname: string) {
  if (pathname.endsWith('/install')) return 'Use the canonical GRINDCTRL install contract and the selected site embed key.';
  if (pathname.endsWith('/branding')) return 'Inspect the active branding subset stored inside settings_json.';
  if (pathname.endsWith('/intents')) return 'Review current widget intents from the existing dashboard RPC contract.';
  if (pathname.endsWith('/domains')) return 'Review allowed domains for the selected widget site.';
  if (pathname.endsWith('/leads')) return 'Review captured leads from the current backend-controlled submission flow.';
  return 'Real workspace and site data, without fake dashboard analytics.';
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const headerList = await headers();
  const pathname = headerList.get('x-pathname') ?? '/dashboard/overview';

  await requireDashboardUser(pathname);
  const user = await currentUser();

  return (
    <DashboardShell
      currentPath={pathname}
      title={titleFromPathname(pathname)}
      description={descriptionFromPathname(pathname)}
      userEmail={user?.primaryEmailAddress?.emailAddress ?? 'Authenticated user'}
    >
      {children}
    </DashboardShell>
  );
}
