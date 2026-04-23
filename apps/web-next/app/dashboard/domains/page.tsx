import React from 'react';
import { DomainsManager } from '@/components/dashboard/domains-manager';
import { SiteSelector } from '@/components/dashboard/site-selector';
import { addDomainAction, getInitialDomainsState, removeDomainAction, updateDomainStatusAction } from '@/app/dashboard/domains/actions';
import { requireDashboardUser } from '@/lib/auth/dashboard';
import { listDomains } from '@/lib/adapters/domains';
import { getWorkspaceBundle } from '@/lib/adapters/workspace';
import { normalizeSettingsJson, selectWidgetSite } from '@/lib/adapters/widgetSites';
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
  const initialState = getInitialDomainsState(domains);
  const settings = normalizeSettingsJson(site.settings_json);
  const context = { clerkUserId, siteId: site.id };

  return (
    <div className="grid gap-6">
      <div className="flex justify-end">
        <SiteSelector sites={bundle.sites} selectedSiteId={site.id} />
      </div>
      <DomainsManager
        initialState={initialState}
        addDomainAction={addDomainAction.bind(null, context)}
        updateDomainStatusAction={updateDomainStatusAction.bind(null, context)}
        removeDomainAction={removeDomainAction.bind(null, context)}
        allowLocalhost={settings.security.allow_localhost}
      />
    </div>
  );
}
