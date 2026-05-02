export type TrialFunnelMetric = {
  label: string;
  value: number;
  note: string;
};

export type OperationsMetric = {
  label: string;
  value: number;
  note: string;
};

export type ChannelBreakdownMetric = {
  channel: string;
  value: number;
};

export const TRIAL_FUNNEL_PREVIEW: TrialFunnelMetric[] = [
  { label: 'Landing visit', value: 1240, note: 'Visitors entering guided workflow previews.' },
  { label: 'Guided preview', value: 488, note: 'Visitors who completed at least one guided preview.' },
  { label: 'Sign-up', value: 173, note: 'Visitors who created a trial account.' },
  { label: 'Dashboard review', value: 139, note: 'Signed-in users who reached dashboard overview.' },
  { label: 'Implementation request', value: 41, note: 'Users who prepared implementation request form.' },
];

export const OPERATIONS_METRICS_PREVIEW: OperationsMetric[] = [
  { label: 'Conversations routed', value: 352, note: 'Preview routing outcomes across web + social channels.' },
  { label: 'Leads prepared', value: 96, note: 'Leads with structured summaries and next actions.' },
  { label: 'Files processed', value: 57, note: 'Document/image previews processed by intake workflows.' },
  { label: 'Handoffs recommended', value: 44, note: 'Cases flagged for human review and implementation advice.' },
  { label: 'Workflows previewed', value: 621, note: 'Total guided workflow preview runs in trial mode.' },
];

export const CHANNEL_BREAKDOWN_PREVIEW: ChannelBreakdownMetric[] = [
  { channel: 'Website', value: 178 },
  { channel: 'WhatsApp', value: 64 },
  { channel: 'Instagram', value: 39 },
  { channel: 'Messenger', value: 31 },
  { channel: 'Telegram', value: 19 },
  { channel: 'Voice', value: 27 },
  { channel: 'Files', value: 22 },
];
