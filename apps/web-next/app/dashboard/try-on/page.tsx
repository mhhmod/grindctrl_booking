import React from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const KPI_ITEMS = [
  { label: 'Try-ons generated', value: '184' },
  { label: 'Leads captured', value: '47' },
  { label: 'Top product', value: 'Premium Ringer Tee' },
  { label: 'Demo conversion intent', value: '26%' },
];

const JOB_ROWS = [
  { jobId: 'tryon_20260506_a1f2', product: 'Premium Ringer Tee', status: 'completed', leadCaptured: 'Yes', createdTime: '2026-05-06 10:22', runtime: 'mock' },
  { jobId: 'tryon_20260506_b7k9', product: 'Premium Ringer Tee', status: 'completed', leadCaptured: 'No', createdTime: '2026-05-06 09:54', runtime: 'mock' },
  { jobId: 'tryon_20260506_c3t1', product: 'Premium Ringer Tee', status: 'processing', leadCaptured: 'No', createdTime: '2026-05-06 09:41', runtime: 'mock' },
  { jobId: 'tryon_20260505_d8m4', product: 'Premium Ringer Tee', status: 'completed', leadCaptured: 'Yes', createdTime: '2026-05-05 18:17', runtime: 'mock' },
];

const PRODUCT_DETAILS = [
  'cream/off-white body',
  'dark chocolate-brown ribbed crew neck',
  'dark chocolate-brown ribbed sleeve cuffs',
  'small left-chest embroidered emblem',
  'athletic/muscle-fit silhouette',
];

const EMBED_SCRIPT = `<script src="https://grindctrl.cloud/scripts/grindctrl-tryon.js" data-site="your-site-key" defer></script>`;

function statusTone(status: string) {
  if (status === 'completed') return 'secondary';
  if (status === 'processing') return 'outline';
  return 'destructive';
}

export default function DashboardTryOnPage() {
  return (
    <section className="grid gap-6">
      <header className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Try-On Agent</h1>
        <p className="text-sm text-muted-foreground">
          Let customers preview products on themselves before buying.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {KPI_ITEMS.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="pb-2">
              <CardDescription>{kpi.label}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold text-foreground">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Active product</CardTitle>
            <CardDescription>Product currently used for the dashboard demo flow.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex items-center justify-between gap-2 rounded-xl border bg-muted/20 p-3">
              <p className="font-medium text-foreground">Premium Ringer Tee</p>
              <Badge variant="secondary">mock mode active</Badge>
            </div>
            <ul className="list-disc space-y-1 ps-5 text-sm text-muted-foreground">
              {PRODUCT_DETAILS.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Live generation status</CardTitle>
            <CardDescription>Provider connection remains intentionally disabled in this phase.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2">
              <span className="text-muted-foreground">Current mode</span>
              <span className="font-medium text-foreground">Mock</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2">
              <span className="text-muted-foreground">Live provider</span>
              <span className="font-medium text-foreground">Not connected</span>
            </div>
            <div className="rounded-lg border bg-muted/20 px-3 py-2">
              <p className="text-muted-foreground">Next step</p>
              <p className="font-medium text-foreground">Connect image provider after dashboard base.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent try-on jobs</CardTitle>
          <CardDescription>Mock/demo rows only. No persistence and no live provider yet.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job ID</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Lead captured</TableHead>
                  <TableHead>Created time</TableHead>
                  <TableHead>Runtime</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {JOB_ROWS.map((row) => (
                  <TableRow key={row.jobId}>
                    <TableCell className="font-mono text-xs">{row.jobId}</TableCell>
                    <TableCell>{row.product}</TableCell>
                    <TableCell><Badge variant={statusTone(row.status)}>{row.status}</Badge></TableCell>
                    <TableCell>{row.leadCaptured}</TableCell>
                    <TableCell>{row.createdTime}</TableCell>
                    <TableCell>{row.runtime}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Lead capture flow</CardTitle>
            <CardDescription>Workflow staged for upcoming live implementation.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <p className="rounded-xl border bg-muted/20 p-3 text-sm text-foreground">
              Try-on completed → WhatsApp follow-up → CRM/Sheets → business owner notification.
            </p>
            <p className="rounded-xl border bg-muted/20 p-3 text-sm text-foreground">
              Webhook routing: Ready when TRYON_COMPLETED_WEBHOOK_URL is configured.
              Optional server-side event only; no customer photo bytes are sent.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Embed setup</CardTitle>
            <CardDescription>Coming soon script preview for storefront activation.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Badge variant="outline" className="w-fit">Disabled / coming soon</Badge>
            <pre className="overflow-x-auto rounded-xl border bg-muted/20 p-3 text-xs text-foreground">
              <code>{EMBED_SCRIPT}</code>
            </pre>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Next actions</CardTitle>
          <CardDescription>Open demo now, then prepare live and embed phases.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/try-on">Open public demo</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/integrations">Prepare live generation</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/install">Prepare embed widget</Link>
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
