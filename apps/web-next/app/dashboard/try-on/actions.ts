'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { saveTryOnSettings } from '@/lib/try-on/settings';

export async function saveTryOnSettingsAction(formData: FormData) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const shop = String(formData.get('shop') || 'default').trim() || 'default';
  const loadingStepsRaw = String(formData.get('loading_steps') || '').trim();
  const loadingSteps = loadingStepsRaw
    ? loadingStepsRaw.split('\n').map((s) => s.trim()).filter(Boolean)
    : null;

  const clamp = (value: FormDataEntryValue | null, min: number, max: number, fallback: number) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
  };
  const radius = Number(formData.get('radius_px'));

  await saveTryOnSettings(shop, {
    buttonLabel: String(formData.get('button_label') || '').trim() || undefined,
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
    catalogIconPx: clamp(formData.get('catalog_icon_px'), 10, 32, 14),
    catalogFontPx: clamp(formData.get('catalog_font_px'), 9, 20, 12),
    catalogPadPx: clamp(formData.get('catalog_pad_px'), 2, 16, 6),
    buttonIconPx: clamp(formData.get('button_icon_px'), 18, 40, 28),
    showDownload: formData.get('show_download') === 'on',
    showWhatsapp: formData.get('show_whatsapp') === 'on',
    showAddToCart: formData.get('show_add_to_cart') === 'on',
    showTryAgain: formData.get('show_try_again') === 'on',
    disclaimerText: String(formData.get('disclaimer_text') || '').trim() || null,
    loadingSteps,
  });

  revalidatePath('/dashboard/try-on');
}
