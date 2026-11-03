import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@/lib/try-on/settings';
import { draftFrom, studioFormData } from '@/lib/dashboard/tryon-studio-model';
import { failureFromResponse, settingsBodyFromForm } from './embedded-settings';

describe('settingsBodyFromForm', () => {
  it('carries every setting TryOnStudio saves, in the shape the embedded API reads', () => {
    const form = studioFormData('maison.myshopify.com', draftFrom(DEFAULT_SETTINGS), DEFAULT_SETTINGS);
    expect(settingsBodyFromForm(form)).toEqual({
      buttonLabel: DEFAULT_SETTINGS.buttonLabel,
      buttonLabelAr: DEFAULT_SETTINGS.buttonLabelAr ?? '',
      accentBg: DEFAULT_SETTINGS.accentBg,
      accentFg: DEFAULT_SETTINGS.accentFg,
      radiusPx: DEFAULT_SETTINGS.radiusPx,
      widgetTheme: DEFAULT_SETTINGS.widgetTheme,
      iconBgFrom: DEFAULT_SETTINGS.iconBgFrom,
      iconBgTo: DEFAULT_SETTINGS.iconBgTo,
      loadingStyle: DEFAULT_SETTINGS.loadingStyle,
      catalogLabel: DEFAULT_SETTINGS.catalogLabel,
      catalogLabelAr: DEFAULT_SETTINGS.catalogLabelAr ?? '',
      catalogIconPx: DEFAULT_SETTINGS.catalogIconPx,
      catalogFontPx: DEFAULT_SETTINGS.catalogFontPx,
      catalogPadPx: DEFAULT_SETTINGS.catalogPadPx,
      buttonIconPx: DEFAULT_SETTINGS.buttonIconPx,
      showDownload: DEFAULT_SETTINGS.showDownload,
      showWhatsapp: DEFAULT_SETTINGS.showWhatsapp,
      showAddToCart: DEFAULT_SETTINGS.showAddToCart,
      showTryAgain: DEFAULT_SETTINGS.showTryAgain,
      disclaimerText: DEFAULT_SETTINGS.disclaimerText ?? '',
      disclaimerTextAr: DEFAULT_SETTINGS.disclaimerTextAr ?? '',
      loadingSteps: DEFAULT_SETTINGS.loadingSteps?.length ? DEFAULT_SETTINGS.loadingSteps : null,
    });
  });

  it('turns an unticked box into false and the loading steps into lines', () => {
    const form = new FormData();
    form.set('loading_steps', ' Looking at the fabric \n\n Fitting it ');
    expect(settingsBodyFromForm(form)).toMatchObject({
      showDownload: false,
      showTryAgain: false,
      loadingSteps: ['Looking at the fabric', 'Fitting it'],
    });
    form.set('show_download', 'on');
    expect(settingsBodyFromForm(form).showDownload).toBe(true);
    form.set('loading_steps', '  ');
    expect(settingsBodyFromForm(form).loadingSteps).toBeNull();
  });
});

describe('failureFromResponse', () => {
  const response = (status: number, headers: Record<string, string> = {}) => ({ status, headers: new Headers(headers) });

  it('keeps the API’s limit answer, with how long to wait', () => {
    expect(failureFromResponse(response(429, { 'Retry-After': '12' }))).toMatchObject({ code: 'rate_limited', retryAfterSeconds: 12 });
    expect(failureFromResponse(response(429)).retryAfterSeconds).toBeUndefined();
  });

  it('tells a refused session from a store that is down', () => {
    expect(failureFromResponse(response(401)).code).toBe('forbidden');
    expect(failureFromResponse(response(503)).code).toBe('unavailable');
    expect(failureFromResponse(response(500)).code).toBe('unavailable');
  });
});
