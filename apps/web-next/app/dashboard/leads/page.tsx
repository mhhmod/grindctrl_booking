import React from 'react';
import { saveLeadSettingsAction } from '@/app/dashboard/leads/actions';
import { getInitialLeadSettingsFormState } from '@/app/dashboard/leads/state';
import { LeadsDashboard, type LeadsListState } from '@/components/dashboard/leads-dashboard';
import { SiteSelector } from '@/components/dashboard/site-selector';
import { requireDashboardUser } from '@/lib/auth/dashboard';
import { listLeads } from '@/lib/adapters/leads';
import { parseLeadsListQuery, resolveLeadsList } from '@/lib/dashboard/leads-list-query';
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
  const leadsQuery = parseLeadsListQuery(params);
  try {
    const allLeads = await listLeads(clerkUserId, bundle.workspace.id, site.id);
    const resolvedLeads = resolveLeadsList(allLeads, leadsQuery);

    leadsState = {
      status: 'success',
      leads: resolvedLeads.items,
      message: null,
      query: leadsQuery.q,
      sort: leadsQuery.sort,
      page: resolvedLeads.page,
      pageSize: resolvedLeads.pageSize,
      totalPages: resolvedLeads.totalPages,
      startIndex: resolvedLeads.startIndex,
      endIndex: resolvedLeads.endIndex,
      filteredCount: resolvedLeads.totalItems,
      totalCount: allLeads.length,
    };
  } catch (error) {
    leadsState = {
      status: 'error',
      leads: [],
      message: error instanceof Error ? error.message : 'Unable to load leads.',
      query: leadsQuery.q,
      sort: leadsQuery.sort,
      page: 1,
      pageSize: leadsQuery.pageSize,
      totalPages: 1,
      startIndex: 0,
      endIndex: 0,
      filteredCount: 0,
      totalCount: 0,
    };
  }

  return (
    <div className="grid gap-6">
      <div className="flex justify-end">
        <SiteSelector sites={bundle.sites} selectedSiteId={site.id} />
      </div>
      <LeadsDashboard initialSettingsState={initialSettingsState} saveSettingsAction={saveSettings} leadsState={leadsState} selectedSiteId={site.id} />
    </div>
  );
}
