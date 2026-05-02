import React from 'react';
import { AgentCard } from '@/components/dashboard/agent-card';
import { AgentDetailPreview } from '@/components/dashboard/agent-detail-preview';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AGENT_CATALOG, findAgentById } from '@/lib/dashboard/agent-catalog';
import type { SearchParams } from '@/lib/types';

type Props = {
  searchParams?: Promise<SearchParams>;
};

async function resolveSearchParams(searchParams?: Promise<SearchParams>) {
  return (await searchParams) ?? {};
}

export default async function DashboardAgentsPage({ searchParams }: Props) {
  const params = await resolveSearchParams(searchParams);
  const selectedAgentId = typeof params.agent === 'string' ? params.agent : undefined;
  const selectedAgent = findAgentById(selectedAgentId ?? '');

  return (
    <section className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>AI Agents Hub</CardTitle>
          <CardDescription>
            Manage preview-ready and implementation-ready AI agents across website, social channels, voice, files, and CRM follow-up flows.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agent catalog</CardTitle>
            <CardDescription>Website Support, WhatsApp, Instagram, Messenger, Telegram, Voice, File Intake, CRM Follow-up.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 lg:grid-cols-2">
            {AGENT_CATALOG.map((agent) => (
              <AgentCard key={agent.id} agent={agent} isSelected={agent.id === selectedAgent.id} />
            ))}
          </CardContent>
        </Card>

        <AgentDetailPreview agent={selectedAgent} />
      </div>
    </section>
  );
}
