import React from 'react';
import { AgentCard } from '@/components/dashboard/agent-card';
import { AgentDetailPreview } from '@/components/dashboard/agent-detail-preview';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AGENT_CATALOG, findAgentById } from '@/lib/dashboard/agent-catalog';
import type { SearchParams } from '@/lib/types';
import { getRequestLocale } from '@/lib/auth/locale';
import { getAgentsCopy } from '@/lib/dashboard/dashboard-content-copy';

type Props = {
  searchParams?: Promise<SearchParams>;
};

async function resolveSearchParams(searchParams?: Promise<SearchParams>) {
  return (await searchParams) ?? {};
}

export default async function DashboardAgentsPage({ searchParams }: Props) {
  const locale = await getRequestLocale();
  const c = getAgentsCopy(locale);
  const params = await resolveSearchParams(searchParams);
  const selectedAgentId = typeof params.agent === 'string' ? params.agent : undefined;
  const selectedAgent = findAgentById(selectedAgentId ?? '');

  return (
    <section className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{c.hubTitle}</CardTitle>
          <CardDescription>
            {c.hubDescription}
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{c.catalogTitle}</CardTitle>
            <CardDescription>{c.catalogDescription}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 lg:grid-cols-2">
            {AGENT_CATALOG.map((agent) => (
              <AgentCard key={agent.id} agent={agent} isSelected={agent.id === selectedAgent.id} locale={locale} />
            ))}
          </CardContent>
        </Card>

        <AgentDetailPreview agent={selectedAgent} locale={locale} />
      </div>
    </section>
  );
}
