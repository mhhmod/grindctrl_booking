import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { WORKFLOW_CATALOG, type WorkflowCatalogItem } from '@/lib/dashboard/workflow-catalog';
import { getWorkflowsCopy } from '@/lib/dashboard/dashboard-content-copy';
import type { SiteLocale } from '@/lib/landing/landing-i18n';

const STATUS_VARIANT: Record<WorkflowCatalogItem['status'], 'default' | 'secondary' | 'outline'> = {
  'Active preview': 'default',
  'Ready to connect': 'secondary',
  Planned: 'outline',
};

export function WorkflowCatalog({ locale = 'en' }: { locale?: SiteLocale }) {
  const c = getWorkflowsCopy(locale);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{c.catalogTitle}</CardTitle>
        <CardDescription>{c.catalogDescription}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 lg:grid-cols-2">
        {WORKFLOW_CATALOG.map((workflow) => (
          <article key={workflow.slug} className="rounded-xl border bg-muted/20 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">{c.translate(workflow.title)}</h3>
              <Badge variant={STATUS_VARIANT[workflow.status]}>{c.translate(workflow.status)}</Badge>
            </div>
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">{c.triggerInput}</dt>
                <dd className="text-foreground">{workflow.triggerInput}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{c.aiProcessing}</dt>
                <dd className="text-foreground">{workflow.aiProcessing}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{c.preparedOutput}</dt>
                <dd className="text-foreground">{workflow.preparedOutputAction}</dd>
              </div>
            </dl>
          </article>
        ))}
      </CardContent>
    </Card>
  );
}
