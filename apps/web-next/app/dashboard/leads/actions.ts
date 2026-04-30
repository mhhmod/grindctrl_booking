'use server';

import type { LeadSettingsFormState } from '@/app/dashboard/leads/state';
import { normalizeSettingsJson, updateWidgetSite } from '@/lib/adapters/widgetSites';
import type { JsonObject, SettingsJson } from '@/lib/types';
import { getLeadSettingsViewModel, getLeadSettingsViewModelFromFormData, mergeLeadSettingsViewModel, type LeadSettingsViewModel } from '@/lib/view-models/leads';

export async function saveLeadSettingsAction(
  context: { clerkUserId: string; siteId: string; currentSettings: SettingsJson },
  formData: FormData,
): Promise<LeadSettingsFormState> {
  const values = getLeadSettingsViewModelFromFormData(formData);

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
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unable to save lead capture settings.',
      values,
    };
  }
}
