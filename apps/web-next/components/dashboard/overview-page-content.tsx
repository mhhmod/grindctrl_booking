import Link from 'next/link';
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
import { Separator } from '@/components/ui/separator';
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
    <div className="flex items-start justify-between gap-3 rounded-lg border bg-background px-3 py-2">
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

  return (
    <div className="flex min-w-0 flex-col gap-5 sm:gap-6">
      <section className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="min-w-0">
            <CardDescription>Workspace</CardDescription>
            <CardTitle className="break-words text-base">{workspace.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">Role: {role ?? 'Unavailable'}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="min-w-0">
            <CardDescription>Selected site</CardDescription>
            <CardTitle className="break-words text-base">{site?.name ?? 'No widget sites yet'}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">Status: {site?.status ?? 'draft'}</div>
            <Badge variant={hasSite ? 'default' : 'secondary'}>{hasSite ? 'Active' : 'None'}</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Allowed domains</CardDescription>
            <CardTitle className="text-base">{metricLabel(domains.length)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">Real domain count from dashboard_list_domains.</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Captured leads</CardDescription>
            <CardTitle className="text-base">{metricLabel(leads.length)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">Real lead count from dashboard_list_leads.</div>
          </CardContent>
        </Card>
      </section>

      {!hasSite ? (
        <Alert>
          <AlertTitle>No site selected</AlertTitle>
          <AlertDescription>Select a widget site to see readiness, domains, intents, and leads in context.</AlertDescription>
        </Alert>
      ) : null}

      <section className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] xl:gap-6">
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
          <CardContent className="flex flex-col gap-3">
            <SetupItem label="Widget site selected" done={hasSite} hint="Pick a site to scope domains, intents, and leads." />
            <SetupItem label="Embed key available" done={hasEmbedKey} hint="Used by the canonical loader contract." />
            <SetupItem label="At least one allowed domain" done={hasDomains} hint="Controls where the widget may load." />
            <SetupItem label="At least one intent" done={hasIntents} hint="Intents are loaded from dashboard_list_intents." />
            <SetupItem label="Leads observed (optional)" done={hasLeads} hint="Leads come from dashboard_list_leads when captured." />

            <Separator />

            <div className="rounded-lg border bg-muted/20 px-3 py-2">
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
      </section>

      <section className="grid min-w-0 gap-5 lg:grid-cols-2 xl:gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent leads</CardTitle>
            <CardDescription>Latest captured leads for the selected scope.</CardDescription>
          </CardHeader>
          <CardContent>
            {leads.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-muted/10 px-3 py-3 text-sm text-muted-foreground">
                No leads have been captured for this scope yet.
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border">
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
          <CardContent className="flex flex-col gap-3 text-sm">
            <div className="rounded-lg border bg-muted/10 px-3 py-3">Domains loaded from dashboard_list_domains</div>
            <div className="rounded-lg border bg-muted/10 px-3 py-3">Intents loaded from dashboard_list_intents</div>
            <div className="rounded-lg border bg-muted/10 px-3 py-3">Leads loaded from dashboard_list_leads</div>
            <div className="rounded-lg border bg-muted/10 px-3 py-3">Editable widget config stays consolidated in settings_json</div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
