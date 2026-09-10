import React from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { AgentCatalogItem } from '@/lib/dashboard/agent-catalog';
import { getAgentsCopy } from '@/lib/dashboard/dashboard-content-copy';
import type { SiteLocale } from '@/lib/landing/landing-i18n';

const STATUS_VARIANT: Record<AgentCatalogItem['status'], 'default' | 'secondary' | 'outline'> = {
  'Preview-ready': 'default',
  'Needs connection': 'secondary',
  Planned: 'outline',
};

export function AgentCard({ agent, isSelected, locale = 'en' }: { agent: AgentCatalogItem; isSelected: boolean; locale?: SiteLocale }) {
  const c = getAgentsCopy(locale);

  return (
    <article className="rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{c.translate(agent.channel)}</Badge>
        <Badge variant={STATUS_VARIANT[agent.status]}>{c.translate(agent.status)}</Badge>
      </div>

      <h3 className="mt-3 text-base font-semibold text-foreground">{c.translate(agent.name)}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{c.translate(agent.businessPurpose)}</p>

      <dl className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
        <div className="rounded-lg border bg-muted/20 p-2.5">
          <dt className="font-medium text-foreground">{c.inputs}</dt>
          <dd className="mt-1">{agent.inputTypes.map(c.translate).join(' • ')}</dd>
        </div>
        <div className="rounded-lg border bg-muted/20 p-2.5">
          <dt className="font-medium text-foreground">{c.outputsActions}</dt>
          <dd className="mt-1">{agent.outputsActions.map(c.translate).join(' • ')}</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild size="sm" variant={isSelected ? 'default' : 'outline'}>
          <Link href={`/dashboard/agents?agent=${encodeURIComponent(agent.id)}`}>{c.configurePreview}</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/dashboard/implementation">{c.requestImplementation}</Link>
        </Button>
        <Button asChild size="sm" variant="ghost">
          <Link href="/dashboard/messenger?tab=conversations">{c.viewConversations}</Link>
        </Button>
      </div>
    </article>
  );
}
