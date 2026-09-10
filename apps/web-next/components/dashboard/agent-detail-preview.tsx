import React from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { AgentCatalogItem } from '@/lib/dashboard/agent-catalog';
import { getAgentsCopy } from '@/lib/dashboard/dashboard-content-copy';
import type { SiteLocale } from '@/lib/landing/landing-i18n';

export function AgentDetailPreview({ agent, locale = 'en' }: { agent: AgentCatalogItem; locale?: SiteLocale }) {
  const c = getAgentsCopy(locale);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{c.selectedPreview}</Badge>
          <Badge variant="outline">{c.translate(agent.channel)}</Badge>
          <Badge variant="outline">{c.translate(agent.status)}</Badge>
        </div>
        <CardTitle>{c.translate(agent.name)}</CardTitle>
        <CardDescription>{c.translate(agent.businessPurpose)}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="rounded-xl border bg-muted/20 p-3">
          <p className="text-xs font-medium text-muted-foreground">{c.sampleTrigger}</p>
          <p className="mt-1 text-sm text-foreground">{c.translate(agent.sampleTrigger)}</p>
        </div>

        <div className="rounded-xl border bg-muted/20 p-3">
          <p className="text-xs font-medium text-muted-foreground">{c.sampleResponse}</p>
          <p className="mt-1 text-sm text-foreground">{c.translate(agent.sampleResponseAction)}</p>
        </div>

        <div className="rounded-xl border bg-muted/20 p-3">
          <p className="text-xs font-medium text-muted-foreground">{c.requiredIntegrations}</p>
          <ul className="mt-2 list-disc space-y-1 ps-5 text-sm text-foreground">
            {agent.requiredIntegrations.map((integration) => (
              <li key={integration}>{c.translate(integration)}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border bg-muted/20 p-3">
          <p className="text-xs font-medium text-muted-foreground">{c.nextStep}</p>
          <p className="mt-1 text-sm text-foreground">{c.translate(agent.nextStep)}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/dashboard/messenger?tab=conversations">{c.openPreviewInbox}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/implementation">{c.requestImplementation}</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
