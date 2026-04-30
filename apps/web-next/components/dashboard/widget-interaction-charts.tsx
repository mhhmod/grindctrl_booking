'use client';

import React from 'react';

import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import type { WidgetEventBreakdownRow, WidgetEventFunnelSummary, WidgetEventTimeseriesPoint } from '@/lib/types';

const EVENT_LABELS: Record<string, string> = {
  widget_open: 'Widget open',
  conversation_start: 'Conversation start',
  message_sent: 'Message sent',
  intent_click: 'Intent click',
  lead_captured: 'Lead captured',
  lead_capture_skipped: 'Lead skipped',
  escalation_trigger: 'Escalation',
  widget_close: 'Widget close',
  widget_heartbeat: 'Heartbeat',
  other: 'Other',
};

function formatBucketLabel(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: parsed.getHours() === 0 ? undefined : '2-digit',
  }).format(parsed);
}

function formatRate(value: number | null) {
  if (value == null) return 'N/A';
  return `${value.toFixed(2)}%`;
}

const trendConfig = {
  interactions: {
    label: 'Total',
    color: 'var(--primary)',
  },
  messages: {
    label: 'Messages',
    color: 'var(--chart-2)',
  },
  leads: {
    label: 'Leads',
    color: 'var(--chart-3)',
  },
  escalations: {
    label: 'Escalations',
    color: 'var(--chart-4)',
  },
} satisfies ChartConfig;

function ChartLoadingState() {
  return (
    <div className="grid gap-4" aria-label="Loading widget interaction charts">
      <div className="rounded-lg border bg-muted/10 px-3 py-3">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="mt-3 h-52 w-full" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-lg border bg-muted/10 px-3 py-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-3 h-52 w-full" />
        </div>
        <div className="rounded-lg border bg-muted/10 px-3 py-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-3 h-52 w-full" />
        </div>
      </div>
    </div>
  );
}

export function WidgetInteractionCharts({
  status = 'success',
  timeseries,
  breakdown,
  funnel,
}: {
  status?: 'loading' | 'success';
  timeseries: WidgetEventTimeseriesPoint[];
  breakdown: WidgetEventBreakdownRow[];
  funnel: WidgetEventFunnelSummary | null;
}) {
  if (status === 'loading') {
    return <ChartLoadingState />;
  }

  const trendData = timeseries.map((point) => ({
    bucket: formatBucketLabel(point.bucket_start),
    interactions: point.total_count,
    messages: point.message_sent_count,
    leads: point.lead_captured_count,
    escalations: point.escalation_trigger_count,
  }));

  const breakdownData = breakdown
    .filter((row) => row.total_count > 0)
    .map((row) => ({
      name: EVENT_LABELS[row.event_name] ?? row.event_name,
      value: row.total_count,
    }));

  const noData = trendData.length === 0 || trendData.every((point) => point.interactions === 0);

  if (noData) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/10 px-4 py-5" role="status" aria-live="polite">
        <p className="text-sm font-medium text-foreground">No widget events yet</p>
        <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">
          Analytics are ready. Events will appear here after the installed widget records opens, messages, intents, or leads.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-lg border bg-muted/10 px-3 py-3">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Interaction trend</p>
        <ChartContainer className="mt-3 h-52 w-full" config={trendConfig}>
          <LineChart data={trendData} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="bucket" tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} />
            <ChartTooltip cursor={{ stroke: 'var(--border)' }} content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Line type="monotone" dataKey="interactions" name="interactions" stroke="var(--color-interactions)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="messages" name="messages" stroke="var(--color-messages)" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="leads" name="leads" stroke="var(--color-leads)" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="escalations" name="escalations" stroke="var(--color-escalations)" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ChartContainer>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-lg border bg-muted/10 px-3 py-3">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Funnel summary</p>
          <dl className="mt-3 grid gap-2 text-sm">
            <div className="flex items-center justify-between"><dt className="text-muted-foreground">Widget opens</dt><dd className="font-medium text-foreground">{funnel?.widget_open_count ?? 0}</dd></div>
            <div className="flex items-center justify-between"><dt className="text-muted-foreground">Conversation starts</dt><dd className="font-medium text-foreground">{funnel?.conversation_start_count ?? 0}</dd></div>
            <div className="flex items-center justify-between"><dt className="text-muted-foreground">Messages sent</dt><dd className="font-medium text-foreground">{funnel?.message_sent_count ?? 0}</dd></div>
            <div className="flex items-center justify-between"><dt className="text-muted-foreground">Leads captured</dt><dd className="font-medium text-foreground">{funnel?.lead_captured_count ?? 0}</dd></div>
            <div className="flex items-center justify-between"><dt className="text-muted-foreground">Escalations</dt><dd className="font-medium text-foreground">{funnel?.escalation_trigger_count ?? 0}</dd></div>
          </dl>
          <div className="mt-3 rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground">
            Open to conversation: <span className="font-medium text-foreground">{formatRate(funnel?.open_to_conversation_rate ?? null)}</span><br />
            Conversation to message: <span className="font-medium text-foreground">{formatRate(funnel?.conversation_to_message_rate ?? null)}</span><br />
            Message to lead: <span className="font-medium text-foreground">{formatRate(funnel?.message_to_lead_rate ?? null)}</span>
          </div>
        </div>

        <div className="rounded-lg border bg-muted/10 px-3 py-3">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Event mix</p>
          {breakdownData.length === 0 ? (
            <div className="mt-3 rounded-lg border border-dashed bg-background px-3 py-3 text-sm text-muted-foreground">
              No event-mix rows are available for this window.
            </div>
          ) : (
            <ChartContainer
              className="mt-3 h-52 w-full"
              config={{ value: { label: 'Events', color: 'var(--primary)' } }}
            >
              <BarChart data={breakdownData} layout="vertical" margin={{ top: 6, right: 8, left: 10, bottom: 4 }}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={120} axisLine={false} tickLine={false} />
                <ChartTooltip cursor={{ fill: 'var(--muted)', opacity: 0.2 }} content={<ChartTooltipContent />} />
                <Bar dataKey="value" fill="var(--color-value)" radius={[6, 6, 6, 6]} isAnimationActive={false} />
              </BarChart>
            </ChartContainer>
          )}
        </div>
      </div>
    </div>
  );
}
