import type { SettingsJson } from '@/lib/types';

export const LEAD_FIELD_OPTIONS = ['name', 'email', 'phone', 'company'] as const;
export const LEAD_CAPTURE_TIMING_OPTIONS = ['off', 'pre_chat', 'post_chat'] as const;
export const LEAD_DEDUPE_MODE_OPTIONS = ['session', 'email', 'none'] as const;
export const LEAD_CONSENT_MODE_OPTIONS = ['none', 'optional', 'required'] as const;

export interface LeadSettingsViewModel {
  enabled: boolean;
  captureTiming: string;
  fields: string[];
  requiredFields: string[];
  promptTitle: string;
  promptSubtitle: string;
  skippable: boolean;
  dedupeMode: string;
  consentMode: string;
  consentText: string;
  privacyUrl: string;
}

function sanitizeSelectedFields(values: string[]) {
  return LEAD_FIELD_OPTIONS.filter((field) => values.includes(field));
}

export function getLeadSettingsViewModel(settings: SettingsJson): LeadSettingsViewModel {
  return {
    enabled: settings.leads.enabled,
    captureTiming: settings.leads.capture_timing,
    fields: sanitizeSelectedFields(settings.leads.fields),
    requiredFields: sanitizeSelectedFields(settings.leads.required_fields),
    promptTitle: settings.leads.prompt_title,
    promptSubtitle: settings.leads.prompt_subtitle,
    skippable: settings.leads.skippable,
    dedupeMode: settings.leads.dedupe.mode,
    consentMode: settings.leads.consent.mode,
    consentText: settings.leads.consent.text,
    privacyUrl: settings.leads.consent.privacy_url,
  };
}

export function mergeLeadSettingsViewModel(settings: SettingsJson, value: LeadSettingsViewModel): SettingsJson {
  return {
    ...settings,
    leads: {
      ...settings.leads,
      enabled: value.enabled,
      capture_timing: value.captureTiming,
      fields: sanitizeSelectedFields(value.fields),
      required_fields: sanitizeSelectedFields(value.requiredFields),
      prompt_title: value.promptTitle,
      prompt_subtitle: value.promptSubtitle,
      skippable: value.skippable,
      dedupe: {
        ...settings.leads.dedupe,
        mode: value.dedupeMode,
      },
      consent: {
        ...settings.leads.consent,
        mode: value.consentMode,
        text: value.consentText,
        privacy_url: value.privacyUrl,
      },
    },
  };
}

export function getLeadSettingsViewModelFromFormData(formData: FormData): LeadSettingsViewModel {
  const fields = sanitizeSelectedFields(formData.getAll('fields').map(String));
  const requiredFields = sanitizeSelectedFields(formData.getAll('requiredFields').map(String)).filter((field) => fields.includes(field));

  return {
    enabled: formData.get('enabled') === 'on',
    captureTiming: String(formData.get('captureTiming') ?? 'off'),
    fields,
    requiredFields,
    promptTitle: String(formData.get('promptTitle') ?? '').trim(),
    promptSubtitle: String(formData.get('promptSubtitle') ?? '').trim(),
    skippable: formData.get('skippable') === 'on',
    dedupeMode: String(formData.get('dedupeMode') ?? 'session'),
    consentMode: String(formData.get('consentMode') ?? 'none'),
    consentText: String(formData.get('consentText') ?? '').trim(),
    privacyUrl: String(formData.get('privacyUrl') ?? '').trim(),
  };
}
