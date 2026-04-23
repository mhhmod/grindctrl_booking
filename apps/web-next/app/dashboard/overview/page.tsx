import { SiteSelector } from '@/components/dashboard/site-selector';
import { OverviewPageContent } from '@/components/dashboard/overview-page-content';
import { requireDashboardUser } from '@/lib/auth/dashboard';
import { listDomains } from '@/lib/adapters/domains';
import { listIntents } from '@/lib/adapters/intents';
import { listLeads } from '@/lib/adapters/leads';
import { getWorkspaceBundle } from '@/lib/adapters/workspace';
import { selectWidgetSite } from '@/lib/adapters/widgetSites';
import type { SearchParams } from '@/lib/types';

type Props = {
  searchParams?: Promise<SearchParams>;
};

async function resolveSearchParams(searchParams?: Promise<SearchParams>) {
  return (await searchParams) ?? {};
}

export default async function DashboardOverviewPage({ searchParams }: Props) {
  const params = await resolveSearchParams(searchParams);
  const clerkUserId = await requireDashboardUser('/dashboard/overview');
  const bundle = await getWorkspaceBundle(clerkUserId);

  if (!bundle.workspace) {
    return <div className="rounded-3xl border border-dashed border-zinc-700 bg-zinc-900 p-6 text-sm text-zinc-400">No workspace is connected to this Clerk user yet.</div>;
  }

  const site = selectWidgetSite(bundle.sites, params.site);
  const [domains, intents, leads] = site
    ? await Promise.all([
        listDomains(clerkUserId, site.id),
        listIntents(clerkUserId, site.id),
        listLeads(clerkUserId, bundle.workspace.id, site.id),
      ])
    : [[], [], []];

  return (
    <div className="grid gap-6">
      <div className="flex justify-end">
        <SiteSelector sites={bundle.sites} selectedSiteId={site?.id} />
      </div>
      <OverviewPageContent workspace={bundle.workspace} site={site} role={bundle.role} domains={domains} intents={intents} leads={leads} />
    </div>
  );
}
