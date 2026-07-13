/* ─── Try-On Agent — journey settings (per shop, dashboard-editable) ─── */

import 'server-only';

import { createClient } from '@supabase/supabase-js';

export type TryOnSettings = {
  shop: string;
  buttonLabel: string;
  accentBg: string;
  accentFg: string;
  radiusPx: number;
  widgetTheme: 'light' | 'dark';
  /** null → use the built-in localized loading steps */
  loadingSteps: string[] | null;
};

export const DEFAULT_SETTINGS: TryOnSettings = {
  shop: 'default',
  buttonLabel: 'Try it on with AI',
  accentBg: '#2a2826',
  accentFg: '#f0ede9',
  radiusPx: 999,
  widgetTheme: 'light',
  loadingSteps: null,
};

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
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
  loading_steps: string[] | null;
};

function merge(base: TryOnSettings, row: Row | null): TryOnSettings {
  if (!row) return base;
  return {
    shop: row.shop,
    buttonLabel: row.button_label ?? base.buttonLabel,
    accentBg: row.accent_bg ?? base.accentBg,
    accentFg: row.accent_fg ?? base.accentFg,
    radiusPx: row.radius_px ?? base.radiusPx,
    widgetTheme: row.widget_theme === 'dark' ? 'dark' : base.widgetTheme,
    loadingSteps: row.loading_steps ?? base.loadingSteps,
  };
}

/** Default settings overlaid with the shop's row (if any). */
export async function getTryOnSettings(shop?: string | null): Promise<TryOnSettings> {
  const supabase = getServiceClient();
  if (!supabase) return DEFAULT_SETTINGS;

  const shops = shop && shop !== 'default' ? ['default', shop] : ['default'];
  const { data, error } = await supabase
    .from('tryon_settings')
    .select('shop, button_label, accent_bg, accent_fg, radius_px, widget_theme, loading_steps')
    .in('shop', shops);

  if (error || !data) return DEFAULT_SETTINGS;

  const defaults = merge(DEFAULT_SETTINGS, data.find((r) => r.shop === 'default') ?? null);
  const shopRow = shop ? (data.find((r) => r.shop === shop) ?? null) : null;
  return merge(defaults, shopRow);
}

export async function saveTryOnSettings(
  shop: string,
  values: Partial<Omit<TryOnSettings, 'shop'>>,
): Promise<boolean> {
  const supabase = getServiceClient();
  if (!supabase) return false;

  const { error } = await supabase.from('tryon_settings').upsert({
    shop,
    button_label: values.buttonLabel ?? null,
    accent_bg: values.accentBg ?? null,
    accent_fg: values.accentFg ?? null,
    radius_px: values.radiusPx ?? null,
    widget_theme: values.widgetTheme ?? null,
    loading_steps: values.loadingSteps ?? null,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error('tryon_settings upsert failed:', error.message);
    return false;
  }
  return true;
}
