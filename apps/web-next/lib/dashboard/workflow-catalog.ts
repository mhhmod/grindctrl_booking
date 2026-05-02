export type WorkflowPreviewStatus = 'Active preview' | 'Ready to connect' | 'Planned';

export type WorkflowCatalogItem = {
  slug: string;
  title: string;
  triggerInput: string;
  aiProcessing: string;
  preparedOutputAction: string;
  status: WorkflowPreviewStatus;
};

export const WORKFLOW_CATALOG: WorkflowCatalogItem[] = [
  {
    slug: 'workflow-planner',
    title: 'Workflow Planner',
    triggerInput: 'Business goal, channel context, and workflow constraints.',
    aiProcessing: 'Maps intents, guardrails, and escalation checkpoints.',
    preparedOutputAction: 'Implementation-ready workflow blueprint.',
    status: 'Active preview',
  },
  {
    slug: 'voice-lead-capture',
    title: 'Voice Lead Capture',
    triggerInput: 'Voice note or call transcript.',
    aiProcessing: 'Transcribes, extracts entities, and scores qualification.',
    preparedOutputAction: 'CRM-ready lead summary and next follow-up action.',
    status: 'Active preview',
  },
  {
    slug: 'file-image-intake',
    title: 'File/Image Intake',
    triggerInput: 'Uploaded document or image.',
    aiProcessing: 'Extracts key fields and classifies workflow intent.',
    preparedOutputAction: 'Operations payload and routing recommendation.',
    status: 'Active preview',
  },
  {
    slug: 'ai-customer-support',
    title: 'AI Customer Support',
    triggerInput: 'Customer support message and optional attachments.',
    aiProcessing: 'Intent classification, policy lookup, and response drafting.',
    preparedOutputAction: 'Support response draft and handoff trigger.',
    status: 'Ready to connect',
  },
  {
    slug: 'crm-lead-qualification',
    title: 'CRM Lead Qualification',
    triggerInput: 'Conversation + profile context + lead metadata.',
    aiProcessing: 'Scores urgency and readiness for CRM stage movement.',
    preparedOutputAction: 'Qualified lead packet with owner recommendation.',
    status: 'Ready to connect',
  },
  {
    slug: 'social-inbox-routing',
    title: 'Social Inbox Routing',
    triggerInput: 'Instagram/Messenger/WhatsApp/Telegram message.',
    aiProcessing: 'Normalizes channel payload and detects intent.',
    preparedOutputAction: 'Response draft and queue routing outcome.',
    status: 'Planned',
  },
  {
    slug: 'implementation-request',
    title: 'Implementation Request',
    triggerInput: 'Submitted implementation request form.',
    aiProcessing: 'Scores urgency and prepares team handoff envelope.',
    preparedOutputAction: 'Prepared request summary for workspace storage + notifications.',
    status: 'Planned',
  },
];
