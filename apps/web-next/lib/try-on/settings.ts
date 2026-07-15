/* ─── Try-On Agent — journey settings (per shop, dashboard-editable) ─── */

import 'server-only';

import { createClient } from '@supabase/supabase-js';

export type SettingsRow = Row;

export type TryOnSettings = {
  shop: string;
  buttonLabel: string;
  accentBg: string;
  accentFg: string;
  radiusPx: number;
  widgetTheme: 'light' | 'dark';
  /** Animated gradient badge behind the button icon. */
  iconBgFrom: string;
  iconBgTo: string;
  /** Loading animation style in the widget. */
  loadingStyle: 'steps' | 'pulse' | 'bar';
  /** Catalog pill: label and element sizing (px). */
  catalogLabel: string;
  catalogIconPx: number;
  catalogFontPx: number;
  catalogPadPx: number;
  /** Product-page button: icon badge size (px). */
  buttonIconPx: number;
  /** Result-screen CTA visibility. */
  showDownload: boolean;
  showWhatsapp: boolean;
  showAddToCart: boolean;
  showTryAgain: boolean;
  /** null = built-in localized disclaimer. */
  disclaimerText: string | null;
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
  iconBgFrom: '#ff9a3d',
  iconBgTo: '#ffd76e',
  loadingStyle: 'steps',
  catalogLabel: 'Try on',
  catalogIconPx: 14,
  catalogFontPx: 12,
  catalogPadPx: 6,
  buttonIconPx: 28,
  showDownload: true,
  showWhatsapp: true,
  showAddToCart: true,
  showTryAgain: true,
  disclaimerText: null,
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
  icon_bg_from: string | null;
  icon_bg_to: string | null;
  loading_style: string | null;
  catalog_label: string | null;
  catalog_icon_px: number | null;
  catalog_font_px: number | null;
  catalog_pad_px: number | null;
  button_icon_px: number | null;
  show_download: boolean | null;
  show_whatsapp: boolean | null;
  show_add_to_cart: boolean | null;
  show_try_again: boolean | null;
  disclaimer_text: string | null;
  loading_steps: string[] | null;
};

export function mergeSettings(base: TryOnSettings, row: Row | null): TryOnSettings {
  if (!row) return base;
  return {
    shop: row.shop,
    buttonLabel: row.button_label ?? base.buttonLabel,
    accentBg: row.accent_bg ?? base.accentBg,
    accentFg: row.accent_fg ?? base.accentFg,
    radiusPx: row.radius_px ?? base.radiusPx,
    // Explicit values must win over the inherited row, so 'light' and
    // 'steps' are matched too, not just the non-default variants.
    widgetTheme:
      row.widget_theme === 'light' || row.widget_theme === 'dark'
        ? row.widget_theme
        : base.widgetTheme,
    iconBgFrom: row.icon_bg_from ?? base.iconBgFrom,
    iconBgTo: row.icon_bg_to ?? base.iconBgTo,
    loadingStyle:
      row.loading_style === 'steps' ||
      row.loading_style === 'pulse' ||
      row.loading_style === 'bar'
        ? row.loading_style
        : base.loadingStyle,
    catalogLabel: row.catalog_label ?? base.catalogLabel,
    catalogIconPx: row.catalog_icon_px ?? base.catalogIconPx,
    catalogFontPx: row.catalog_font_px ?? base.catalogFontPx,
    catalogPadPx: row.catalog_pad_px ?? base.catalogPadPx,
    buttonIconPx: row.button_icon_px ?? base.buttonIconPx,
    showDownload: row.show_download ?? base.showDownload,
    showWhatsapp: row.show_whatsapp ?? base.showWhatsapp,
    showAddToCart: row.show_add_to_cart ?? base.showAddToCart,
    showTryAgain: row.show_try_again ?? base.showTryAgain,
    disclaimerText: row.disclaimer_text ?? base.disclaimerText,
    loadingSteps: row.loading_steps ?? base.loadingSteps,
  };
}

/** Default settings overlaid with the shop's row (if any). */
export async function getTryOnSettings(shop?: string | null): Promise<TryOnSettings> {
  try {
    return await loadSettings(shop);
  } catch (err) {
    // The embed must render even when settings storage is unreachable.
    console.error('getTryOnSettings failed:', err instanceof Error ? err.message : err);
    return DEFAULT_SETTINGS;
  }
}

async function loadSettings(shop?: string | null): Promise<TryOnSettings> {
  const supabase = getServiceClient();
  if (!supabase) return DEFAULT_SETTINGS;

  const shops = shop && shop !== 'default' ? ['default', shop] : ['default'];
  const { data, error } = await supabase
    .from('tryon_settings')
    .select('shop, button_label, accent_bg, accent_fg, radius_px, widget_theme, icon_bg_from, icon_bg_to, loading_style, loading_steps, catalog_label, catalog_icon_px, catalog_font_px, catalog_pad_px, button_icon_px, show_download, show_whatsapp, show_add_to_cart, show_try_again, disclaimer_text')
    .in('shop', shops);

  if (error || !data) return DEFAULT_SETTINGS;

  const defaults = mergeSettings(DEFAULT_SETTINGS, data.find((r) => r.shop === 'default') ?? null);
  const shopRow = shop ? (data.find((r) => r.shop === shop) ?? null) : null;
  return mergeSettings(defaults, shopRow);
}

const COLUMNS: Record<keyof Omit<TryOnSettings, 'shop'>, string> = {
  buttonLabel: 'button_label',
  accentBg: 'accent_bg',
  accentFg: 'accent_fg',
  radiusPx: 'radius_px',
  widgetTheme: 'widget_theme',
  iconBgFrom: 'icon_bg_from',
  iconBgTo: 'icon_bg_to',
  loadingStyle: 'loading_style',
  catalogLabel: 'catalog_label',
  catalogIconPx: 'catalog_icon_px',
  catalogFontPx: 'catalog_font_px',
  catalogPadPx: 'catalog_pad_px',
  buttonIconPx: 'button_icon_px',
  showDownload: 'show_download',
  showWhatsapp: 'show_whatsapp',
  showAddToCart: 'show_add_to_cart',
  showTryAgain: 'show_try_again',
  disclaimerText: 'disclaimer_text',
  loadingSteps: 'loading_steps',
};

export async function saveTryOnSettings(
  shop: string,
  values: Partial<Omit<TryOnSettings, 'shop'>>,
): Promise<boolean> {
  const supabase = getServiceClient();
  if (!supabase) return false;

  /* Only write columns the caller actually sent: a partial save (an older
     admin bundle, a future PATCH) must not reset everything else. */
  const payload: Record<string, unknown> = { shop, updated_at: new Date().toISOString() };
  for (const [key, column] of Object.entries(COLUMNS)) {
    if (Object.hasOwn(values, key)) {
      payload[column] = values[key as keyof typeof COLUMNS] ?? null;
    }
  }

  const { error } = await supabase.from('tryon_settings').upsert(payload);

  if (error) {
    console.error('tryon_settings upsert failed:', error.message);
    return false;
  }
  return true;
}

