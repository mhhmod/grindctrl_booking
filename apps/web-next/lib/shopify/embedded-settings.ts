import type { MerchantActionFailure } from '@/lib/request-rate-limit';

/* The embedded admin saves Try-On settings through /api/shopify/admin/settings
   (a session token, JSON), while the Set up board (TryOnStudio) builds the
   dashboard's form for saveTryOnSettingsAction. This turns that form into the
   API's body, so the one editor works on both surfaces. The API clamps and
   trims every value again; this only changes the shape. */

const text = (form: FormData, key: string) => String(form.get(key) ?? '');
const number = (form: FormData, key: string) => Number(form.get(key));
const checked = (form: FormData, key: string) => form.get(key) === 'on';

export function settingsBodyFromForm(form: FormData) {
  const steps = text(form, 'loading_steps').trim();
  return {
    buttonLabel: text(form, 'button_label'),
    buttonLabelAr: text(form, 'button_label_ar'),
    accentBg: text(form, 'accent_bg'),
    accentFg: text(form, 'accent_fg'),
    radiusPx: number(form, 'radius_px'),
    widgetTheme: text(form, 'widget_theme'),
    iconBgFrom: text(form, 'icon_bg_from'),
    iconBgTo: text(form, 'icon_bg_to'),
    loadingStyle: text(form, 'loading_style'),
    catalogLabel: text(form, 'catalog_label'),
    catalogLabelAr: text(form, 'catalog_label_ar'),
    catalogIconPx: number(form, 'catalog_icon_px'),
    catalogFontPx: number(form, 'catalog_font_px'),
    catalogPadPx: number(form, 'catalog_pad_px'),
    buttonIconPx: number(form, 'button_icon_px'),
    showDownload: checked(form, 'show_download'),
    showWhatsapp: checked(form, 'show_whatsapp'),
    showAddToCart: checked(form, 'show_add_to_cart'),
    showTryAgain: checked(form, 'show_try_again'),
    disclaimerText: text(form, 'disclaimer_text'),
    disclaimerTextAr: text(form, 'disclaimer_text_ar'),
    loadingSteps: steps ? steps.split('\n').map((line) => line.trim()).filter(Boolean) : null,
  };
}

/** What the editor shows when the API did not take the save: its limit
 *  answer (429 with Retry-After), a refused session, or anything else. */
export function failureFromResponse(response: Pick<Response, 'status' | 'headers'>): MerchantActionFailure {
  if (response.status === 401 || response.status === 403) {
    return { ok: false, code: 'forbidden', message: 'Not allowed' };
  }
  const retryAfter = Number(response.headers.get('Retry-After'));
  return {
    ok: false,
    code: response.status === 429 ? 'rate_limited' : 'unavailable',
    message: 'Not saved',
    ...(Number.isFinite(retryAfter) && retryAfter > 0 ? { retryAfterSeconds: retryAfter } : {}),
  };
}
