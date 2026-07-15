import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, mergeSettings, type SettingsRow, type TryOnSettings } from './settings';

/* A shop row with everything unset: each test sets only what it asserts on. */
function row(overrides: Partial<SettingsRow> = {}): SettingsRow {
  return {
    shop: 'store.myshopify.com',
    button_label: null,
    accent_bg: null,
    accent_fg: null,
    radius_px: null,
    widget_theme: null,
    icon_bg_from: null,
    icon_bg_to: null,
    loading_style: null,
    catalog_label: null,
    catalog_icon_px: null,
    catalog_font_px: null,
    catalog_pad_px: null,
    button_icon_px: null,
    show_download: null,
    show_whatsapp: null,
    show_add_to_cart: null,
    show_try_again: null,
    disclaimer_text: null,
    loading_steps: null,
    ...overrides,
  };
}

describe('mergeSettings', () => {
  it('inherits from the base row when a column is unset', () => {
    const base: TryOnSettings = { ...DEFAULT_SETTINGS, widgetTheme: 'dark', catalogIconPx: 20 };
    const merged = mergeSettings(base, row());
    expect(merged.widgetTheme).toBe('dark');
    expect(merged.catalogIconPx).toBe(20);
  });

  // Regression: an explicit light used to lose to an inherited dark, which
  // rendered the storefront panel dark no matter what the shop had saved.
  it('lets an explicit light override an inherited dark theme', () => {
    const base: TryOnSettings = { ...DEFAULT_SETTINGS, widgetTheme: 'dark' };
    expect(mergeSettings(base, row({ widget_theme: 'light' })).widgetTheme).toBe('light');
  });

  it('lets an explicit steps override an inherited pulse loading style', () => {
    const base: TryOnSettings = { ...DEFAULT_SETTINGS, loadingStyle: 'pulse' };
    expect(mergeSettings(base, row({ loading_style: 'steps' })).loadingStyle).toBe('steps');
  });

  it('ignores a junk theme value and keeps the inherited one', () => {
    const base: TryOnSettings = { ...DEFAULT_SETTINGS, widgetTheme: 'dark' };
    expect(mergeSettings(base, row({ widget_theme: 'neon' })).widgetTheme).toBe('dark');
  });

  it('maps the catalog sizing columns', () => {
    const merged = mergeSettings(
      DEFAULT_SETTINGS,
      row({ catalog_label: 'Fit check', catalog_icon_px: 22, catalog_pad_px: 10, button_icon_px: 34 }),
    );
    expect(merged.catalogLabel).toBe('Fit check');
    expect(merged.catalogIconPx).toBe(22);
    expect(merged.catalogPadPx).toBe(10);
    expect(merged.buttonIconPx).toBe(34);
  });
});
