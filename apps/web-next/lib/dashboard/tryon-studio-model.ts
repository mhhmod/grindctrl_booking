/* The v16 Try-On Set up tab (the TryOnStudio board) on today's
   tryon_settings: the fields the board keeps, a count of what changed since
   the last save, and the form today's saveTryOnSettingsAction reads. The
   board has no place for the icon gradient or the icon and pill sizes, so
   they are sent back as they were saved. */

import type { TryOnWidgetSettings } from '@/components/try-on/settings-controls';

export const LABEL_MAX = 40;
export const PILL_MAX = 24;
export const NOTE_MAX = 300;
/** The board shows three loading steps; a store that saved more keeps them all. */
export const STEP_SLOTS = 3;
/** Corners in pixels, then fully round (999, as the widget reads it). */
export const CORNER_STEPS = [0, 2, 4, 6, 8, 10, 12, 16, 20, 24, 999] as const;

export type ActionKey = 'showAddToCart' | 'showDownload' | 'showWhatsapp' | 'showTryAgain';
export const ACTION_KEYS: ActionKey[] = ['showAddToCart', 'showDownload', 'showWhatsapp', 'showTryAgain'];

export type StudioDraft = {
  accentBg: string;
  accentFg: string;
  radiusPx: number;
  buttonLabel: string;
  buttonLabelAr: string;
  catalogLabel: string;
  catalogLabelAr: string;
  widgetTheme: 'light' | 'dark';
  loadingStyle: 'steps' | 'pulse' | 'bar';
  loadingSteps: string[];
  showAddToCart: boolean;
  showDownload: boolean;
  showWhatsapp: boolean;
  showTryAgain: boolean;
  disclaimerText: string;
  disclaimerTextAr: string;
};

export function draftFrom(settings: TryOnWidgetSettings): StudioDraft {
  const steps = settings.loadingSteps ?? [];
  return {
    accentBg: settings.accentBg,
    accentFg: settings.accentFg,
    radiusPx: settings.radiusPx,
    buttonLabel: settings.buttonLabel,
    buttonLabelAr: settings.buttonLabelAr ?? '',
    catalogLabel: settings.catalogLabel,
    catalogLabelAr: settings.catalogLabelAr ?? '',
    widgetTheme: settings.widgetTheme,
    loadingStyle: settings.loadingStyle,
    loadingSteps: [...steps, ...Array<string>(Math.max(0, STEP_SLOTS - steps.length)).fill('')],
    showAddToCart: settings.showAddToCart,
    showDownload: settings.showDownload,
    showWhatsapp: settings.showWhatsapp,
    showTryAgain: settings.showTryAgain,
    disclaimerText: settings.disclaimerText ?? '',
    disclaimerTextAr: settings.disclaimerTextAr ?? '',
  };
}

function steps(draft: StudioDraft): string[] {
  return draft.loadingSteps.map((step) => step.trim()).filter(Boolean);
}

/** The fields that differ from the last save; whitespace and a colour's case are not changes. */
export function changedFields(saved: StudioDraft, draft: StudioDraft): Array<keyof StudioDraft> {
  return (Object.keys(saved) as Array<keyof StudioDraft>).filter((key) => {
    if (key === 'loadingSteps') return steps(saved).join('\n') !== steps(draft).join('\n');
    const a = saved[key];
    const b = draft[key];
    if (key === 'accentBg' || key === 'accentFg') return String(a).toLowerCase() !== String(b).toLowerCase();
    return typeof a === 'string' && typeof b === 'string' ? a.trim() !== b.trim() : a !== b;
  });
}

/** Today's action keeps the old English label when it gets an empty one, so English is needed. */
export function missingEnglish(draft: StudioDraft): { buttonLabel: boolean; catalogLabel: boolean } {
  return { buttonLabel: !draft.buttonLabel.trim(), catalogLabel: !draft.catalogLabel.trim() };
}

/** The settings the preview draws and the next save starts from. */
export function settingsFromDraft(draft: StudioDraft, saved: TryOnWidgetSettings): TryOnWidgetSettings {
  const list = steps(draft);
  return {
    ...saved,
    accentBg: draft.accentBg,
    accentFg: draft.accentFg,
    radiusPx: draft.radiusPx,
    buttonLabel: draft.buttonLabel.trim(),
    buttonLabelAr: draft.buttonLabelAr.trim() || null,
    catalogLabel: draft.catalogLabel.trim().slice(0, PILL_MAX),
    catalogLabelAr: draft.catalogLabelAr.trim().slice(0, PILL_MAX) || null,
    widgetTheme: draft.widgetTheme,
    loadingStyle: draft.loadingStyle,
    loadingSteps: list.length > 0 ? list : null,
    showAddToCart: draft.showAddToCart,
    showDownload: draft.showDownload,
    showWhatsapp: draft.showWhatsapp,
    showTryAgain: draft.showTryAgain,
    disclaimerText: draft.disclaimerText.trim().slice(0, NOTE_MAX) || null,
    disclaimerTextAr: draft.disclaimerTextAr.trim().slice(0, NOTE_MAX) || null,
  };
}

/** The form saveTryOnSettingsAction reads (it also backs a plain form). */
export function studioFormData(shop: string, draft: StudioDraft, saved: TryOnWidgetSettings): FormData {
  const s = settingsFromDraft(draft, saved);
  const fd = new FormData();
  fd.set('shop', shop);
  fd.set('button_label', s.buttonLabel);
  fd.set('button_label_ar', s.buttonLabelAr ?? '');
  fd.set('catalog_label', s.catalogLabel);
  fd.set('catalog_label_ar', s.catalogLabelAr ?? '');
  fd.set('accent_bg', s.accentBg);
  fd.set('accent_fg', s.accentFg);
  fd.set('radius_px', String(s.radiusPx));
  fd.set('widget_theme', s.widgetTheme);
  fd.set('loading_style', s.loadingStyle);
  fd.set('loading_steps', (s.loadingSteps ?? []).join('\n'));
  if (s.showDownload) fd.set('show_download', 'on');
  if (s.showWhatsapp) fd.set('show_whatsapp', 'on');
  if (s.showAddToCart) fd.set('show_add_to_cart', 'on');
  if (s.showTryAgain) fd.set('show_try_again', 'on');
  fd.set('disclaimer_text', s.disclaimerText ?? '');
  fd.set('disclaimer_text_ar', s.disclaimerTextAr ?? '');
  // Not on the board: kept as saved.
  fd.set('icon_bg_from', s.iconBgFrom);
  fd.set('icon_bg_to', s.iconBgTo);
  fd.set('button_icon_px', String(s.buttonIconPx));
  fd.set('catalog_icon_px', String(s.catalogIconPx));
  fd.set('catalog_font_px', String(s.catalogFontPx));
  fd.set('catalog_pad_px', String(s.catalogPadPx));
  return fd;
}

/** One step rounder or squarer; a value between steps moves to the next one. */
export function nextCorner(px: number, direction: 1 | -1): number {
  if (direction === 1) return CORNER_STEPS.find((step) => step > px) ?? CORNER_STEPS[CORNER_STEPS.length - 1];
  return [...CORNER_STEPS].reverse().find((step) => step < px) ?? CORNER_STEPS[0];
}

/** The theme editor on the product template, where the Try-On block is placed. */
export function themeEditorUrl(shop: string): string | null {
  const match = /^([a-z0-9][a-z0-9-]*)\.myshopify\.com$/.exec(shop.trim().toLowerCase());
  return match ? `https://admin.shopify.com/store/${match[1]}/themes/current/editor?template=product` : null;
}
