'use server';

import { revalidatePath } from 'next/cache';
import { requireManagedTenant } from '@/lib/tenancy/managed-tenant';
import { saveTryOnSettings, TryOnSwitchUnavailableError } from '@/lib/try-on/settings';
import { requireMerchantRateLimit, merchantActionFailure, type MerchantActionFailure } from '@/lib/request-rate-limit';
import { RoleNotAllowedError } from '@/lib/rbac/dashboard-policy';

export type TryOnSettingsActionFailure = MerchantActionFailure & {
  /** `show_button_unavailable` / `show_card_pill_unavailable`: turning that
   *  switch off needs a database update that has not run yet. Nothing was
   *  saved, so retrying won't help. */
  reason?: 'show_button_unavailable' | 'show_card_pill_unavailable';
};
export type TryOnSettingsActionResult = { ok: true } | TryOnSettingsActionFailure;

function settingsActionFailure(error: unknown): TryOnSettingsActionFailure {
  if (error instanceof RoleNotAllowedError ||
    (error instanceof Error && ['Unauthorized', 'Unknown Shopify shop'].includes(error.message))) {
    return { ok: false, code: 'forbidden', message: 'You do not have permission to change this shop.' };
  }
  if (error instanceof TryOnSwitchUnavailableError) {
    return { ok: false, code: 'unavailable', reason: error.code, message: error.message };
  }
  return merchantActionFailure(error);
}

/** A switch field is 'on' or 'off'; any other value, or none, leaves the
 *  switch as it is, so a form without it never turns it back on. */
function switchField(value: FormDataEntryValue | null): boolean | undefined {
  return value === 'on' ? true : value === 'off' ? false : undefined;
}
function switchFields(formData: FormData): { showButton?: boolean; showCardPill?: boolean } {
  const showButton = switchField(formData.get('show_button'));
  const showCardPill = switchField(formData.get('show_card_pill'));
  return {
    ...(showButton === undefined ? {} : { showButton }),
    ...(showCardPill === undefined ? {} : { showCardPill }),
  };
}

export async function saveTryOnSettingsAction(formData: FormData): Promise<TryOnSettingsActionResult> {
  try {
  // Setting the shop up is for its owner and admins, not members (item 12).
  const shop = await requireManagedTenant(formData.get('shop') ?? 'default', { capability: 'settings' });
  await requireMerchantRateLimit(`shop:${shop}`);
  const loadingStepsRaw = String(formData.get('loading_steps') || '').trim();
  const loadingSteps = loadingStepsRaw
    ? loadingStepsRaw.split('\n').map((s) => s.trim()).filter(Boolean)
    : null;

  const clamp = (value: FormDataEntryValue | null, min: number, max: number, fallback: number) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
  };
  const radius = Number(formData.get('radius_px'));

  const saved = await saveTryOnSettings(shop, {
    ...switchFields(formData),
    buttonLabel: String(formData.get('button_label') || '').trim() || undefined,
    /* null rather than undefined: undefined means "leave as is", but a
       merchant clearing the Arabic field must actually clear it. */
    buttonLabelAr: String(formData.get('button_label_ar') || '').trim() || null,
    accentBg: String(formData.get('accent_bg') || '').trim() || undefined,
    accentFg: String(formData.get('accent_fg') || '').trim() || undefined,
    radiusPx: Number.isFinite(radius) ? Math.max(0, Math.min(999, radius)) : undefined,
    widgetTheme: formData.get('widget_theme') === 'dark' ? 'dark' : 'light',
    iconBgFrom: String(formData.get('icon_bg_from') || '').trim() || undefined,
    iconBgTo: String(formData.get('icon_bg_to') || '').trim() || undefined,
    loadingStyle: (['pulse', 'bar'].includes(String(formData.get('loading_style')))
      ? String(formData.get('loading_style'))
      : 'steps') as 'steps' | 'pulse' | 'bar',
    catalogLabel: String(formData.get('catalog_label') || '').trim().slice(0, 24) || 'Try on',
    catalogLabelAr: String(formData.get('catalog_label_ar') || '').trim().slice(0, 24) || null,
    catalogIconPx: clamp(formData.get('catalog_icon_px'), 10, 32, 14),
    catalogFontPx: clamp(formData.get('catalog_font_px'), 9, 20, 12),
    catalogPadPx: clamp(formData.get('catalog_pad_px'), 2, 16, 6),
    buttonIconPx: clamp(formData.get('button_icon_px'), 18, 40, 28),
    showDownload: formData.get('show_download') === 'on',
    showWhatsapp: formData.get('show_whatsapp') === 'on',
    showAddToCart: formData.get('show_add_to_cart') === 'on',
    showTryAgain: formData.get('show_try_again') === 'on',
    // The note under each look is up to 300 characters (TryOnStudio).
    disclaimerText: String(formData.get('disclaimer_text') || '').trim().slice(0, 300) || null,
    disclaimerTextAr: String(formData.get('disclaimer_text_ar') || '').trim().slice(0, 300) || null,
    loadingSteps,
  });
  if (!saved) return merchantActionFailure(null);

  // Results, Set up (/dashboard/try-on/setup) and the shell all read these, under the dashboard layout.
  revalidatePath('/dashboard', 'layout');
  return { ok: true };
  } catch (error) {
    return settingsActionFailure(error);
  }
}

/** The storefront Try-On button switch on its own, for a control that
 *  saves the moment it is flipped. Same role and storage as the settings
 *  save; only show_button is written. */
export async function setTryOnButtonAction(input: { shop: string; showButton: boolean }): Promise<TryOnSettingsActionResult> {
  try {
    const shop = await requireManagedTenant(input?.shop ?? 'default', { capability: 'settings' });
    // A server action is a public endpoint: never coerce a malformed value into "off".
    if (typeof input.showButton !== 'boolean') return merchantActionFailure(null);
    await requireMerchantRateLimit(`shop:${shop}`);
    if (!(await saveTryOnSettings(shop, { showButton: input.showButton }))) return merchantActionFailure(null);
    revalidatePath('/dashboard', 'layout');
    return { ok: true };
  } catch (error) {
    return settingsActionFailure(error);
  }
}

/** The product card pill switch on its own (tryon_settings.show_card_pill),
 *  for a control that saves the moment it is flipped. Same role, storage
 *  and failures as setTryOnButtonAction; only show_card_pill is written.
 *  The main switch off hides the pills whatever this one says. */
export async function setTryOnCardPillAction(input: { shop: string; showCardPill: boolean }): Promise<TryOnSettingsActionResult> {
  try {
    const shop = await requireManagedTenant(input?.shop ?? 'default', { capability: 'settings' });
    if (typeof input.showCardPill !== 'boolean') return merchantActionFailure(null);
    await requireMerchantRateLimit(`shop:${shop}`);
    if (!(await saveTryOnSettings(shop, { showCardPill: input.showCardPill }))) return merchantActionFailure(null);
    revalidatePath('/dashboard', 'layout');
    return { ok: true };
  } catch (error) {
    return settingsActionFailure(error);
  }
}
