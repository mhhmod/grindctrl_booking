'use server';

import type { LeadSettingsFormState } from '@/app/dashboard/leads/state';
import { normalizeSettingsJson, updateWidgetSite } from '@/lib/adapters/widgetSites';
import { authorizeDashboardAction } from '@/lib/dashboard/action-authorization';
import type { JsonObject, SettingsJson } from '@/lib/types';
import { getLeadSettingsViewModel, getLeadSettingsViewModelFromFormData, mergeLeadSettingsViewModel, type LeadSettingsViewModel } from '@/lib/view-models/leads';

export async function saveLeadSettingsAction(
  context: { clerkUserId: string; siteId: string; currentSettings: SettingsJson },
  formData: FormData,
): Promise<LeadSettingsFormState> {
  const values = getLeadSettingsViewModelFromFormData(formData);
  const authorizationError = await authorizeDashboardAction(context);
  if (authorizationError) return { status: 'error', message: authorizationError, values };

  try {
    const nextSettings = mergeLeadSettingsViewModel(context.currentSettings, values);
    const updatedSite = await updateWidgetSite({
      clerkUserId: context.clerkUserId,
      siteId: context.siteId,
      settingsJson: nextSettings as unknown as JsonObject,
    });

    const normalizedSettings = normalizeSettingsJson(updatedSite.settings_json ?? nextSettings);

    return {
      status: 'success',
      message: 'Lead capture settings saved to settings_json.',
      values: getLeadSettingsViewModel(normalizedSettings),
    };
  } catch {
    return {
      status: 'error',
      message: 'Unable to save lead capture settings. Please try again shortly.',
      values,
    };
  }
}
