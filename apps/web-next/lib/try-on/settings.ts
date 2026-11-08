/* ─── Try-On Agent — journey settings (per shop, dashboard-editable) ─── */

import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { invalidateProxyConfig } from '@/lib/shopify/proxy-config-cache';

export type SettingsRow = Row;

export type TryOnSettings = {
  shop: string;
  /** The storefront Try-On button, on every platform. false hides it from
      shoppers (launch reason `paused`); a missing value means on. */
  showButton: boolean;
  buttonLabel: string;
  /* Arabic variants of the strings the merchant writes. null or blank means
     "not translated": the widget falls back to the default-language value
     rather than rendering an empty control. */
  buttonLabelAr: string | null;
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
  catalogLabelAr: string | null;
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
  disclaimerTextAr: string | null;
  /** null → use the built-in localized loading steps */
  loadingSteps: string[] | null;
};

export const DEFAULT_SETTINGS: TryOnSettings = {
  shop: 'default',
  showButton: true,
  buttonLabel: 'Try it on with AI',
  buttonLabelAr: 'جرّبها بالذكاء الاصطناعي',
  accentBg: '#2a2826',
  accentFg: '#f0ede9',
  radiusPx: 999,
  widgetTheme: 'light',
  iconBgFrom: '#ff9a3d',
  iconBgTo: '#ffd76e',
  loadingStyle: 'steps',
  catalogLabel: 'Try on',
  catalogLabelAr: 'جرّب',
  catalogIconPx: 14,
  catalogFontPx: 12,
  catalogPadPx: 6,
  buttonIconPx: 28,
  showDownload: true,
  showWhatsapp: true,
  showAddToCart: true,
  showTryAgain: true,
  disclaimerText: null,
  disclaimerTextAr: null,
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
  /* Absent until supabase/20261108_tryon_show_button.sql runs. */
  show_button?: boolean | null;
  button_label: string | null;
  button_label_ar: string | null;
  accent_bg: string | null;
  accent_fg: string | null;
  radius_px: number | null;
  widget_theme: string | null;
  icon_bg_from: string | null;
  icon_bg_to: string | null;
  loading_style: string | null;
  catalog_label: string | null;
  catalog_label_ar: string | null;
  catalog_icon_px: number | null;
  catalog_font_px: number | null;
  catalog_pad_px: number | null;
  button_icon_px: number | null;
  show_download: boolean | null;
  show_whatsapp: boolean | null;
  show_add_to_cart: boolean | null;
  show_try_again: boolean | null;
  disclaimer_text: string | null;
  disclaimer_text_ar: string | null;
  loading_steps: string[] | null;
};

