import type { SettingsJson } from '@/lib/types';
import { getLeadSettingsViewModel, type LeadSettingsViewModel } from '@/lib/view-models/leads';

export interface LeadSettingsFormState {
  status: 'idle' | 'success' | 'error';
  message: string | null;
  values: LeadSettingsViewModel;
}

export function getInitialLeadSettingsFormState(settings: SettingsJson): LeadSettingsFormState {
  return {
    status: 'idle',
    message: null,
    values: getLeadSettingsViewModel(settings),
  };
}
