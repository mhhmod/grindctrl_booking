import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { WorkflowCatalog } from '@/components/dashboard/workflow-catalog';
import { WorkflowPreviewHistory } from '@/components/dashboard/workflow-preview-history';
import { getRequestLocale } from '@/lib/auth/locale';
import { getWorkflowsCopy } from '@/lib/dashboard/dashboard-content-copy';

export default async function DashboardWorkflowsPage() {
  const locale = await getRequestLocale();
  const c = getWorkflowsCopy(locale);
  return (
    <section className="grid gap-4">
      <WorkflowCatalog locale={locale} />
      <WorkflowPreviewHistory locale={locale} />
      <Card>
        <CardHeader>
          <CardTitle>{c.nextPhase}</CardTitle>
          <CardDescription>{c.nextPhaseDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {c.nextPhaseBody}
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
