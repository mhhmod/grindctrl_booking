import { describe, expect, it } from 'vitest';
import { AGENT_CATALOG } from '@/lib/dashboard/agent-catalog';

describe('agent catalog', () => {
  it('contains all required agent categories', () => {
    const names = AGENT_CATALOG.map((agent) => agent.name);

    expect(names).toEqual([
      'Website Support Agent',
      'WhatsApp Agent',
      'Instagram Agent',
      'Facebook/Messenger Agent',
      'Telegram Agent',
      'Voice Lead Agent',
      'File Intake Agent',
      'CRM Follow-up Agent',
    ]);
  });

  it('uses only supported preview status labels', () => {
    const statuses = new Set(AGENT_CATALOG.map((agent) => agent.status));
    expect(statuses).toEqual(new Set(['Preview-ready', 'Needs connection', 'Planned']));
  });
});
