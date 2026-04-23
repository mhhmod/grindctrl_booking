'use server';

import { normalizeSettingsJson, updateWidgetSite } from '@/lib/adapters/widgetSites';
import type { JsonObject, SettingsJson } from '@/lib/types';
import { getBrandingViewModel, getBrandingViewModelFromFormData, mergeBrandingViewModel, type BrandingViewModel } from '@/lib/view-models/branding';

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

export async function saveBrandingAction(
  context: { clerkUserId: string; siteId: string; currentSettings: SettingsJson },
  formData: FormData,
): Promise<BrandingFormState> {
  const values = getBrandingViewModelFromFormData(formData);

  try {
    const nextSettings = mergeBrandingViewModel(context.currentSettings, values);
    const updatedSite = await updateWidgetSite({
      clerkUserId: context.clerkUserId,
      siteId: context.siteId,
      settingsJson: nextSettings as JsonObject,
    });

    const normalizedSettings = normalizeSettingsJson(updatedSite.settings_json ?? nextSettings);

    return {
      status: 'success',
      message: 'Branding saved to settings_json.',
      values: getBrandingViewModel(normalizedSettings),
    };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unable to save branding.',
      values,
    };
  }
}
