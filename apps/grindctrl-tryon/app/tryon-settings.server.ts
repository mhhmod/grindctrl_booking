/* Per-shop try-on journey settings, shared with the GrindCTRL dashboard
   (same Supabase table: shop row overlays the 'default' row). */

import { createClient } from '@supabase/supabase-js';

export type TryOnSettings = {
  buttonLabel: string;
  accentBg: string;
  accentFg: string;
  radiusPx: number;
  widgetTheme: 'light' | 'dark';
  iconBgFrom: string;
  iconBgTo: string;
  loadingSteps: string[] | null;
};

const DEFAULTS: TryOnSettings = {
  buttonLabel: 'Try it on with AI',
  accentBg: '#2a2826',
  accentFg: '#f0ede9',
  radiusPx: 999,
  widgetTheme: 'light',
  iconBgFrom: '#ff9a3d',
  iconBgTo: '#ffd76e',
  loadingSteps: null,
};

function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

type Row = {
  shop: string;
  button_label: string | null;
  accent_bg: string | null;
  accent_fg: string | null;
  radius_px: number | null;
  widget_theme: string | null;
  icon_bg_from: string | null;
  icon_bg_to: string | null;
  loading_steps: string[] | null;
};

function merge(base: TryOnSettings, row: Row | null): TryOnSettings {
  if (!row) return base;
  return {
    buttonLabel: row.button_label ?? base.buttonLabel,
    accentBg: row.accent_bg ?? base.accentBg,
    accentFg: row.accent_fg ?? base.accentFg,
    radiusPx: row.radius_px ?? base.radiusPx,
    widgetTheme: row.widget_theme === 'dark' ? 'dark' : base.widgetTheme,
    iconBgFrom: row.icon_bg_from ?? base.iconBgFrom,
    iconBgTo: row.icon_bg_to ?? base.iconBgTo,
    loadingSteps: row.loading_steps ?? base.loadingSteps,
  };
}

export async function getSettingsForShop(shop: string): Promise<TryOnSettings> {
  const supabase = getClient();
  if (!supabase) return DEFAULTS;

  const { data, error } = await supabase
    .from('tryon_settings')
    .select('shop, button_label, accent_bg, accent_fg, radius_px, widget_theme, icon_bg_from, icon_bg_to, loading_steps')
    .in('shop', ['default', shop]);

  if (error || !data) return DEFAULTS;

  const withDefaults = merge(DEFAULTS, data.find((r) => r.shop === 'default') ?? null);
  return merge(withDefaults, data.find((r) => r.shop === shop) ?? null);
}

export async function saveSettingsForShop(
  shop: string,
  values: Partial<TryOnSettings>,
): Promise<boolean> {
  const supabase = getClient();
  if (!supabase) return false;

  const { error } = await supabase.from('tryon_settings').upsert({
    shop,
    button_label: values.buttonLabel ?? null,
    accent_bg: values.accentBg ?? null,
    accent_fg: values.accentFg ?? null,
    radius_px: values.radiusPx ?? null,
    widget_theme: values.widgetTheme ?? null,
    icon_bg_from: values.iconBgFrom ?? null,
    icon_bg_to: values.iconBgTo ?? null,
    loading_steps: values.loadingSteps ?? null,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error('tryon_settings upsert failed:', error.message);
    return false;
  }
  return true;
}
