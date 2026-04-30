'use client';

import React from 'react';
import Link from 'next/link';
import { useMemo } from 'react';
import type { WidgetEventAnalyticsBundle, WidgetEventsWindow, WidgetSite } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SiteSelector } from '@/components/dashboard/site-selector';

const selectClassName =
  'h-9 w-full rounded-4xl border border-input bg-input/30 px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

type InboxWorkspaceProps = {
  sites: WidgetSite[];
  selectedSiteId: string;
  analytics: WidgetEventAnalyticsBundle;
  selectedWindow: WidgetEventsWindow;
  windowLinks: Record<WidgetEventsWindow, string>;
};

function getBreakdownCount(analytics: WidgetEventAnalyticsBundle, eventName: string) {
  return analytics.breakdown.find((item) => item.event_name === eventName)?.total_count ?? 0;
}

function formatNumber(value: number) {
  return value.toLocaleString();
}

export function InboxWorkspace({ sites, selectedSiteId, analytics, selectedWindow, windowLinks }: InboxWorkspaceProps) {
  const summary = useMemo(
    () => ({
      starts: analytics.funnel?.conversation_start_count ?? getBreakdownCount(analytics, 'conversation_start'),
      messages: analytics.funnel?.message_sent_count ?? getBreakdownCount(analytics, 'message_sent'),
      escalations: analytics.funnel?.escalation_trigger_count ?? getBreakdownCount(analytics, 'escalation_trigger'),
    }),
    [analytics],
  );

  return (
    <div className="grid gap-6">
      <div className="flex justify-start sm:justify-end">
        <SiteSelector sites={sites} selectedSiteId={selectedSiteId} />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle>Inbox</CardTitle>
            <CardDescription>Queue and triage widget conversations by status and owner. Conversation read rows are pending backend contract support.</CardDescription>
          </div>
          <Badge variant="secondary" className="shrink-0">
            Backend dependency: conversation read API
          </Badge>
        </CardHeader>
        <CardContent className="grid gap-4">
          <form method="get" action="/dashboard/inbox" className="grid gap-3 md:grid-cols-[minmax(0,1fr)_170px_170px_170px_auto] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="inbox-search">Search</Label>
              <Input id="inbox-search" name="q" placeholder="Conversation, contact, phone, or intent" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inbox-status">Status</Label>
              <select id="inbox-status" name="status" className={selectClassName} defaultValue="all">
                <option value="all">All statuses</option>
                <option value="open">Open</option>
                <option value="pending">Pending</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="inbox-owner">Owner</Label>
              <select id="inbox-owner" name="owner" className={selectClassName} defaultValue="all">
                <option value="all">All owners</option>
                <option value="unassigned">Unassigned</option>
                <option value="me">Assigned to me</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="inbox-window">Window</Label>
              <select
                id="inbox-window"
                name="window"
                className={selectClassName}
                value={selectedWindow}
                onChange={(event) => {
                  const href = windowLinks[event.target.value as WidgetEventsWindow];
                  if (href) globalThis.location.assign(href);
                }}
              >
                <option value="24h">24h</option>
                <option value="7d">7d</option>
                <option value="30d">30d</option>
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit">Apply</Button>
              <Button asChild type="button" variant="outline">
                <Link href={`/dashboard/inbox?site=${encodeURIComponent(selectedSiteId)}&window=${selectedWindow}`}>Clear</Link>
              </Button>
            </div>
            <input type="hidden" name="site" value={selectedSiteId} />
          </form>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="text-xs text-muted-foreground">Conversations started</p>
              <p className="mt-2 text-2xl font-semibold">{formatNumber(summary.starts)}</p>
            </div>
            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="text-xs text-muted-foreground">Messages sent</p>
              <p className="mt-2 text-2xl font-semibold">{formatNumber(summary.messages)}</p>
            </div>
            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="text-xs text-muted-foreground">Escalations</p>
              <p className="mt-2 text-2xl font-semibold">{formatNumber(summary.escalations)}</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
            <div className="rounded-xl border border-dashed bg-muted/20 p-4">
              <div className="grid grid-cols-[1.1fr_120px_140px] gap-3 border-b pb-3 text-xs text-muted-foreground">
                <p>Summary</p>
                <p>Status</p>
                <p>Owner</p>
              </div>
              <div className="py-6 text-sm text-muted-foreground">
                Conversation list rows are blocked until a dashboard conversation/messages read contract is approved.
              </div>
            </div>
            <div className="rounded-xl border border-dashed bg-muted/20 p-4">
              <p className="text-sm font-medium">Detail view</p>
              <p className="mt-3 text-sm text-muted-foreground">Select a conversation once backend read support is available to inspect timeline, lead summary, and routing outcome.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="outline">Assigned owner</Badge>
                <Badge variant="outline">Qualification summary</Badge>
                <Badge variant="outline">Routing recommendation</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
