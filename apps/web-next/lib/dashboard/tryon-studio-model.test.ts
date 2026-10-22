import { describe, expect, it } from 'vitest';
import type { TryOnWidgetSettings } from '@/components/try-on/settings-controls';
import {
  changedFields,
  draftFrom,
  missingEnglish,
  nextCorner,
  settingsFromDraft,
  studioFormData,
  themeEditorUrl,
} from './tryon-studio-model';
import { getTryOnStudioCopy } from './tryon-studio-copy';

const SAVED: TryOnWidgetSettings = {
  buttonLabel: 'Try it on',
  buttonLabelAr: 'جربها عليك',
  accentBg: '#111111',
  accentFg: '#FFFFFF',
  radiusPx: 12,
  widgetTheme: 'light',
  iconBgFrom: '#ff9a3d',
  iconBgTo: '#ffd76e',
  loadingStyle: 'steps',
  catalogLabel: 'Try on',
  catalogLabelAr: null,
  catalogIconPx: 14,
  catalogFontPx: 12,
  catalogPadPx: 6,
  buttonIconPx: 28,
  showDownload: true,
  showWhatsapp: false,
  showAddToCart: true,
  showTryAgain: true,
  disclaimerText: null,
  disclaimerTextAr: null,
  loadingSteps: null,
};

describe('the TryOnStudio draft', () => {
  it('starts from the saved settings, with three loading steps to fill', () => {
    const draft = draftFrom(SAVED);
    expect(draft).toMatchObject({ buttonLabelAr: 'جربها عليك', catalogLabelAr: '', disclaimerText: '', loadingSteps: ['', '', ''] });
    expect(draftFrom({ ...SAVED, loadingSteps: ['a', 'b', 'c', 'd'] }).loadingSteps).toEqual(['a', 'b', 'c', 'd']);
  });

  it('counts each changed field, and not whitespace, a colour’s case or an empty step', () => {
    const saved = draftFrom(SAVED);
    expect(changedFields(saved, saved)).toEqual([]);
    expect(changedFields(saved, { ...saved, buttonLabel: ' Try it on ', accentFg: '#ffffff', loadingSteps: ['', ' ', ''] })).toEqual([]);
    expect(
      changedFields(saved, { ...saved, radiusPx: 16, showWhatsapp: true, loadingSteps: ['Reading', '', ''], disclaimerTextAr: 'ملاحظة' }),
    ).toEqual(['radiusPx', 'loadingSteps', 'showWhatsapp', 'disclaimerTextAr']);
  });

  it('needs the English labels, since an empty one would keep the old label', () => {
    const saved = draftFrom(SAVED);
    expect(missingEnglish(saved)).toEqual({ buttonLabel: false, catalogLabel: false });
    expect(missingEnglish({ ...saved, buttonLabel: ' ', catalogLabel: '' })).toEqual({ buttonLabel: true, catalogLabel: true });
  });
});

describe('studioFormData', () => {
  it('sends what today’s save action reads, with the parts the board has no place for as saved', () => {
    const draft = { ...draftFrom(SAVED), buttonLabelAr: '', loadingSteps: [' Reading your photo ', '', 'Rendering'], disclaimerText: 'x'.repeat(320) };
    const fd = studioFormData('maison.myshopify.com', draft, SAVED);
    expect(Object.fromEntries(fd.entries())).toEqual({
      shop: 'maison.myshopify.com',
      button_label: 'Try it on',
      button_label_ar: '',
      catalog_label: 'Try on',
      catalog_label_ar: '',
      accent_bg: '#111111',
      accent_fg: '#FFFFFF',
      radius_px: '12',
      widget_theme: 'light',
      loading_style: 'steps',
      loading_steps: 'Reading your photo\nRendering',
      show_download: 'on',
      show_add_to_cart: 'on',
      show_try_again: 'on',
      disclaimer_text: 'x'.repeat(300),
      disclaimer_text_ar: '',
      icon_bg_from: '#ff9a3d',
      icon_bg_to: '#ffd76e',
      button_icon_px: '28',
      catalog_icon_px: '14',
      catalog_font_px: '12',
      catalog_pad_px: '6',
    });
  });

  it('becomes the next saved settings, empty Arabic and steps as unset', () => {
    const next = settingsFromDraft({ ...draftFrom(SAVED), buttonLabelAr: '  ', showWhatsapp: true }, SAVED);
    expect(next).toMatchObject({ buttonLabelAr: null, loadingSteps: null, showWhatsapp: true, iconBgFrom: '#ff9a3d' });
  });
});

describe('the corners and the theme editor', () => {
  it('steps the corners, through fully round, and reads it in both languages', () => {
    expect(nextCorner(12, 1)).toBe(16);
    expect(nextCorner(12, -1)).toBe(10);
    expect(nextCorner(5, 1)).toBe(6);
    expect(nextCorner(24, 1)).toBe(999);
    expect(nextCorner(999, 1)).toBe(999);
    expect(nextCorner(999, -1)).toBe(24);
    expect(nextCorner(0, -1)).toBe(0);
    expect(getTryOnStudioCopy('en').cornerValue(12)).toBe('12 px');
    expect(getTryOnStudioCopy('en').cornerValue(999)).toBe('Fully round');
    expect(getTryOnStudioCopy('ar').cornerValue(999)).toBe('دائرية بالكامل');
  });

  it('opens the product template in the shop’s theme editor, and nothing for another domain', () => {
    expect(themeEditorUrl('Maison-Noor.myshopify.com')).toBe('https://admin.shopify.com/store/maison-noor/themes/current/editor?template=product');
    expect(themeEditorUrl('maisonnoor.com')).toBeNull();
  });

  it('counts unsaved changes in Arabic', () => {
    const ar = getTryOnStudioCopy('ar');
    expect([1, 2, 3, 11].map(ar.unsaved)).toEqual(['تغيير واحد غير محفوظ', 'تغييران غير محفوظين', '3 تغييرات غير محفوظة', '11 تغييراً غير محفوظ']);
    expect(getTryOnStudioCopy('en').unsaved(2)).toBe('2 unsaved changes');
  });
});
