import 'server-only';

import { buildCanonicalInstallSnippet, buildCspInstallSnippet } from '@/lib/adapters/install';
import { listDomains } from '@/lib/adapters/domains';
import { getInstallVerification } from '@/lib/adapters/installVerification';
import { getWidgetEventAnalyticsBundle, normalizeWidgetEventsWindow } from '@/lib/adapters/widgetEvents';
import { getWorkspaceBundle } from '@/lib/adapters/workspace';
import { normalizeSettingsJson, selectWidgetSite } from '@/lib/adapters/widgetSites';
import type { SearchParams, WidgetEventAnalyticsBundle, WidgetEventsWindow, WidgetInstallVerification } from '@/lib/types';

export type SitesWorkspaceBundle = {
  workspaceId: string | null;
  sitesCount: number;
  selectedSiteId: string | null;
  settings: ReturnType<typeof normalizeSettingsJson> | null;
  domains: Awaited<ReturnType<typeof listDomains>>;
  installVerification: {
    status: 'success' | 'error';
    verification: WidgetInstallVerification | null;
    message: string | null;
  };
  widgetEvents: {
    status: 'success' | 'error';
    window: WidgetEventsWindow;
    bundle: WidgetEventAnalyticsBundle;
    message: string | null;
  };
  installSnippets: {
    canonical: string;
    csp: string;
  } | null;
};

async function resolveSearchParams(searchParams?: Promise<SearchParams>) {
  return (await searchParams) ?? {};
}

export async function getSitesWorkspaceBundle(input: {
  clerkUserId: string;
  searchParams?: Promise<SearchParams>;
}): Promise<SitesWorkspaceBundle> {
  const params = await resolveSearchParams(input.searchParams);
  const bundle = await getWorkspaceBundle(input.clerkUserId);
  const selectedSite = selectWidgetSite(bundle.sites, params.site);
  const selectedWindow = normalizeWidgetEventsWindow(params.window);

  if (!bundle.workspace || !selectedSite) {
    return {
      workspaceId: bundle.workspace?.id ?? null,
      sitesCount: bundle.sites.length,
      selectedSiteId: null,
      settings: null,
      domains: [],
      installVerification: { status: 'success', verification: null, message: null },
      widgetEvents: {
        status: 'success',
        window: selectedWindow,
        bundle: { timeseries: [], breakdown: [], funnel: null },
        message: null,
      },
      installSnippets: null,
    };
  }

  const settings = normalizeSettingsJson(selectedSite.settings_json);
  const [domains, verificationRes, eventsRes] = await Promise.all([
    listDomains(input.clerkUserId, selectedSite.id),
    getInstallVerification(input.clerkUserId, selectedSite.id),
    getWidgetEventAnalyticsBundle(input.clerkUserId, selectedSite.id, selectedWindow),
  ].map((promise) => promise.catch((error: unknown) => error)));

  const verificationError = verificationRes instanceof Error ? verificationRes : null;
  const eventsError = eventsRes instanceof Error ? eventsRes : null;

  return {
    workspaceId: bundle.workspace.id,
    sitesCount: bundle.sites.length,
    selectedSiteId: selectedSite.id,
    settings,
    domains: Array.isArray(domains) ? domains : [],
    installVerification: {
      status: verificationError ? 'error' : 'success',
      verification: verificationError ? null : (verificationRes as WidgetInstallVerification | null),
      message: verificationError ? verificationError.message : null,
    },
    widgetEvents: {
      status: eventsError ? 'error' : 'success',
      window: selectedWindow,
      bundle: eventsError ? { timeseries: [], breakdown: [], funnel: null } : (eventsRes as WidgetEventAnalyticsBundle),
      message: eventsError ? eventsError.message : null,
    },
    installSnippets: {
      canonical: buildCanonicalInstallSnippet(selectedSite.embed_key),
      csp: buildCspInstallSnippet(selectedSite.embed_key),
    },
  };
}
