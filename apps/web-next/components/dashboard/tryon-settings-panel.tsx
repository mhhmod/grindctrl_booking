'use client';

import * as React from 'react';
import { useCallback, useState, useTransition } from 'react';
import type { TryOnLocale } from '@/lib/try-on/i18n';
import { useRouter } from 'next/navigation';
import { Button, Group, NativeSelect, Stack, Text } from '@mantine/core';
import {
  TryOnSettingsControls,
  type TryOnWidgetSettings,
} from '@/components/try-on/settings-controls';
import { saveTryOnSettingsAction } from '@/app/dashboard/try-on/actions';
import { actionFailureLabel, getTryOnDashboardCopy } from '@/lib/try-on/dashboard-copy';

export type ManagedShopOption = {
  domain: string;
  status: 'installed' | 'uninstalled';
  jobCount: number;
};

/* The dashboard half of the try-on settings. It renders the same controls
   the merchant sees in the Shopify admin, against the same columns, so the
   two surfaces cannot disagree. Switching shop is a server navigation, so
   the settings always come from the database, never from stale state. */
export function TryOnSettingsPanel({
  shops,
  selectedShop,
  settings,
  locale = 'en',
}: {
  shops: ManagedShopOption[];
  selectedShop: string;
  settings: TryOnWidgetSettings;
  /* The dashboard operator's language, from the shared gc-locale cookie. */
  locale?: TryOnLocale;
}) {
  const router = useRouter();
  const c = getTryOnDashboardCopy(locale);
  const [isNavigating, startNavigation] = useTransition();
  const [s, setS] = useState<TryOnWidgetSettings>(settings);
  const [loadingStepsText, setLoadingStepsText] = useState(
    settings.loadingSteps?.join('\n') ?? '',
  );
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [failureText, setFailureText] = useState<string | null>(null);

  const set = useCallback(
    <K extends keyof TryOnWidgetSettings>(key: K, value: TryOnWidgetSettings[K]) => {
      setS((prev) => ({ ...prev, [key]: value }));
      setStatus((st) => (st === 'saved' ? 'idle' : st));
    },
    [],
  );

  const save = useCallback(async () => {
    setStatus('saving');
    setFailureText(null);
    try {
      // The action takes FormData (it also backs a plain form); build it here
      // so the controls can stay controlled state.
      const fd = new FormData();
      fd.set('shop', selectedShop);
      fd.set('button_label', s.buttonLabel);
      fd.set('button_label_ar', s.buttonLabelAr ?? '');
      fd.set('catalog_label', s.catalogLabel);
      fd.set('catalog_label_ar', s.catalogLabelAr ?? '');
      fd.set('accent_bg', s.accentBg);
      fd.set('accent_fg', s.accentFg);
      fd.set('icon_bg_from', s.iconBgFrom);
      fd.set('icon_bg_to', s.iconBgTo);
      fd.set('radius_px', String(s.radiusPx));
      fd.set('widget_theme', s.widgetTheme);
      fd.set('loading_style', s.loadingStyle);
      fd.set('button_icon_px', String(s.buttonIconPx));
      fd.set('catalog_icon_px', String(s.catalogIconPx));
      fd.set('catalog_font_px', String(s.catalogFontPx));
      fd.set('catalog_pad_px', String(s.catalogPadPx));
      if (s.showDownload) fd.set('show_download', 'on');
      if (s.showWhatsapp) fd.set('show_whatsapp', 'on');
      if (s.showAddToCart) fd.set('show_add_to_cart', 'on');
      if (s.showTryAgain) fd.set('show_try_again', 'on');
      fd.set('disclaimer_text', s.disclaimerText ?? '');
      fd.set('disclaimer_text_ar', s.disclaimerTextAr ?? '');
      fd.set('loading_steps', loadingStepsText);

      const result = await saveTryOnSettingsAction(fd);
      if (!result || !result.ok) {
        setFailureText(result ? actionFailureLabel(c, result) : c.saveFailed);
        setStatus('error');
        return;
      }
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  }, [s, loadingStepsText, selectedShop, c]);

  const isDefault = selectedShop === 'default';

  const shopOptions = [
    { value: 'default', label: c.globalDefaultsOption },
    ...shops.map((shop) => ({
      value: shop.domain,
      label: shop.status === 'uninstalled' ? `${shop.domain}${c.uninstalledSuffix}` : shop.domain,
    })),
  ];

  return (
    <Stack gap="lg">
      <NativeSelect
        id="shop_select"
        label={c.editing}
        description={isDefault ? c.defaultsHelp : c.overridesHelp(selectedShop)}
        inputWrapperOrder={['label', 'input', 'description']}
        data={shopOptions}
        value={selectedShop}
        disabled={isNavigating}
        onChange={(e) =>
          startNavigation(() => router.push(`/dashboard/try-on?shop=${encodeURIComponent(e.currentTarget.value)}`))
        }
        maw={{ sm: 448 }}
      />

      <TryOnSettingsControls
        locale={locale}
        value={s}
        onChange={set}
        loadingStepsText={loadingStepsText}
        onLoadingStepsTextChange={setLoadingStepsText}
      />

      <Group gap="sm" align="center">
        <Button onClick={save} loading={status === 'saving'} disabled={isNavigating}>
          {c.saveSettings}
        </Button>
        {status === 'saving' || status === 'saved' ? (
          <Text role="status" size="sm" c="dimmed">
            {status === 'saving' ? c.saving : c.savedLive}
          </Text>
        ) : null}
        {status === 'error' && (
          <Text role="alert" size="sm" c="var(--mantine-color-error)" className="basis-full sm:basis-auto sm:flex-1">
            {failureText ?? c.saveFailed}
          </Text>
        )}
      </Group>
    </Stack>
  );
}
