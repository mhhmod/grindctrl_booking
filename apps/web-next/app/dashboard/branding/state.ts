import type { SettingsJson } from '@/lib/types';
import { getBrandingViewModel, type BrandingViewModel } from '@/lib/view-models/branding';

export interface BrandingFormState {
  status: 'idle' | 'success' | 'error';
  message: string | null;
  values: BrandingViewModel;
}

export function getInitialBrandingFormState(settings: SettingsJson): BrandingFormState {
  return {
    status: 'idle',
    message: null,
    values: getBrandingViewModel(settings),
  };
}
