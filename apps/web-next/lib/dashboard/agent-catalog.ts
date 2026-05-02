export type AgentPreviewStatus = 'Preview-ready' | 'Needs connection' | 'Planned';

export type AgentCatalogItem = {
  id: string;
  name: string;
  channel: string;
  businessPurpose: string;
  inputTypes: string[];
  outputsActions: string[];
  status: AgentPreviewStatus;
  sampleTrigger: string;
  sampleResponseAction: string;
  requiredIntegrations: string[];
  nextStep: string;
};

export const AGENT_CATALOG: AgentCatalogItem[] = [
  {
    id: 'website-support-agent',
    name: 'Website Support Agent',
    channel: 'Website',
    businessPurpose: 'Resolve support and service requests from website visitors.',
    inputTypes: ['Website chat message', 'Screenshot', 'File attachment'],
    outputsActions: ['Suggested answer', 'Intent tag', 'Handoff recommendation'],
    status: 'Preview-ready',
    sampleTrigger: 'Visitor asks for refund policy and shares an order number screenshot.',
    sampleResponseAction: 'Return policy answer + tag "billing_support" + queue handoff if confidence is low.',
    requiredIntegrations: ['Knowledge source', 'Ticketing system', 'Team inbox'],
    nextStep: 'Connect helpdesk and approval path for live ticket creation.',
  },
  {
    id: 'whatsapp-agent',
    name: 'WhatsApp Agent',
    channel: 'WhatsApp',
    businessPurpose: 'Handle sales and support conversations in WhatsApp threads.',
    inputTypes: ['Incoming WhatsApp message', 'Voice note', 'Media'],
    outputsActions: ['Reply draft', 'Lead extraction', 'Follow-up suggestion'],
    status: 'Needs connection',
    sampleTrigger: 'Lead asks for product pricing and shares use-case voice note.',
    sampleResponseAction: 'Draft pricing response + capture contact + mark for follow-up.',
    requiredIntegrations: ['WhatsApp Business API', 'CRM', 'Notification channel'],
    nextStep: 'Connect WhatsApp API credentials and map workspace routing rules.',
  },
  {
    id: 'instagram-agent',
    name: 'Instagram Agent',
    channel: 'Instagram',
    businessPurpose: 'Triage DMs and comments into support, sales, or operations queues.',
    inputTypes: ['Instagram DM', 'Comment mention', 'Story reply'],
    outputsActions: ['Intent class', 'Response draft', 'Escalation flag'],
    status: 'Needs connection',
    sampleTrigger: 'Follower asks for booking availability in DM.',
    sampleResponseAction: 'Generate response template + mark intent "booking_inquiry" + request human handoff when needed.',
    requiredIntegrations: ['Instagram messaging access', 'Calendar or booking system'],
    nextStep: 'Connect Instagram channel and publish approved response templates.',
  },
  {
    id: 'messenger-agent',
    name: 'Facebook/Messenger Agent',
    channel: 'Messenger',
    businessPurpose: 'Manage support and lead capture from Messenger conversations.',
    inputTypes: ['Messenger text', 'Quick replies', 'Attachments'],
    outputsActions: ['Suggested reply', 'Lead score', 'CRM payload preview'],
    status: 'Needs connection',
    sampleTrigger: 'Visitor requests product comparison and contact callback.',
    sampleResponseAction: 'Reply with comparison summary + capture callback preference + flag lead as high priority.',
    requiredIntegrations: ['Messenger API', 'CRM', 'Team notification tool'],
    nextStep: 'Enable Messenger webhook and map lead ownership rules.',
  },
  {
    id: 'telegram-agent',
    name: 'Telegram Agent',
    channel: 'Telegram',
    businessPurpose: 'Respond to Telegram messages and route requests by intent.',
    inputTypes: ['Telegram chat message', 'File', 'Voice note'],
    outputsActions: ['Intent routing', 'Response draft', 'Operations task suggestion'],
    status: 'Planned',
    sampleTrigger: 'User sends voice note requesting urgent account unlock.',
    sampleResponseAction: 'Transcribe voice + detect urgency + propose account-verification handoff.',
    requiredIntegrations: ['Telegram bot token', 'Identity workflow'],
    nextStep: 'Enable Telegram bot and security verification workflow.',
  },
  {
    id: 'voice-lead-agent',
    name: 'Voice Lead Agent',
    channel: 'Voice',
    businessPurpose: 'Convert voice interactions into structured lead records.',
    inputTypes: ['Recorded call', 'Voice note upload'],
    outputsActions: ['Transcript summary', 'Lead qualification score', 'Next action'],
    status: 'Preview-ready',
    sampleTrigger: 'Prospect leaves 30-second voice note requesting a proposal.',
    sampleResponseAction: 'Extract contact + summarize need + set urgency "high" and follow-up action.',
    requiredIntegrations: ['Speech-to-text provider', 'CRM'],
    nextStep: 'Connect telephony/call source and auto-save to workspace.',
  },
  {
    id: 'file-intake-agent',
    name: 'File Intake Agent',
    channel: 'Files',
    businessPurpose: 'Read uploaded files and prepare operational actions.',
    inputTypes: ['PDF', 'Image', 'Document upload'],
    outputsActions: ['Extracted entities', 'Workflow route', 'Prepared payload'],
    status: 'Preview-ready',
    sampleTrigger: 'User uploads invoice image and asks for processing.',
    sampleResponseAction: 'Extract invoice fields + classify as finance intake + propose system action.',
    requiredIntegrations: ['Storage bucket', 'Ops destination system'],
    nextStep: 'Connect storage and downstream processing workflow.',
  },
  {
    id: 'crm-follow-up-agent',
    name: 'CRM Follow-up Agent',
    channel: 'CRM',
    businessPurpose: 'Generate follow-up recommendations for CRM pipeline movement.',
    inputTypes: ['Lead status updates', 'Conversation context', 'Deal metadata'],
    outputsActions: ['Follow-up message draft', 'Pipeline stage recommendation', 'Owner reminder'],
    status: 'Planned',
    sampleTrigger: 'Qualified lead is idle for 3 days without owner action.',
    sampleResponseAction: 'Generate reminder sequence + recommend stage change to "Needs follow-up".',
    requiredIntegrations: ['CRM platform', 'Email or messaging channel'],
    nextStep: 'Enable CRM sync contract and owner notification rules.',
  },
];

export function findAgentById(agentId: string) {
  return AGENT_CATALOG.find((agent) => agent.id === agentId) ?? AGENT_CATALOG[0];
}
