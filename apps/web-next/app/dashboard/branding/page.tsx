import React from 'react';
import { BrandingForm } from '@/components/dashboard/branding-form';
import { SiteSelector } from '@/components/dashboard/site-selector';
import { getInitialBrandingFormState, saveBrandingAction } from '@/app/dashboard/branding/actions';
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
  const initialState = getInitialBrandingFormState(settings);
  const submitBranding = saveBrandingAction.bind(null, {
    clerkUserId,
    siteId: site.id,
    currentSettings: settings,
  });

  return (
    <div className="grid gap-6">
      <div className="flex justify-end">
        <SiteSelector sites={bundle.sites} selectedSiteId={site.id} />
      </div>
      <BrandingForm initialState={initialState} saveAction={submitBranding} />
    </div>
  );
}
