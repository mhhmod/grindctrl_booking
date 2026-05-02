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

export function AnalyticsPreview() {
  return (
    <section className="grid gap-4">
      <Card>
        <CardHeader>
          <Badge variant="secondary" className="w-fit">Sample / preview metrics</Badge>
          <CardTitle>Trial funnel</CardTitle>
          <CardDescription>Landing visit → Guided preview → Sign-up → Dashboard review → Implementation request.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {TRIAL_FUNNEL_PREVIEW.map((metric) => (
            <article key={metric.label} className="rounded-xl border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">{metric.label}</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{metric.value.toLocaleString()}</p>
              <p className="mt-1 text-xs text-muted-foreground">{metric.note}</p>
            </article>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Operations metrics</CardTitle>
            <CardDescription>Preview labels only. Real values require persistence + event pipelines.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {OPERATIONS_METRICS_PREVIEW.map((metric) => (
              <article key={metric.label} className="rounded-xl border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">{metric.label}</p>
                <p className="mt-1 text-xl font-semibold text-foreground">{metric.value.toLocaleString()}</p>
                <p className="mt-1 text-xs text-muted-foreground">{metric.note}</p>
              </article>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Channel breakdown</CardTitle>
            <CardDescription>Website, WhatsApp, Instagram, Messenger, Telegram, Voice, Files.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={CHANNEL_BREAKDOWN_PREVIEW} margin={{ left: 0, right: 0, top: 8, bottom: 4 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="channel" tickLine={false} axisLine={false} interval={0} height={44} />
                  <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={28} />
                  <Tooltip formatter={(value) => `${value}`} />
                  <Bar dataKey="value" name="Preview volume" radius={8} fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
