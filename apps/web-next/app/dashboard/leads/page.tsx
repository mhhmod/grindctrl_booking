import { SiteSelector } from '@/components/dashboard/site-selector';
import { requireDashboardUser } from '@/lib/auth/dashboard';
import { listLeads } from '@/lib/adapters/leads';
import { getWorkspaceBundle } from '@/lib/adapters/workspace';
import { selectWidgetSite } from '@/lib/adapters/widgetSites';
import type { SearchParams } from '@/lib/types';

type Props = { searchParams?: Promise<SearchParams> };

async function resolveSearchParams(searchParams?: Promise<SearchParams>) {
  return (await searchParams) ?? {};
}

export default async function DashboardLeadsPage({ searchParams }: Props) {
  const params = await resolveSearchParams(searchParams);
  const clerkUserId = await requireDashboardUser('/dashboard/leads');
  const bundle = await getWorkspaceBundle(clerkUserId);
  const site = selectWidgetSite(bundle.sites, params.site);

  if (!bundle.workspace) {
    return <div className="rounded-3xl border border-dashed border-zinc-700 bg-zinc-900 p-6 text-sm text-zinc-400">No workspace is available for leads yet.</div>;
  }

  const leads = await listLeads(clerkUserId, bundle.workspace.id, site?.id);

  return (
    <div className="grid gap-6">
      <div className="flex justify-end">
        <SiteSelector sites={bundle.sites} selectedSiteId={site?.id} />
      </div>
      <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-lg font-semibold text-white">Captured leads</h2>
        {leads.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-zinc-700 bg-zinc-950 p-4 text-sm text-zinc-400">No leads have been captured yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950">
            <table className="min-w-full text-left text-sm text-zinc-300">
              <thead className="border-b border-zinc-800 text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Company</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-b border-zinc-900 last:border-b-0">
                    <td className="px-4 py-3">{lead.name ?? '—'}</td>
                    <td className="px-4 py-3">{lead.email ?? '—'}</td>
                    <td className="px-4 py-3">{lead.company ?? '—'}</td>
                    <td className="px-4 py-3">{lead.source_domain ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
