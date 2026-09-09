'use server';

import type { BrandingFormState } from '@/app/dashboard/branding/state';
import { normalizeSettingsJson, updateWidgetSite } from '@/lib/adapters/widgetSites';
import { authorizeDashboardAction } from '@/lib/dashboard/action-authorization';
import type { JsonObject, SettingsJson } from '@/lib/types';
import { getBrandingViewModel, getBrandingViewModelFromFormData, mergeBrandingViewModel, type BrandingViewModel } from '@/lib/view-models/branding';

export async function saveBrandingAction(
  context: { clerkUserId: string; siteId: string; currentSettings: SettingsJson },
  formData: FormData,
): Promise<BrandingFormState> {
  const values = getBrandingViewModelFromFormData(formData);
  const authorizationError = await authorizeDashboardAction(context);
  if (authorizationError) return { status: 'error', message: authorizationError, values };

  try {
    const nextSettings = mergeBrandingViewModel(context.currentSettings, values);
    const updatedSite = await updateWidgetSite({
      clerkUserId: context.clerkUserId,
      siteId: context.siteId,
      settingsJson: nextSettings as unknown as JsonObject,
    });

    const normalizedSettings = normalizeSettingsJson(updatedSite.settings_json ?? nextSettings);

    return {
      status: 'success',
      message: 'Branding saved to settings_json.',
      values: getBrandingViewModel(normalizedSettings),
    };
  } catch {
    return {
      status: 'error',
      message: 'Unable to save branding. Please try again shortly.',
      values,
    };
  }
}
