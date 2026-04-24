import React from 'react';
import { createIntentAction, deleteIntentAction, reorderIntentAction, updateIntentAction } from '@/app/dashboard/intents/actions';
import { getInitialIntentEditorValues, getInitialIntentsState } from '@/app/dashboard/intents/state';
import { IntentsManager } from '@/components/dashboard/intents-manager';
import { SiteSelector } from '@/components/dashboard/site-selector';
import { requireDashboardUser } from '@/lib/auth/dashboard';
import { listIntents } from '@/lib/adapters/intents';
import { parseIntentsListQuery } from '@/lib/dashboard/intents-list-query';
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
  const listQuery = parseIntentsListQuery(params);

  if (!site) {
    return <div className="rounded-3xl border border-dashed border-zinc-700 bg-zinc-900 p-6 text-sm text-zinc-400">No widget site is available for intents yet.</div>;
  }

  const intents = await listIntents(clerkUserId, site.id);
  const initialState = getInitialIntentsState(intents);
  const initialValues = getInitialIntentEditorValues(intents);
  const context = { clerkUserId, siteId: site.id };

  return (
    <div className="grid gap-6">
      <div className="flex justify-end">
        <SiteSelector sites={bundle.sites} selectedSiteId={site.id} />
      </div>
      <IntentsManager
        initialState={initialState}
        initialValues={initialValues}
        createIntentAction={createIntentAction.bind(null, context)}
        updateIntentAction={updateIntentAction.bind(null, context)}
        deleteIntentAction={deleteIntentAction.bind(null, context)}
        reorderIntentAction={reorderIntentAction.bind(null, context)}
        selectedSiteId={site.id}
        listQuery={listQuery}
      />
    </div>
  );
}
