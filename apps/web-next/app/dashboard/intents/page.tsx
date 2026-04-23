import { SiteSelector } from '@/components/dashboard/site-selector';
import { requireDashboardUser } from '@/lib/auth/dashboard';
import { listIntents } from '@/lib/adapters/intents';
import { getWorkspaceBundle } from '@/lib/adapters/workspace';
import { selectWidgetSite } from '@/lib/adapters/widgetSites';
import type { SearchParams } from '@/lib/types';

type Props = { searchParams?: Promise<SearchParams> };

async function resolveSearchParams(searchParams?: Promise<SearchParams>) {
  return (await searchParams) ?? {};
}

export default async function DashboardIntentsPage({ searchParams }: Props) {
  const params = await resolveSearchParams(searchParams);
  const clerkUserId = await requireDashboardUser('/dashboard/intents');
  const bundle = await getWorkspaceBundle(clerkUserId);
  const site = selectWidgetSite(bundle.sites, params.site);

  if (!site) {
    return <div className="rounded-3xl border border-dashed border-zinc-700 bg-zinc-900 p-6 text-sm text-zinc-400">No widget site is available for intents yet.</div>;
  }

  const intents = await listIntents(clerkUserId, site.id);

  return (
    <div className="grid gap-6">
      <div className="flex justify-end">
        <SiteSelector sites={bundle.sites} selectedSiteId={site.id} />
      </div>
      <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-lg font-semibold text-white">Configured intents</h2>
        {intents.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-zinc-700 bg-zinc-950 p-4 text-sm text-zinc-400">No intents are configured for this site yet.</p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {intents.map((intent) => (
              <li key={intent.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                <div className="text-sm font-medium text-zinc-100">{intent.label}</div>
                <div className="mt-1 text-sm text-zinc-500">{intent.action_type ?? 'send_message'}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
