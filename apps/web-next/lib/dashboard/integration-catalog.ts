export type IntegrationStatus = 'Available by implementation' | 'Planned' | 'Needs credentials';

export type IntegrationCategory = 'AI Models' | 'Social/Chat' | 'CRM' | 'Support' | 'Ops' | 'Data/Backend' | 'Automation' | 'Hosting/Cloud';

export type IntegrationItem = {
  id: string;
  provider: string;
  category: IntegrationCategory;
  enables: string;
  status: IntegrationStatus;
};

export const INTEGRATION_CATALOG: IntegrationItem[] = [
  { id: 'openai', provider: 'OpenAI', category: 'AI Models', enables: 'Model responses, classification, and workflow reasoning.', status: 'Available by implementation' },
  { id: 'gemini', provider: 'Gemini', category: 'AI Models', enables: 'Alternative model routing and multimodal reasoning.', status: 'Needs credentials' },
  { id: 'groq', provider: 'Groq', category: 'AI Models', enables: 'Low-latency LLM inference for guided previews.', status: 'Available by implementation' },
  { id: 'openrouter', provider: 'OpenRouter', category: 'AI Models', enables: 'Model switching and fallback orchestration.', status: 'Needs credentials' },
  { id: 'whatsapp', provider: 'WhatsApp', category: 'Social/Chat', enables: 'Inbound/outbound WhatsApp conversation workflows.', status: 'Needs credentials' },
  { id: 'instagram', provider: 'Instagram', category: 'Social/Chat', enables: 'Instagram DM intake and response drafts.', status: 'Needs credentials' },
  { id: 'messenger', provider: 'Messenger', category: 'Social/Chat', enables: 'Messenger support and lead routing.', status: 'Needs credentials' },
  { id: 'telegram', provider: 'Telegram', category: 'Social/Chat', enables: 'Telegram bot message triage and routing.', status: 'Planned' },
  { id: 'hubspot', provider: 'HubSpot', category: 'CRM', enables: 'Lead sync and pipeline stage updates.', status: 'Available by implementation' },
  { id: 'salesforce', provider: 'Salesforce', category: 'CRM', enables: 'Enterprise CRM sync and owner assignment.', status: 'Planned' },
  { id: 'pipedrive', provider: 'Pipedrive', category: 'CRM', enables: 'Deal updates and follow-up automation.', status: 'Planned' },
  { id: 'sheets', provider: 'Google Sheets', category: 'CRM', enables: 'Lightweight lead export and reporting.', status: 'Available by implementation' },
  { id: 'zendesk', provider: 'Zendesk', category: 'Support', enables: 'Ticket creation and support escalation.', status: 'Planned' },
  { id: 'freshdesk', provider: 'Freshdesk', category: 'Support', enables: 'Support queue sync and status tracking.', status: 'Planned' },
  { id: 'intercom', provider: 'Intercom', category: 'Support', enables: 'Conversation routing and response assist.', status: 'Planned' },
  { id: 'calendar', provider: 'Google Calendar', category: 'Ops', enables: 'Meeting booking and follow-up scheduling.', status: 'Available by implementation' },
  { id: 'gmail', provider: 'Gmail', category: 'Ops', enables: 'Email follow-up draft delivery and notifications.', status: 'Needs credentials' },
  { id: 'slack', provider: 'Slack', category: 'Ops', enables: 'Internal alerts and handoff approvals.', status: 'Available by implementation' },
  { id: 'notion', provider: 'Notion', category: 'Ops', enables: 'Knowledge sync and team notes workflows.', status: 'Planned' },
  { id: 'supabase', provider: 'Supabase', category: 'Data/Backend', enables: 'Workspace persistence, RLS-secured data storage.', status: 'Available by implementation' },
  { id: 'postgresql', provider: 'PostgreSQL', category: 'Data/Backend', enables: 'Operational data store and analytics models.', status: 'Available by implementation' },
  { id: 'apis', provider: 'REST APIs', category: 'Data/Backend', enables: 'Custom system integrations and sync jobs.', status: 'Needs credentials' },
  { id: 'webhooks', provider: 'Webhooks', category: 'Data/Backend', enables: 'Trigger-based inbound and outbound events.', status: 'Available by implementation' },
  { id: 'n8n', provider: 'n8n', category: 'Automation', enables: 'Workflow orchestration and external tool automations.', status: 'Available by implementation' },
  { id: 'make', provider: 'Make', category: 'Automation', enables: 'No-code automation handoffs for operations teams.', status: 'Planned' },
  { id: 'zapier', provider: 'Zapier', category: 'Automation', enables: 'Connector bridge for common SaaS tools.', status: 'Planned' },
  { id: 'hostinger', provider: 'Hostinger', category: 'Hosting/Cloud', enables: 'Primary hosting and deployment surface.', status: 'Available by implementation' },
  { id: 'cloudflare', provider: 'Cloudflare', category: 'Hosting/Cloud', enables: 'Edge delivery, worker AI, and security controls.', status: 'Available by implementation' },
  { id: 'gcloud', provider: 'Google Cloud', category: 'Hosting/Cloud', enables: 'Scalable compute and data services.', status: 'Planned' },
];

export const INTEGRATION_CATEGORIES: IntegrationCategory[] = [
  'AI Models',
  'Social/Chat',
  'CRM',
  'Support',
  'Ops',
  'Data/Backend',
  'Automation',
  'Hosting/Cloud',
];
