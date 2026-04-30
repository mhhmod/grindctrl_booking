import React from 'react';
import Link from 'next/link';
import { saveBrandingAction } from '@/app/dashboard/branding/actions';
import { getInitialBrandingFormState } from '@/app/dashboard/branding/state';
import { addDomainAction, removeDomainAction, updateDomainStatusAction } from '@/app/dashboard/domains/actions';
import { getInitialDomainsState } from '@/app/dashboard/domains/state';
import { BrandingForm } from '@/components/dashboard/branding-form';
import { DomainsManager } from '@/components/dashboard/domains-manager';
import { InstallPageContent } from '@/components/dashboard/install-page-content';
import { SiteSelector } from '@/components/dashboard/site-selector';
import { Button } from '@/components/ui/button';
import { requireDashboardUser } from '@/lib/auth/dashboard';
import { listDomains } from '@/lib/adapters/domains';
import { buildCanonicalInstallSnippet, buildCspInstallSnippet } from '@/lib/adapters/install';
import { getInstallVerification } from '@/lib/adapters/installVerification';
import { getWorkspaceBundle } from '@/lib/adapters/workspace';
import { getWidgetEventAnalyticsBundle, normalizeWidgetEventsWindow } from '@/lib/adapters/widgetEvents';
import { normalizeSettingsJson, selectWidgetSite } from '@/lib/adapters/widgetSites';
import { parseDomainsListQuery } from '@/lib/dashboard/domains-list-query';
import type { SearchParams, WidgetEventAnalyticsBundle, WidgetEventsWindow, WidgetInstallVerification } from '@/lib/types';

type SitesTab = 'install' | 'branding' | 'domains';

type Props = {
  searchParams?: Promise<SearchParams>;
};

async function resolveSearchParams(searchParams?: Promise<SearchParams>) {
  return (await searchParams) ?? {};
}

function normalizeTab(value: string | string[] | undefined): SitesTab {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === 'branding' || raw === 'domains') {
    return raw;
  }
  return 'install';
}

export default async function DashboardSitesPage({ searchParams }: Props) {
  const params = await resolveSearchParams(searchParams);
  const tab = normalizeTab(params.tab);
  const clerkUserId = await requireDashboardUser('/dashboard/sites');
  const bundle = await getWorkspaceBundle(clerkUserId);
  const site = selectWidgetSite(bundle.sites, params.site);
  const settings = site ? normalizeSettingsJson(site.settings_json) : null;
  const eventsWindow = normalizeWidgetEventsWindow(params.window);

  if (!bundle.workspace || bundle.sites.length === 0) {
    return <div className="rounded-3xl border border-dashed border-zinc-700 bg-zinc-900 p-6 text-sm text-zinc-400">No widget sites are available yet. Create or link a site in the existing backend first.</div>;
  }

  if (!site || !settings) {
    return <div className="rounded-3xl border border-dashed border-zinc-700 bg-zinc-900 p-6 text-sm text-zinc-400">No widget site could be selected for Sites.</div>;
  }

  const baseParams = new URLSearchParams();
  baseParams.set('site', site.id);
  const tabHref = {
    install: `/dashboard/sites?${new URLSearchParams({ ...Object.fromEntries(baseParams), tab: 'install' }).toString()}`,
    branding: `/dashboard/sites?${new URLSearchParams({ ...Object.fromEntries(baseParams), tab: 'branding' }).toString()}`,
    domains: `/dashboard/sites?${new URLSearchParams({ ...Object.fromEntries(baseParams), tab: 'domains' }).toString()}`,
  };

  let installVerification: WidgetInstallVerification | null = null;
  let verificationMessage: string | null = null;
  try {
    installVerification = await getInstallVerification(clerkUserId, site.id);
  } catch (error) {
    verificationMessage = error instanceof Error ? error.message : 'Unable to load install verification state.';
  }

  let widgetEventsBundle: WidgetEventAnalyticsBundle = { timeseries: [], breakdown: [], funnel: null };
  let widgetEventsMessage: string | null = null;
  try {
    widgetEventsBundle = await getWidgetEventAnalyticsBundle(clerkUserId, site.id, eventsWindow);
  } catch (error) {
    widgetEventsMessage = error instanceof Error ? error.message : 'Unable to load widget interaction analytics.';
  }

  const widgetEventsWindowLinks = (['24h', '7d', '30d'] as WidgetEventsWindow[]).reduce(
    (acc, windowValue) => {
      const next = new URLSearchParams();
      next.set('site', site.id);
      next.set('tab', 'install');
      next.set('window', windowValue);
      acc[windowValue] = `/dashboard/sites?${next.toString()}`;
      return acc;
    },
    {} as Record<WidgetEventsWindow, string>,
  );

  const domains = await listDomains(clerkUserId, site.id);
  const domainsState = getInitialDomainsState(domains);
  const domainsContext = { clerkUserId, siteId: site.id };
  const domainsQuery = parseDomainsListQuery(params);

  const brandingState = getInitialBrandingFormState(settings);
  const saveBranding = saveBrandingAction.bind(null, {
    clerkUserId,
    siteId: site.id,
    currentSettings: settings,
  });

  return (
    <div className="grid gap-6">
      <div className="flex justify-start sm:justify-end">
        <SiteSelector sites={bundle.sites} selectedSiteId={site.id} />
      </div>

      <nav aria-label="Sites sections" className="-mx-2 overflow-x-auto px-2 pb-1">
        <ul className="flex w-max min-w-full items-center gap-2">
          <li>
            <Button asChild variant={tab === 'install' ? 'default' : 'outline'} size="sm">
              <Link href={tabHref.install}>Install</Link>
            </Button>
          </li>
          <li>
            <Button asChild variant={tab === 'branding' ? 'default' : 'outline'} size="sm">
              <Link href={tabHref.branding}>Branding</Link>
            </Button>
          </li>
          <li>
            <Button asChild variant={tab === 'domains' ? 'default' : 'outline'} size="sm">
              <Link href={tabHref.domains}>Domains</Link>
            </Button>
          </li>
        </ul>
      </nav>

      {tab === 'install' ? (
        <InstallPageContent
          site={site}
          domains={domains}
          allowLocalhost={settings.security.allow_localhost}
          verificationState={{
            status: verificationMessage ? 'error' : 'success',
            verification: installVerification,
            message: verificationMessage,
          }}
          canonicalSnippet={buildCanonicalInstallSnippet(site.embed_key)}
          cspSnippet={buildCspInstallSnippet(site.embed_key)}
          widgetEventsWindow={eventsWindow}
          widgetEventsWindowLinks={widgetEventsWindowLinks}
          widgetEventsState={{
            status: widgetEventsMessage ? 'error' : 'success',
            bundle: widgetEventsBundle,
            message: widgetEventsMessage,
          }}
        />
      ) : null}

      {tab === 'branding' ? <BrandingForm initialState={brandingState} saveAction={saveBranding} /> : null}

      {tab === 'domains' ? (
        <DomainsManager
          initialState={domainsState}
          addDomainAction={addDomainAction.bind(null, domainsContext)}
          updateDomainStatusAction={updateDomainStatusAction.bind(null, domainsContext)}
          removeDomainAction={removeDomainAction.bind(null, domainsContext)}
          allowLocalhost={settings.security.allow_localhost}
          selectedSiteId={site.id}
          listQuery={domainsQuery}
        />
      ) : null}
    </div>
  );
}
