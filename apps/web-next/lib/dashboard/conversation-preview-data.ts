export type ConversationChannel = 'Website' | 'WhatsApp' | 'Instagram' | 'Messenger' | 'Telegram' | 'Voice';

export type ConversationStatus = 'New' | 'In progress' | 'Handoff needed' | 'Resolved';

export type ConversationPreviewItem = {
  id: string;
  channel: ConversationChannel;
  status: ConversationStatus;
  customerName: string;
  company: string;
  contact: string;
  lastMessageAt: string;
  customerMessage: string;
  aiSuggestedResponse: string;
  detectedIntent: string;
  leadScore: number;
  recommendedAction: string;
  handoffPreviewReason: string;
};

export const CONVERSATION_PREVIEW_DATA: ConversationPreviewItem[] = [
  {
    id: 'conv_web_001',
    channel: 'Website',
    status: 'New',
    customerName: 'Maya Ahmed',
    company: 'North Clinic',
    contact: 'maya@northclinic.example',
    lastMessageAt: '2 min ago',
    customerMessage: 'Can you setup support automation and connect our website widget this week?',
    aiSuggestedResponse: 'Yes. We can map your support workflow and prepare widget install steps during your trial review.',
    detectedIntent: 'Implementation timeline inquiry',
    leadScore: 82,
    recommendedAction: 'Share implementation flow and request preferred launch date.',
    handoffPreviewReason: 'Needs commercial scope confirmation from operations owner.',
  },
  {
    id: 'conv_wa_002',
    channel: 'WhatsApp',
    status: 'In progress',
    customerName: 'Yousef Karim',
    company: 'Prime Dent',
    contact: '+20 10 1234 5678',
    lastMessageAt: '8 min ago',
    customerMessage: 'Voice note sent with lead details. Need CRM update draft.',
    aiSuggestedResponse: 'Voice summary ready. We prepared lead profile and recommended CRM fields for your review.',
    detectedIntent: 'Voice lead capture',
    leadScore: 76,
    recommendedAction: 'Confirm lead owner and move to CRM-ready queue.',
    handoffPreviewReason: 'No handoff needed if owner is assigned.',
  },
  {
    id: 'conv_ig_003',
    channel: 'Instagram',
    status: 'Handoff needed',
    customerName: 'Lina Noor',
    company: 'Skyline Beauty',
    contact: '@linanoor',
    lastMessageAt: '21 min ago',
    customerMessage: 'Need custom pricing and SLA details before onboarding.',
    aiSuggestedResponse: 'Thanks for sharing. We prepared a draft summary and can route this to implementation review.',
    detectedIntent: 'Pricing and SLA request',
    leadScore: 88,
    recommendedAction: 'Escalate to implementation advisor for pricing scope.',
    handoffPreviewReason: 'Commercial terms require human confirmation.',
  },
  {
    id: 'conv_voice_004',
    channel: 'Voice',
    status: 'Resolved',
    customerName: 'Omar Salah',
    company: 'Nova Logistics',
    contact: 'omar@novalogistics.example',
    lastMessageAt: '45 min ago',
    customerMessage: 'Uploaded call recording for intake workflow setup.',
    aiSuggestedResponse: 'Call summary was processed and mapped to file intake + operations workflow preview.',
    detectedIntent: 'File and operations intake',
    leadScore: 70,
    recommendedAction: 'Review prepared workflow and save to trial review.',
    handoffPreviewReason: 'Closed in preview after workflow summary delivery.',
  },
];

export function findConversationById(conversationId: string) {
  return CONVERSATION_PREVIEW_DATA.find((conversation) => conversation.id === conversationId) ?? CONVERSATION_PREVIEW_DATA[0];
}
