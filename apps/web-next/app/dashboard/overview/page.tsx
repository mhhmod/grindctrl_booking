import { OverviewPageContent } from '@/components/dashboard/overview-page-content';
import { requireDashboardUser } from '@/lib/auth/dashboard';
import { listDomains } from '@/lib/adapters/domains';
import { listIntents } from '@/lib/adapters/intents';
import { listLeads } from '@/lib/adapters/leads';
import { getWidgetEventAnalyticsBundle, normalizeWidgetEventsWindow } from '@/lib/adapters/widgetEvents';
import { getWorkspaceBundle } from '@/lib/adapters/workspace';
import { selectWidgetSite } from '@/lib/adapters/widgetSites';
import type { SearchParams, WidgetEventAnalyticsBundle, WidgetEventsWindow } from '@/lib/types';

type Props = {
  searchParams?: Promise<SearchParams>;
};

async function resolveSearchParams(searchParams?: Promise<SearchParams>) {
  return (await searchParams) ?? {};
}

export default async function DashboardOverviewPage({ searchParams }: Props) {
  const params = await resolveSearchParams(searchParams);
  const eventsWindow = normalizeWidgetEventsWindow(params.window);
  const clerkUserId = await requireDashboardUser('/dashboard/overview');
  const bundle = await getWorkspaceBundle(clerkUserId);

  if (!bundle.workspace) {
    return <div className="rounded-3xl border border-dashed border-zinc-700 bg-zinc-900 p-6 text-sm text-zinc-400">No workspace is connected to this Clerk user yet.</div>;
  }

  const site = selectWidgetSite(bundle.sites, params.site);

  const emptyEventAnalytics: WidgetEventAnalyticsBundle = {
    timeseries: [],
    breakdown: [],
    funnel: null,
  };

  const [domains, intents, leads] = site
    ? await Promise.all([
        listDomains(clerkUserId, site.id),
        listIntents(clerkUserId, site.id),
        listLeads(clerkUserId, bundle.workspace.id, site.id),
      ])
    : [[], [], []];

  let widgetEventsState: {
    status: 'loading' | 'success' | 'error';
    bundle: WidgetEventAnalyticsBundle;
    message: string | null;
  } = {
    status: 'loading',
    bundle: emptyEventAnalytics,
    message: null,
  };

  if (!site) {
    widgetEventsState = {
      status: 'success',
      bundle: emptyEventAnalytics,
      message: null,
    };
  } else {
    try {
      widgetEventsState = {
        status: 'success',
        bundle: await getWidgetEventAnalyticsBundle(clerkUserId, site.id, eventsWindow),
        message: null,
      };
    } catch (error) {
      widgetEventsState = {
        status: 'error',
        bundle: emptyEventAnalytics,
        message: error instanceof Error ? error.message : 'Unable to load widget interaction analytics.',
      };
    }
  }

  const widgetEventsWindowLinks = (['24h', '7d', '30d'] as WidgetEventsWindow[]).reduce(
    (acc, windowValue) => {
      const next = new URLSearchParams();
      if (site?.id) {
        next.set('site', site.id);
      }
      next.set('window', windowValue);
      acc[windowValue] = `/dashboard/overview?${next.toString()}`;
      return acc;
    },
    {} as Record<WidgetEventsWindow, string>,
  );

  return (
    <div className="grid min-w-0 gap-4">
      <OverviewPageContent
        workspace={bundle.workspace}
        site={site}
        role={bundle.role}
        domains={domains}
        intents={intents}
        leads={leads}
        widgetEventsWindow={eventsWindow}
        widgetEventsWindowLinks={widgetEventsWindowLinks}
        widgetEventsState={widgetEventsState}
      />
    </div>
  );
}
