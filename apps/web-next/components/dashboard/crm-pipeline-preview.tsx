import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CRM_PIPELINE_PREVIEW, LEAD_PREVIEW_DATA } from '@/lib/dashboard/lead-preview-data';
import { getCrmCopy } from '@/lib/dashboard/dashboard-content-copy';
import type { SiteLocale } from '@/lib/landing/landing-i18n';

export function CrmPipelinePreview({ locale = 'en' }: { locale?: SiteLocale }) {
  const c = getCrmCopy(locale);
  const selectedLead = LEAD_PREVIEW_DATA.find((lead) => lead.status === 'Implementation requested') ?? LEAD_PREVIEW_DATA[0];

  return (
    <section className="grid gap-4">
      <Card>
        <CardHeader>
          <Badge variant="secondary" className="w-fit">{c.badge}</Badge>
          <CardTitle>{c.title}</CardTitle>
          <CardDescription>{c.description}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          {CRM_PIPELINE_PREVIEW.map((stage) => (
            <article key={stage.stage} className="rounded-xl border bg-muted/20 p-3">
              <p className="text-xs font-medium text-muted-foreground">{c.translate(stage.stage)}</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{stage.count}</p>
              <p className="mt-2 text-xs text-muted-foreground">{stage.description}</p>
            </article>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{c.selectedLead}</CardTitle>
            <CardDescription>{selectedLead.nameCompany}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-xl border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">{c.detectedNeed}</p>
              <p className="mt-1 text-foreground">{selectedLead.detectedNeed}</p>
            </div>
            <div className="rounded-xl border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">{c.nextAction}</p>
              <p className="mt-1 text-foreground">{selectedLead.nextAction}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{c.score(selectedLead.score)}</Badge>
              <Badge variant="outline">{c.owner(selectedLead.owner)}</Badge>
              <Badge variant="outline">{c.status(selectedLead.status)}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{c.readinessPanel}</CardTitle>
            <CardDescription>{c.readinessDescription}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-muted-foreground">
            <div className="rounded-xl border bg-muted/20 p-3">
              <p className="text-xs font-medium text-foreground">{c.syncReadiness}</p>
              <p className="mt-1">{c.syncReadinessBody}</p>
            </div>
            <div className="rounded-xl border bg-muted/20 p-3">
              <p className="text-xs font-medium text-foreground">{c.integrationsNeeded}</p>
              <ul className="mt-1 list-disc space-y-1 ps-5">
                {c.integrationItems.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
