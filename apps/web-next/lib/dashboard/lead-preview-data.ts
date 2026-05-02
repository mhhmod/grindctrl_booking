export type LeadPreviewStatus = 'New' | 'Qualified' | 'Needs follow-up' | 'Implementation requested' | 'Closed';

export type LeadSourceChannel = 'Website' | 'WhatsApp' | 'Instagram' | 'Messenger' | 'Telegram' | 'Voice' | 'Files';

export type CrmPipelineStage = 'Captured' | 'Qualified' | 'Proposal' | 'Implementation' | 'Converted';

export type LeadPreviewRecord = {
  id: string;
  source: string;
  sourceChannel: LeadSourceChannel;
  nameCompany: string;
  score: number;
  status: LeadPreviewStatus;
  detectedNeed: string;
  owner: string;
  nextAction: string;
  createdTime: string;
};

export type CrmStageSummary = {
  stage: CrmPipelineStage;
  count: number;
  description: string;
};

export const LEAD_PREVIEW_DATA: LeadPreviewRecord[] = [
  {
    id: 'lead_001',
    source: 'Website widget',
    sourceChannel: 'Website',
    nameCompany: 'Maya Ahmed / North Clinic',
    score: 82,
    status: 'Qualified',
    detectedNeed: 'Support automation + live widget install',
    owner: 'Ops Team',
    nextAction: 'Share implementation timeline and confirm channels.',
    createdTime: 'Today, 11:20',
  },
  {
    id: 'lead_002',
    source: 'Voice lead capture',
    sourceChannel: 'Voice',
    nameCompany: 'Omar Salah / Nova Logistics',
    score: 74,
    status: 'Needs follow-up',
    detectedNeed: 'File intake and dispatch workflow',
    owner: 'AI Advisor',
    nextAction: 'Review extracted entities and assign integration owner.',
    createdTime: 'Today, 10:05',
  },
  {
    id: 'lead_003',
    source: 'Instagram DM',
    sourceChannel: 'Instagram',
    nameCompany: 'Lina Noor / Skyline Beauty',
    score: 88,
    status: 'Implementation requested',
    detectedNeed: 'CRM sync and social support response automation',
    owner: 'Implementation Team',
    nextAction: 'Prepare solution outline and integration checklist.',
    createdTime: 'Yesterday, 17:42',
  },
  {
    id: 'lead_004',
    source: 'WhatsApp thread',
    sourceChannel: 'WhatsApp',
    nameCompany: 'Yousef Karim / Prime Dent',
    score: 61,
    status: 'New',
    detectedNeed: 'Lead qualification with calendar follow-up',
    owner: 'Unassigned',
    nextAction: 'Assign owner and verify preferred contact channel.',
    createdTime: 'Yesterday, 14:18',
  },
  {
    id: 'lead_005',
    source: 'File upload workflow',
    sourceChannel: 'Files',
    nameCompany: 'Hana Ali / Bright Office',
    score: 53,
    status: 'Closed',
    detectedNeed: 'Invoice extraction trial only',
    owner: 'Ops Team',
    nextAction: 'No action. Preview closed after review.',
    createdTime: '2 days ago',
  },
];

export const CRM_PIPELINE_PREVIEW: CrmStageSummary[] = [
  {
    stage: 'Captured',
    count: 14,
    description: 'Leads captured from conversations, voice, forms, and file workflows.',
  },
  {
    stage: 'Qualified',
    count: 9,
    description: 'Leads with enough context for sales/service owner review.',
  },
  {
    stage: 'Proposal',
    count: 5,
    description: 'Leads awaiting implementation plan and integration scope alignment.',
  },
  {
    stage: 'Implementation',
    count: 3,
    description: 'Approved leads preparing connector rollout and workflow setup.',
  },
  {
    stage: 'Converted',
    count: 1,
    description: 'Leads converted into active implementation track.',
  },
];
