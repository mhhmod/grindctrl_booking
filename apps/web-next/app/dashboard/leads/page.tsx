import React from 'react';
import { saveLeadSettingsAction } from '@/app/dashboard/leads/actions';
import { getInitialLeadSettingsFormState } from '@/app/dashboard/leads/state';
import { LeadsDashboard, type LeadsListState } from '@/components/dashboard/leads-dashboard';
import { SiteSelector } from '@/components/dashboard/site-selector';
import { requireDashboardUser } from '@/lib/auth/dashboard';
import { listLeads } from '@/lib/adapters/leads';
import { getWorkspaceBundle } from '@/lib/adapters/workspace';
import { normalizeSettingsJson, selectWidgetSite } from '@/lib/adapters/widgetSites';
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

  if (!site) {
    return <div className="rounded-3xl border border-dashed border-zinc-700 bg-zinc-900 p-6 text-sm text-zinc-400">No widget site is available for lead settings yet.</div>;
  }

  const settings = normalizeSettingsJson(site.settings_json);
  const initialSettingsState = getInitialLeadSettingsFormState(settings);
  const saveSettings = saveLeadSettingsAction.bind(null, {
    clerkUserId,
    siteId: site.id,
    currentSettings: settings,
  });

  let leadsState: LeadsListState;
  try {
    leadsState = {
      status: 'success',
      leads: await listLeads(clerkUserId, bundle.workspace.id, site.id),
      message: null,
    };
  } catch (error) {
    leadsState = {
      status: 'error',
      leads: [],
      message: error instanceof Error ? error.message : 'Unable to load leads.',
    };
  }

  return (
    <div className="grid gap-6">
      <div className="flex justify-end">
        <SiteSelector sites={bundle.sites} selectedSiteId={site.id} />
      </div>
      <LeadsDashboard initialSettingsState={initialSettingsState} saveSettingsAction={saveSettings} leadsState={leadsState} />
    </div>
  );
}
