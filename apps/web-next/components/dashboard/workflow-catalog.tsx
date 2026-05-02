import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { WORKFLOW_CATALOG, type WorkflowCatalogItem } from '@/lib/dashboard/workflow-catalog';

const STATUS_VARIANT: Record<WorkflowCatalogItem['status'], 'default' | 'secondary' | 'outline'> = {
  'Active preview': 'default',
  'Ready to connect': 'secondary',
  Planned: 'outline',
};

export function WorkflowCatalog() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Workflow catalog</CardTitle>
        <CardDescription>Preview modules explain trigger, AI processing, and prepared output/action.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 lg:grid-cols-2">
        {WORKFLOW_CATALOG.map((workflow) => (
          <article key={workflow.slug} className="rounded-xl border bg-muted/20 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">{workflow.title}</h3>
              <Badge variant={STATUS_VARIANT[workflow.status]}>{workflow.status}</Badge>
            </div>
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Trigger / input</dt>
                <dd className="text-foreground">{workflow.triggerInput}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">AI processing</dt>
                <dd className="text-foreground">{workflow.aiProcessing}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Prepared output / action</dt>
                <dd className="text-foreground">{workflow.preparedOutputAction}</dd>
              </div>
            </dl>
          </article>
        ))}
      </CardContent>
    </Card>
  );
}
