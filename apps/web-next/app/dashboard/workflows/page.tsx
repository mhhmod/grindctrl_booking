import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { WorkflowCatalog } from '@/components/dashboard/workflow-catalog';
import { WorkflowPreviewHistory } from '@/components/dashboard/workflow-preview-history';

export default function DashboardWorkflowsPage() {
  return (
    <section className="grid gap-4">
      <WorkflowCatalog />
      <WorkflowPreviewHistory />
      <Card>
        <CardHeader>
          <CardTitle>Next phase</CardTitle>
          <CardDescription>Preview history persistence roadmap.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Saved workflow history will be stored in your workspace after persistence is enabled.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
