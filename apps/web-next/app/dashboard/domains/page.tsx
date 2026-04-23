import { SiteSelector } from '@/components/dashboard/site-selector';
import { requireDashboardUser } from '@/lib/auth/dashboard';
import { listDomains } from '@/lib/adapters/domains';
import { getWorkspaceBundle } from '@/lib/adapters/workspace';
import { selectWidgetSite } from '@/lib/adapters/widgetSites';
import type { SearchParams } from '@/lib/types';

type Props = { searchParams?: Promise<SearchParams> };

async function resolveSearchParams(searchParams?: Promise<SearchParams>) {
  return (await searchParams) ?? {};
}

export default async function DashboardDomainsPage({ searchParams }: Props) {
  const params = await resolveSearchParams(searchParams);
  const clerkUserId = await requireDashboardUser('/dashboard/domains');
  const bundle = await getWorkspaceBundle(clerkUserId);
  const site = selectWidgetSite(bundle.sites, params.site);

  if (!site) {
    return <div className="rounded-3xl border border-dashed border-zinc-700 bg-zinc-900 p-6 text-sm text-zinc-400">No widget site is available for domains yet.</div>;
  }

  const domains = await listDomains(clerkUserId, site.id);

  return (
    <div className="grid gap-6">
      <div className="flex justify-end">
        <SiteSelector sites={bundle.sites} selectedSiteId={site.id} />
      </div>
      <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-lg font-semibold text-white">Allowed domains</h2>
        {domains.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-zinc-700 bg-zinc-950 p-4 text-sm text-zinc-400">No domains are configured for this site yet.</p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {domains.map((domain) => (
              <li key={domain.id} className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                <div className="text-sm text-zinc-100">{domain.domain}</div>
                <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300">{domain.verification_status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
