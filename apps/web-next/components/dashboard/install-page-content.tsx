import React from 'react';
import Link from 'next/link';
import { CopyButton } from '@/components/dashboard/copy-button';
import { WidgetInteractionCharts } from '@/components/dashboard/widget-interaction-charts';
import { getDomainStatusTone } from '@/lib/domains';
import { getInstallDomainSafety, getInstallStatus, getInstallStatusLabel, getInstallStatusTone } from '@/lib/adapters/install';
import type { WidgetDomain, WidgetEventAnalyticsBundle, WidgetEventsWindow, WidgetInstallVerification, WidgetSite } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function formatTimestamp(value?: string | null) {
  if (!value) return 'Not seen yet';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

export function InstallPageContent({
  site,
  domains,
  allowLocalhost,
  verificationState,
  canonicalSnippet,
  cspSnippet,
  widgetEventsWindow,
  widgetEventsWindowLinks,
  widgetEventsState,
}: {
  site: WidgetSite;
  domains: WidgetDomain[];
  allowLocalhost: boolean;
  verificationState: {
    status: 'success' | 'error';
    verification: WidgetInstallVerification | null;
    message: string | null;
  };
  canonicalSnippet: string;
  cspSnippet: string;
  widgetEventsWindow: WidgetEventsWindow;
  widgetEventsWindowLinks: Record<WidgetEventsWindow, string>;
  widgetEventsState: {
    status: 'loading' | 'success' | 'error';
    bundle: WidgetEventAnalyticsBundle;
    message: string | null;
  };
}) {
  const verifiedDomains = domains.filter((domain) => domain.verification_status === 'verified');
  const installStatus = getInstallStatus(verificationState.verification);
  const domainSafety = getInstallDomainSafety(domains, verificationState.verification, allowLocalhost);

  return (
    <div className="grid gap-6">
      <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <CardTitle>Public embed key</CardTitle>
              <CardDescription>Use the current site embed key with the canonical loader snippet. This is safe for client-side installation.</CardDescription>
            </div>
            <span className={`shrink-0 inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium border-emerald-500/30 bg-emerald-500/10 text-emerald-300`}>
              {site.status}
            </span>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border bg-muted/10 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <code className="break-all text-sm text-foreground" dir="ltr">{site.embed_key}</code>
                <CopyButton value={site.embed_key} label="Copy key" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Canonical install contract</CardTitle>
            <CardDescription>This preserves the existing queue-first `GrindctrlSupport` loader contract and does not invent a new embed format.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 text-sm">
              <li className="rounded-lg border bg-muted/10 px-3 py-2">Uses the public embed key from the selected widget site</li>
              <li className="rounded-lg border bg-muted/10 px-3 py-2">Loads the existing versioned loader from `cdn.grindctrl.com`</li>
              <li className="rounded-lg border bg-muted/10 px-3 py-2">Keeps the public widget runtime separate from the React app</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <CardTitle>Install verification</CardTitle>
              <CardDescription>Uses the latest backend-recorded `widget_heartbeat` event so operators can confirm the selected install is alive without changing the snippet contract.</CardDescription>
            </div>
            <span className={`shrink-0 inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${getInstallStatusTone(installStatus)}`}>{getInstallStatusLabel(installStatus)}</span>
          </CardHeader>
          <CardContent>
            {verificationState.status === 'error' ? (
              <Alert variant="destructive" className="mb-4">
                <AlertTitle>Unable to load install verification.</AlertTitle>
                <AlertDescription>{verificationState.message ?? 'The heartbeat read contract returned an error.'}</AlertDescription>
              </Alert>
            ) : null}

            {verificationState.status === 'success' && !verificationState.verification?.last_heartbeat_at ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground mb-4">
                <p className="font-medium text-foreground">This widget has not been seen yet.</p>
                <p className="mt-2 leading-6">Once the canonical snippet boots on an allowed origin, the runtime will emit a heartbeat and the latest activity will appear here.</p>
              </div>
            ) : null}

            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border bg-muted/10 p-4">
                <dt className="text-sm text-muted-foreground">Last heartbeat</dt>
                <dd className="mt-2 text-sm text-foreground">{formatTimestamp(verificationState.verification?.last_heartbeat_at)}</dd>
              </div>
              <div className="rounded-lg border bg-muted/10 p-4">
                <dt className="text-sm text-muted-foreground">Last seen origin</dt>
                <dd className="mt-2 break-all text-sm text-foreground" dir="ltr">{verificationState.verification?.last_seen_origin ?? 'Not seen yet'}</dd>
              </div>
              <div className="rounded-lg border bg-muted/10 p-4 sm:col-span-2">
                <dt className="text-sm text-muted-foreground">Last seen domain</dt>
                <dd className="mt-2 text-sm text-foreground" dir="ltr">{verificationState.verification?.last_seen_domain ?? 'Not seen yet'}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <CardTitle>Domain safety</CardTitle>
              <CardDescription>Install snippets stay unchanged, but production rollout should be tied to the real allowed-domain state for this site.</CardDescription>
            </div>
            <span className={`shrink-0 inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${domainSafety.tone}`}>
              {domainSafety.label}
            </span>
          </CardHeader>
          <CardContent>
            <div className={`rounded-lg border p-4 text-sm ${domainSafety.tone}`}>
              {domainSafety.summary}
            </div>

            {domains.length === 0 ? (
              <Alert className="mt-4 border-amber-500/30 bg-amber-500/10 text-amber-200">
                <AlertDescription>No allowed domains are configured yet. Add at least one production hostname in Domains before sending this snippet to live customer sites.</AlertDescription>
              </Alert>
            ) : (
              <ul className="mt-4 grid gap-3">
                {domains.map((domain) => (
                  <li key={domain.id} className="flex flex-col gap-2 rounded-lg border bg-muted/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-sm text-foreground" dir="ltr">{domain.domain}</span>
                    <Badge variant="outline" className={`capitalize ${getDomainStatusTone(domain.verification_status)}`}>
                      {domain.verification_status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Development behavior</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3 text-sm">
              <li className="rounded-lg border bg-muted/10 p-4">Verified production domains: {verifiedDomains.length}</li>
              <li className="rounded-lg border bg-muted/10 p-4">Configured hostnames: {domains.length}</li>
              <li className="rounded-lg border bg-muted/10 p-4">Localhost/dev access: {allowLocalhost ? 'Enabled through settings_json security defaults.' : 'Disabled in settings_json.'}</li>
              <li className="rounded-lg border bg-muted/10 p-4">Heartbeat read path: `dashboard_get_install_verification`</li>
            </ul>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">`localhost` can stay available for development while production installs should use verified hostnames from the current site domain list.</p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <CardTitle>Widget interaction analytics</CardTitle>
              <CardDescription>Compare real event deltas for this install scope using `widget_events` telemetry.</CardDescription>
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
              <Alert variant="destructive">
                <AlertTitle>Unable to load widget interaction analytics.</AlertTitle>
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

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle>Standard snippet</CardTitle>
            <CardDescription>Recommended for the primary install path.</CardDescription>
          </div>
          <CopyButton value={canonicalSnippet} label="Copy snippet" />
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-lg border bg-muted/10 p-4 text-xs leading-6 text-muted-foreground" dir="ltr">
            <code>{canonicalSnippet}</code>
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle>CSP-friendly snippet</CardTitle>
            <CardDescription>Use this variant when you need a no-inline-script install path.</CardDescription>
          </div>
          <CopyButton value={cspSnippet} label="Copy CSP snippet" />
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-lg border bg-muted/10 p-4 text-xs leading-6 text-muted-foreground" dir="ltr">
            <code>{cspSnippet}</code>
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
