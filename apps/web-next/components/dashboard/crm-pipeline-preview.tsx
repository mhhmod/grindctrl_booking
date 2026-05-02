import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CRM_PIPELINE_PREVIEW, LEAD_PREVIEW_DATA } from '@/lib/dashboard/lead-preview-data';

export function CrmPipelinePreview() {
  const selectedLead = LEAD_PREVIEW_DATA.find((lead) => lead.status === 'Implementation requested') ?? LEAD_PREVIEW_DATA[0];

  return (
    <section className="grid gap-4">
      <Card>
        <CardHeader>
          <Badge variant="secondary" className="w-fit">CRM-ready preview</Badge>
          <CardTitle>CRM pipeline preview</CardTitle>
          <CardDescription>Stages: Captured, Qualified, Proposal, Implementation, Converted.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          {CRM_PIPELINE_PREVIEW.map((stage) => (
            <article key={stage.stage} className="rounded-xl border bg-muted/20 p-3">
              <p className="text-xs font-medium text-muted-foreground">{stage.stage}</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{stage.count}</p>
              <p className="mt-2 text-xs text-muted-foreground">{stage.description}</p>
            </article>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Selected lead detail</CardTitle>
            <CardDescription>{selectedLead.nameCompany}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-xl border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Detected need</p>
              <p className="mt-1 text-foreground">{selectedLead.detectedNeed}</p>
            </div>
            <div className="rounded-xl border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Next action</p>
              <p className="mt-1 text-foreground">{selectedLead.nextAction}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">Score {selectedLead.score}</Badge>
              <Badge variant="outline">Owner: {selectedLead.owner}</Badge>
              <Badge variant="outline">Status: {selectedLead.status}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">CRM sync readiness panel</CardTitle>
            <CardDescription>Preview-only state. No live CRM sync action is executed yet.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-muted-foreground">
            <div className="rounded-xl border bg-muted/20 p-3">
              <p className="text-xs font-medium text-foreground">Sync readiness</p>
              <p className="mt-1">Lead mappings, owner fields, and stage updates are prepared for implementation.</p>
            </div>
            <div className="rounded-xl border bg-muted/20 p-3">
              <p className="text-xs font-medium text-foreground">Integrations needed panel</p>
              <ul className="mt-1 list-disc space-y-1 ps-5">
                <li>HubSpot / Salesforce / Pipedrive credentials</li>
                <li>Google Sheets fallback mapping (optional)</li>
                <li>n8n workflow connection for write actions</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
