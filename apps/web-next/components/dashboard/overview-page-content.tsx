import Link from 'next/link';
import type { ComponentType } from 'react';
import { Bot, Globe2, MousePointer2, UsersRound } from 'lucide-react';
import type {
  WidgetDomain,
  WidgetEventAnalyticsBundle,
  WidgetEventsWindow,
  WidgetIntent,
  WidgetLead,
  WidgetSite,
  Workspace,
} from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { WidgetInteractionCharts } from '@/components/dashboard/widget-interaction-charts';
import { cn } from '@/lib/utils';

function metricLabel(value: number | null, emptyLabel = 'No data yet') {
  if (value === null) return emptyLabel;
  return value.toLocaleString();
}

function SetupItem({
  label,
  done,
  hint,
}: {
  label: string;
  done: boolean;
  hint?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b px-6 py-4 last:border-b-0">
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground">{label}</div>
        {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
      </div>
      <Badge variant={done ? 'default' : 'secondary'} className={cn('shrink-0', done ? '' : 'opacity-90')}>
        {done ? 'Done' : 'Todo'}
      </Badge>
    </div>
  );
}

function OverviewMetricCard({
  label,
  value,
  hint,
  status,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  status: string;
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}) {
  return (
    <Card className="flex min-w-0 flex-col justify-between">
      <div className="flex justify-between p-6">
        <div className="min-w-0">
          <CardTitle className="inline-flex items-center gap-x-1.5 text-sm">
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{label}</span>
          </CardTitle>
          <CardDescription className="mt-1">{hint}</CardDescription>
        </div>
        <Badge variant="secondary" className="shrink-0">{status}</Badge>
      </div>
      <CardContent className="space-y-1">
        <p className="break-words text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

export function OverviewPageContent({
  workspace,
  site,
  role,
  domains,
  intents,
  leads,
  widgetEventsWindow,
  widgetEventsWindowLinks,
  widgetEventsState,
}: {
  workspace: Workspace;
  site: WidgetSite | null;
  role: string | null;
  domains: WidgetDomain[];
  intents: WidgetIntent[];
  leads: WidgetLead[];
  widgetEventsWindow: WidgetEventsWindow;
  widgetEventsWindowLinks: Record<WidgetEventsWindow, string>;
  widgetEventsState: {
    status: 'loading' | 'success' | 'error';
    bundle: WidgetEventAnalyticsBundle;
    message: string | null;
  };
}) {
  const hasSite = Boolean(site);
  const hasEmbedKey = Boolean(site?.embed_key);
  const hasDomains = domains.length > 0;
  const hasIntents = intents.length > 0;
  const hasLeads = leads.length > 0;
  const liveReady = hasSite && hasEmbedKey && hasDomains && hasIntents;

  return (
    <section className="grid min-w-0 gap-4 md:grid-cols-2">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:col-span-full xl:grid-cols-4">
        <OverviewMetricCard
          icon={Bot}
          label="Site status"
          value={site?.name ?? 'No site'}
          hint={`${workspace.name} / ${role ?? 'role unavailable'}`}
          status={liveReady ? 'Live-ready' : hasSite ? site?.status ?? 'Draft' : 'Missing'}
        />
        <OverviewMetricCard
          icon={Globe2}
          label="Allowed domains"
          value={metricLabel(domains.length)}
          hint="Hostnames approved to run the widget"
          status={hasDomains ? 'Ready' : 'Needs setup'}
        />
        <OverviewMetricCard
          icon={MousePointer2}
          label="Intents"
          value={metricLabel(intents.length)}
          hint="Guided visitor actions and routes"
          status={hasIntents ? 'Configured' : 'Add routing'}
        />
        <OverviewMetricCard
          icon={UsersRound}
          label="Captured leads"
          value={metricLabel(leads.length)}
          hint="Contacts captured by the widget"
          status={hasLeads ? 'Capturing' : 'No leads yet'}
        />
      </div>

      {!hasSite ? (
        <Alert className="md:col-span-full">
          <AlertTitle>No site selected</AlertTitle>
          <AlertDescription>Select a widget site to see readiness, domains, intents, and leads in context.</AlertDescription>
        </Alert>
      ) : null}

        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <CardTitle>Install readiness</CardTitle>
              <CardDescription>The dashboard only reflects real contracts. No fabricated analytics.</CardDescription>
            </div>
            <Button asChild variant="outline" className="shrink-0">
              <Link href="/dashboard/install">Open install</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <SetupItem label="Widget site selected" done={hasSite} hint="Pick a site to scope domains, intents, and leads." />
            <SetupItem label="Embed key available" done={hasEmbedKey} hint="Used by the canonical loader contract." />
            <SetupItem label="At least one allowed domain" done={hasDomains} hint="Controls where the widget may load." />
            <SetupItem label="At least one intent" done={hasIntents} hint="Intents are loaded from dashboard_list_intents." />
            <SetupItem label="Leads observed (optional)" done={hasLeads} hint="Leads come from dashboard_list_leads when captured." />

            <div className="border-t px-6 py-4">
              <div className="text-xs font-medium text-muted-foreground">Embed key</div>
              <div className="mt-1 break-all font-mono text-xs text-foreground" dir="ltr">{site?.embed_key ?? 'No site available'}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <CardTitle>Widget interaction analytics</CardTitle>
              <CardDescription>Real event telemetry from widget_events, scoped to the selected site.</CardDescription>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              {(['24h', '7d', '30d'] as WidgetEventsWindow[]).map((windowValue) => (
                <Button key={windowValue} asChild size="sm" variant={widgetEventsWindow === windowValue ? 'default' : 'outline'}>
                  <Link href={widgetEventsWindowLinks[windowValue]} aria-current={widgetEventsWindow === windowValue ? 'page' : undefined}>
                    {windowValue}
                  </Link>
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {widgetEventsState.status === 'loading' ? (
              <WidgetInteractionCharts status="loading" timeseries={[]} breakdown={[]} funnel={null} />
            ) : widgetEventsState.status === 'error' ? (
              <Alert>
                <AlertTitle>Unable to load widget interaction analytics</AlertTitle>
                <AlertDescription>{widgetEventsState.message ?? 'The analytics read contract returned an error.'}</AlertDescription>
              </Alert>
            ) : (
              <WidgetInteractionCharts
                status="success"
                timeseries={widgetEventsState.bundle.timeseries}
                breakdown={widgetEventsState.bundle.breakdown}
                funnel={widgetEventsState.bundle.funnel}
              />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent leads</CardTitle>
            <CardDescription>Latest captured leads for the selected scope.</CardDescription>
          </CardHeader>
          <CardContent className={leads.length === 0 ? undefined : 'p-0'}>
            {leads.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-muted/10 px-3 py-3 text-sm text-muted-foreground">
                No leads have been captured for this scope yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lead</TableHead>
                      <TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.slice(0, 5).map((lead) => (
                      <TableRow key={lead.id}>
                        <TableCell className="font-medium">
                          <span className="break-all" dir={lead.email ? 'ltr' : 'auto'}>{lead.email ?? lead.name ?? 'Unnamed lead'}</span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          <span className="break-all" dir="ltr">{lead.source_domain ?? 'Unknown source'}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current scope</CardTitle>
            <CardDescription>What this dashboard shows today.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="rounded-lg border bg-muted/10 px-3 py-2.5">Domains loaded from dashboard_list_domains</div>
            <div className="rounded-lg border bg-muted/10 px-3 py-2.5">Intents loaded from dashboard_list_intents</div>
            <div className="rounded-lg border bg-muted/10 px-3 py-2.5">Leads loaded from dashboard_list_leads</div>
            <div className="rounded-lg border bg-muted/10 px-3 py-2.5">Editable widget config stays consolidated in settings_json</div>
          </CardContent>
        </Card>
    </section>
  );
}
