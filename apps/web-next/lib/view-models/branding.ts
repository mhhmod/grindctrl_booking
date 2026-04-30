import type { SettingsJson } from '@/lib/types';

export interface BrandingViewModel {
  brandName: string;
  assistantName: string;
  logoUrl: string;
  avatarUrl: string;
  launcherLabel: string;
  launcherIcon: string;
  themeMode: string;
  radiusStyle: string;
  widgetPosition: string;
  attributionMode: string;
  showPoweredBy: boolean;
}

export function getBrandingViewModel(settings: SettingsJson): BrandingViewModel {
  return {
    brandName: settings.branding.brand_name,
    assistantName: settings.branding.assistant_name,
    logoUrl: settings.branding.logo_url,
    avatarUrl: settings.branding.avatar_url,
    launcherLabel: settings.branding.launcher_label,
    launcherIcon: settings.branding.launcher_icon,
    themeMode: settings.branding.theme_mode,
    radiusStyle: settings.branding.radius_style,
    widgetPosition: settings.widget.position,
    attributionMode: settings.branding.attribution.mode,
    showPoweredBy: settings.branding.attribution.show_powered_by,
  };
}

export function mergeBrandingViewModel(settings: SettingsJson, value: BrandingViewModel): SettingsJson {
  return {
    ...settings,
    branding: {
      ...settings.branding,
      brand_name: value.brandName,
      assistant_name: value.assistantName,
      logo_url: value.logoUrl,
      avatar_url: value.avatarUrl,
      launcher_label: value.launcherLabel,
      launcher_icon: value.launcherIcon,
      theme_mode: value.themeMode,
      radius_style: value.radiusStyle,
      attribution: {
        ...settings.branding.attribution,
        mode: value.attributionMode,
        show_powered_by: value.showPoweredBy,
      },
    },
    widget: {
      ...settings.widget,
      position: value.widgetPosition,
    },
  };
}

export function getBrandingViewModelFromFormData(formData: FormData): BrandingViewModel {
  return {
    brandName: String(formData.get('brandName') ?? '').trim(),
    assistantName: String(formData.get('assistantName') ?? '').trim(),
    logoUrl: String(formData.get('logoUrl') ?? '').trim(),
    avatarUrl: String(formData.get('avatarUrl') ?? '').trim(),
    launcherLabel: String(formData.get('launcherLabel') ?? '').trim(),
    launcherIcon: String(formData.get('launcherIcon') ?? '').trim(),
    themeMode: String(formData.get('themeMode') ?? 'auto'),
    radiusStyle: String(formData.get('radiusStyle') ?? 'soft'),
    widgetPosition: String(formData.get('widgetPosition') ?? 'bottom-right'),
    attributionMode: String(formData.get('attributionMode') ?? 'auto'),
    showPoweredBy: formData.get('showPoweredBy') === 'on',
  };
}
