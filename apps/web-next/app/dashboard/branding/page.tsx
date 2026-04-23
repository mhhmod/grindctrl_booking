import { SiteSelector } from '@/components/dashboard/site-selector';
import { requireDashboardUser } from '@/lib/auth/dashboard';
import { getWorkspaceBundle } from '@/lib/adapters/workspace';
import { normalizeSettingsJson, selectWidgetSite } from '@/lib/adapters/widgetSites';
import type { SearchParams } from '@/lib/types';

type Props = { searchParams?: Promise<SearchParams> };

async function resolveSearchParams(searchParams?: Promise<SearchParams>) {
  return (await searchParams) ?? {};
}

export default async function DashboardBrandingPage({ searchParams }: Props) {
  const params = await resolveSearchParams(searchParams);
  const clerkUserId = await requireDashboardUser('/dashboard/branding');
  const bundle = await getWorkspaceBundle(clerkUserId);
  const site = selectWidgetSite(bundle.sites, params.site);

  if (!site) {
    return <div className="rounded-3xl border border-dashed border-zinc-700 bg-zinc-900 p-6 text-sm text-zinc-400">No widget site is available for branding yet.</div>;
  }

  const settings = normalizeSettingsJson(site.settings_json);

  return (
    <div className="grid gap-6">
      <div className="flex justify-end">
        <SiteSelector sites={bundle.sites} selectedSiteId={site.id} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-lg font-semibold text-white">Branding fields</h2>
          <dl className="mt-4 grid gap-4 text-sm text-zinc-300">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"><dt className="text-zinc-500">Brand name</dt><dd className="mt-2">{settings.branding.brand_name || 'Not set'}</dd></div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"><dt className="text-zinc-500">Assistant name</dt><dd className="mt-2">{settings.branding.assistant_name}</dd></div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"><dt className="text-zinc-500">Launcher label</dt><dd className="mt-2">{settings.branding.launcher_label}</dd></div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"><dt className="text-zinc-500">Widget position</dt><dd className="mt-2">{settings.widget.position}</dd></div>
          </dl>
        </section>
        <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-lg font-semibold text-white">Authority boundary</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-400">This route reads only `settings_json`. Legacy `config_json`, `branding_json`, and `lead_capture_json` are intentionally not surfaced here.</p>
          <pre className="mt-4 overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-xs leading-6 text-zinc-300">
            <code>{JSON.stringify(settings.branding, null, 2)}</code>
          </pre>
        </section>
      </div>
    </div>
  );
}
