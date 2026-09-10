'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CHANNEL_BREAKDOWN_PREVIEW, OPERATIONS_METRICS_PREVIEW, TRIAL_FUNNEL_PREVIEW } from '@/lib/dashboard/analytics-preview-data';
import { getAnalyticsCopy } from '@/lib/dashboard/dashboard-content-copy';
import type { SiteLocale } from '@/lib/landing/landing-i18n';

export function AnalyticsPreview({ locale = 'en' }: { locale?: SiteLocale }) {
  const c = getAnalyticsCopy(locale);
  const numberFormat = new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-US', { numberingSystem: 'latn' });
  const channelData = CHANNEL_BREAKDOWN_PREVIEW.map((metric) => ({ ...metric, channel: c.translate(metric.channel) }));

  return (
    <section className="grid gap-4">
      <Card>
        <CardHeader>
          <Badge variant="secondary" className="w-fit">{c.badge}</Badge>
          <CardTitle>{c.funnel}</CardTitle>
          <CardDescription>{c.funnelDescription}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {TRIAL_FUNNEL_PREVIEW.map((metric) => (
            <article key={metric.label} className="rounded-xl border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">{c.translate(metric.label)}</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{numberFormat.format(metric.value)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{c.translate(metric.note)}</p>
            </article>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Card>
          <CardHeader>
            <CardTitle>{c.operations}</CardTitle>
            <CardDescription>{c.operationsDescription}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {OPERATIONS_METRICS_PREVIEW.map((metric) => (
              <article key={metric.label} className="rounded-xl border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">{c.translate(metric.label)}</p>
                <p className="mt-1 text-xl font-semibold text-foreground">{numberFormat.format(metric.value)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{c.translate(metric.note)}</p>
              </article>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{c.channels}</CardTitle>
            <CardDescription>{c.channelsDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={channelData} margin={{ left: 0, right: 0, top: 8, bottom: 4 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="channel" tickLine={false} axisLine={false} interval={0} height={44} />
                  <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={28} />
                  <Tooltip formatter={(value) => `${value}`} />
                  <Bar dataKey="value" name={c.previewVolume} radius={8} fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
