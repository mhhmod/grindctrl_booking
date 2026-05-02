import React from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { AgentCatalogItem } from '@/lib/dashboard/agent-catalog';

const STATUS_VARIANT: Record<AgentCatalogItem['status'], 'default' | 'secondary' | 'outline'> = {
  'Preview-ready': 'default',
  'Needs connection': 'secondary',
  Planned: 'outline',
};

export function AgentCard({ agent, isSelected }: { agent: AgentCatalogItem; isSelected: boolean }) {
  return (
    <article className="rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{agent.channel}</Badge>
        <Badge variant={STATUS_VARIANT[agent.status]}>{agent.status}</Badge>
      </div>

      <h3 className="mt-3 text-base font-semibold text-foreground">{agent.name}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{agent.businessPurpose}</p>

      <dl className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
        <div className="rounded-lg border bg-muted/20 p-2.5">
          <dt className="font-medium text-foreground">Inputs</dt>
          <dd className="mt-1">{agent.inputTypes.join(' • ')}</dd>
        </div>
        <div className="rounded-lg border bg-muted/20 p-2.5">
          <dt className="font-medium text-foreground">Outputs / actions</dt>
          <dd className="mt-1">{agent.outputsActions.join(' • ')}</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild size="sm" variant={isSelected ? 'default' : 'outline'}>
          <Link href={`/dashboard/agents?agent=${encodeURIComponent(agent.id)}`}>Configure preview</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/dashboard/implementation">Request implementation</Link>
        </Button>
        <Button asChild size="sm" variant="ghost">
          <Link href="/dashboard/conversations">View conversations</Link>
        </Button>
      </div>
    </article>
  );
}