export function mergeSettings(base: TryOnSettings, row: Row | null): TryOnSettings {
  if (!row) return base;
  return {
    shop: row.shop,
    showButton: row.show_button ?? base.showButton,
    buttonLabel: row.button_label ?? base.buttonLabel,
    buttonLabelAr: row.button_label_ar ?? base.buttonLabelAr,
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
    catalogLabelAr: row.catalog_label_ar ?? base.catalogLabelAr,
    catalogIconPx: row.catalog_icon_px ?? base.catalogIconPx,
    catalogFontPx: row.catalog_font_px ?? base.catalogFontPx,
    catalogPadPx: row.catalog_pad_px ?? base.catalogPadPx,
    buttonIconPx: row.button_icon_px ?? base.buttonIconPx,
    showDownload: row.show_download ?? base.showDownload,
    showWhatsapp: row.show_whatsapp ?? base.showWhatsapp,
    showAddToCart: row.show_add_to_cart ?? base.showAddToCart,
    showTryAgain: row.show_try_again ?? base.showTryAgain,
    disclaimerText: row.disclaimer_text ?? base.disclaimerText,
    disclaimerTextAr: row.disclaimer_text_ar ?? base.disclaimerTextAr,
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

/** For an editor that saves every field, as the v16 Set up does: a failed
    read throws rather than showing the defaults, which a save would then
    write over the shop's own settings. */
export async function getTryOnSettingsForEdit(shop: string): Promise<TryOnSettings> {
  return loadSettings(shop, { strict: true });
}

async function loadSettings(shop?: string | null, { strict = false }: { strict?: boolean } = {}): Promise<TryOnSettings> {
  const supabase = getServiceClient();
  if (!supabase) {
    if (strict) throw new Error('try-on settings storage is not configured');
    return DEFAULT_SETTINGS;
  }

  const shops = shop && shop !== 'default' ? ['default', shop] : ['default'];
  const select = (columns: string) => supabase.from('tryon_settings').select(columns).in('shop', shops);
  let { data, error } = await select(`${SETTINGS_COLUMNS}, show_button`);
  // Before the show_button migration: read the rest, and the button is on.
  if (error && isMissingShowButtonColumn(error)) ({ data, error } = await select(SETTINGS_COLUMNS));

  if (error || !data) {
    if (strict) throw new Error(error?.message ?? 'try-on settings read returned nothing');
    return DEFAULT_SETTINGS;
  }

  const rows = data as unknown as Row[];
  const defaults = mergeSettings(DEFAULT_SETTINGS, rows.find((r) => r.shop === 'default') ?? null);
  const shopRow = shop ? (rows.find((r) => r.shop === shop) ?? null) : null;
  return mergeSettings(defaults, shopRow);
}

const SETTINGS_COLUMNS =
  'shop, button_label, button_label_ar, accent_bg, accent_fg, radius_px, widget_theme, icon_bg_from, icon_bg_to, loading_style, loading_steps, catalog_label, catalog_label_ar, catalog_icon_px, catalog_font_px, catalog_pad_px, button_icon_px, show_download, show_whatsapp, show_add_to_cart, show_try_again, disclaimer_text, disclaimer_text_ar';

/** PostgREST's answer while 20261108_tryon_show_button.sql has not run:
 *  42703 for a read, PGRST204 for a write that names the column. */
function isMissingShowButtonColumn(error: { code?: string | null; message?: string | null }): boolean {
  return (error.code === '42703' || error.code === 'PGRST204') && /show_button/.test(error.message ?? '');
}

/** Turning the button off needs the show_button column, which the database
 *  does not have yet. Nothing was saved. */
export class TryOnShowButtonUnavailableError extends Error {
  readonly code = 'show_button_unavailable' as const;
  constructor() {
    super('The Try-On button switch is not available yet. Nothing was saved.');
    this.name = 'TryOnShowButtonUnavailableError';
  }
}

/** Whether the shop's storefront Try-On button is switched on, merged the
 *  way getTryOnSettings merges it (the shop's row over the global row; a
 *  missing value is on). Every storefront launch answer calls this, so it
 *  reads one column rather than the whole row.
 *
 *  On without storage and before the migration. Throws on a failed read, so
 *  the launch answer reports `unavailable` rather than guessing. */
export async function readTryOnShowButton(shop: string): Promise<boolean> {
  const supabase = getServiceClient();
  if (!supabase) return true;
  const { data, error } = await supabase
    .from('tryon_settings')
    .select('shop, show_button')
    .in('shop', shop === 'default' ? ['default'] : ['default', shop]);
  if (error) {
    if (isMissingShowButtonColumn(error)) return true;
    throw new Error(`try-on button switch read failed: ${error.message}`);
  }
  const rows = (data ?? []) as Array<{ shop: string; show_button: boolean | null }>;
  const value = (key: string) => rows.find((row) => row.shop === key)?.show_button;
  return value(shop) ?? value('default') ?? true;
}

const COLUMNS: Record<keyof Omit<TryOnSettings, 'shop'>, string> = {
  showButton: 'show_button',
  buttonLabel: 'button_label',
  buttonLabelAr: 'button_label_ar',
  accentBg: 'accent_bg',
  accentFg: 'accent_fg',
  radiusPx: 'radius_px',
  widgetTheme: 'widget_theme',
  iconBgFrom: 'icon_bg_from',
  iconBgTo: 'icon_bg_to',
  loadingStyle: 'loading_style',
  catalogLabel: 'catalog_label',
  catalogLabelAr: 'catalog_label_ar',
  catalogIconPx: 'catalog_icon_px',
  catalogFontPx: 'catalog_font_px',
  catalogPadPx: 'catalog_pad_px',
  buttonIconPx: 'button_icon_px',
  showDownload: 'show_download',
  showWhatsapp: 'show_whatsapp',
  showAddToCart: 'show_add_to_cart',
  showTryAgain: 'show_try_again',
  disclaimerText: 'disclaimer_text',
  disclaimerTextAr: 'disclaimer_text_ar',
  loadingSteps: 'loading_steps',
};

export async function saveTryOnSettings(
  shop: string,
  values: Partial<Omit<TryOnSettings, 'shop'>>,
): Promise<boolean> {
  /* Defense in depth behind requireManagedTryOnShop's opt-in: this is the only
     function that writes tryon_settings, so refusing the global row here means
     no future caller can edit every merchant's inherited baseline by reaching
     the writer directly. Changing platform defaults is an operator action, not
     a merchant one. */
  if (shop === 'default') {
    throw new Error('Global Try-On defaults are not editable from merchant surfaces.');
  }

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

  let { error } = await supabase.from('tryon_settings').upsert(payload);
  if (error && isMissingShowButtonColumn(error) && Object.hasOwn(payload, 'show_button')) {
    /* Before the migration every button is on, so a save that says "on" (an
       editor sending every field) keeps the rest; "off" cannot be stored and
       must not look saved. */
    if (payload.show_button === false) throw new TryOnShowButtonUnavailableError();
    delete payload.show_button;
    ({ error } = await supabase.from('tryon_settings').upsert(payload));
  }

  if (error) {
    console.error('tryon_settings upsert failed:', error.message);
    return false;
  }
  // The storefront config answer is cached for a minute: show a saved switch or style now.
  invalidateProxyConfig(shop);
  return true;
}

