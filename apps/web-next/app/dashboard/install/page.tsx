import React from 'react';
import { InstallPageContent } from '@/components/dashboard/install-page-content';
import { SiteSelector } from '@/components/dashboard/site-selector';
import { requireDashboardUser } from '@/lib/auth/dashboard';
import { listDomains } from '@/lib/adapters/domains';
import { buildCanonicalInstallSnippet, buildCspInstallSnippet } from '@/lib/adapters/install';
import { getWorkspaceBundle } from '@/lib/adapters/workspace';
import { normalizeSettingsJson, selectWidgetSite } from '@/lib/adapters/widgetSites';
import type { SearchParams } from '@/lib/types';

type Props = {
  searchParams?: Promise<SearchParams>;
};

async function resolveSearchParams(searchParams?: Promise<SearchParams>) {
  return (await searchParams) ?? {};
}

export default async function DashboardInstallPage({ searchParams }: Props) {
  const params = await resolveSearchParams(searchParams);
  const clerkUserId = await requireDashboardUser('/dashboard/install');
  const bundle = await getWorkspaceBundle(clerkUserId);

  if (!bundle.workspace || bundle.sites.length === 0) {
    return <div className="rounded-3xl border border-dashed border-zinc-700 bg-zinc-900 p-6 text-sm text-zinc-400">No widget sites are available yet. Create or link a site in the existing backend before installing.</div>;
  }

  const site = selectWidgetSite(bundle.sites, params.site);
  if (!site) {
    return <div className="rounded-3xl border border-dashed border-zinc-700 bg-zinc-900 p-6 text-sm text-zinc-400">No widget site could be selected for install.</div>;
  }

  const domains = await listDomains(clerkUserId, site.id);
  const settings = normalizeSettingsJson(site.settings_json);

  return (
    <div className="grid gap-6">
      <div className="flex justify-end">
        <SiteSelector sites={bundle.sites} selectedSiteId={site.id} />
      </div>
      <InstallPageContent
        site={site}
        domains={domains}
        allowLocalhost={settings.security.allow_localhost}
        canonicalSnippet={buildCanonicalInstallSnippet(site.embed_key)}
        cspSnippet={buildCspInstallSnippet(site.embed_key)}
      />
    </div>
  );
}
