import React from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { AgentCatalogItem } from '@/lib/dashboard/agent-catalog';

export function AgentDetailPreview({ agent }: { agent: AgentCatalogItem }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Selected agent preview</Badge>
          <Badge variant="outline">{agent.channel}</Badge>
          <Badge variant="outline">{agent.status}</Badge>
        </div>
        <CardTitle>{agent.name}</CardTitle>
        <CardDescription>{agent.businessPurpose}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="rounded-xl border bg-muted/20 p-3">
          <p className="text-xs font-medium text-muted-foreground">Sample trigger</p>
          <p className="mt-1 text-sm text-foreground">{agent.sampleTrigger}</p>
        </div>

        <div className="rounded-xl border bg-muted/20 p-3">
          <p className="text-xs font-medium text-muted-foreground">Sample response / action</p>
          <p className="mt-1 text-sm text-foreground">{agent.sampleResponseAction}</p>
        </div>

        <div className="rounded-xl border bg-muted/20 p-3">
          <p className="text-xs font-medium text-muted-foreground">Required integrations</p>
          <ul className="mt-2 list-disc space-y-1 ps-5 text-sm text-foreground">
            {agent.requiredIntegrations.map((integration) => (
              <li key={integration}>{integration}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border bg-muted/20 p-3">
          <p className="text-xs font-medium text-muted-foreground">Next step</p>
          <p className="mt-1 text-sm text-foreground">{agent.nextStep}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/dashboard/conversations">Open preview inbox</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/implementation">Request implementation</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
