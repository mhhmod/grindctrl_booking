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

  const radius = Number(formData.get('radius_px'));

  await saveTryOnSettings(shop, {
    buttonLabel: String(formData.get('button_label') || '').trim() || undefined,
    accentBg: String(formData.get('accent_bg') || '').trim() || undefined,
    accentFg: String(formData.get('accent_fg') || '').trim() || undefined,
    radiusPx: Number.isFinite(radius) ? Math.max(0, Math.min(999, radius)) : undefined,
    widgetTheme: formData.get('widget_theme') === 'dark' ? 'dark' : 'light',
    loadingSteps,
  });

  revalidatePath('/dashboard/try-on');
}
