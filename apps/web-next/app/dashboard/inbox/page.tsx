import React from 'react';
import { InboxWorkspace } from '@/components/dashboard/inbox-workspace';
import { requireDashboardUser } from '@/lib/auth/dashboard';
import { getWorkspaceBundle } from '@/lib/adapters/workspace';
import { getWidgetEventAnalyticsBundle, normalizeWidgetEventsWindow } from '@/lib/adapters/widgetEvents';
import { selectWidgetSite } from '@/lib/adapters/widgetSites';
import type { SearchParams, WidgetEventAnalyticsBundle, WidgetEventsWindow } from '@/lib/types';

type Props = {
  searchParams?: Promise<SearchParams>;
};

async function resolveSearchParams(searchParams?: Promise<SearchParams>) {
  return (await searchParams) ?? {};
}

export default async function DashboardInboxPage({ searchParams }: Props) {
  const params = await resolveSearchParams(searchParams);
  const clerkUserId = await requireDashboardUser('/dashboard/inbox');
  const bundle = await getWorkspaceBundle(clerkUserId);
  const site = selectWidgetSite(bundle.sites, params.site);
  const selectedWindow = normalizeWidgetEventsWindow(params.window);

  if (!bundle.workspace || bundle.sites.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-zinc-700 bg-zinc-900 p-6 text-sm text-zinc-400">
        No widget sites are available yet. Add or connect a site before using Inbox.
      </div>
    );
  }

  if (!site) {
    return (
      <div className="rounded-3xl border border-dashed border-zinc-700 bg-zinc-900 p-6 text-sm text-zinc-400">
        No widget site could be selected for Inbox.
      </div>
    );
  }

  let analytics: WidgetEventAnalyticsBundle = {
    timeseries: [],
    breakdown: [],
    funnel: null,
  };

  try {
    analytics = await getWidgetEventAnalyticsBundle(clerkUserId, site.id, selectedWindow);
  } catch {
    // Keep inbox operational shell available even when analytics read fails.
  }

  const windowLinks = (['24h', '7d', '30d'] as WidgetEventsWindow[]).reduce(
    (acc, windowValue) => {
      const next = new URLSearchParams();
      next.set('site', site.id);
      next.set('window', windowValue);
      acc[windowValue] = `/dashboard/inbox?${next.toString()}`;
      return acc;
    },
    {} as Record<WidgetEventsWindow, string>,
  );

  return <InboxWorkspace sites={bundle.sites} selectedSiteId={site.id} analytics={analytics} selectedWindow={selectedWindow} windowLinks={windowLinks} />;
}
