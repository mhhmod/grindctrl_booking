'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Button, Group, Loader, Paper, SimpleGrid, Stack, Text, TextInput, Title } from '@mantine/core';
import { V16TryOnStudio, type SaveTryOnSettings } from '@/components/dashboard/v16/try-on/v16-tryon-studio';
import type { TryOnWidgetSettings } from '@/components/try-on/settings-controls';
import { getShopifySessionToken } from '@/lib/shopify/app-bridge-client';
import { failureFromResponse, settingsBodyFromForm } from '@/lib/shopify/embedded-settings';
import { getSettingsFormCopy } from '@/lib/try-on/settings-copy';
import type { TryOnLocale } from '@/lib/try-on/i18n';
import type { ConsumeShopLinkResult } from '@/lib/shopify/shop-links';
import { appEmbedActivationUrl, productBlockAddUrl } from '@/lib/shopify/app-identity';

/* The embedded admin's Try-On tab: linking the store to a dashboard account,
   the two theme deep links, and the same Set up editor (TryOnStudio) the
   dashboard uses. It saves through the session-token API, so the form the
   editor builds is turned into that API's body (lib/shopify/embedded-settings.ts). */

const COPY = {
  en: {
    loading: 'Loading settings',
    loadFailed: 'Could not load settings. Open this page from your Shopify admin.',
    productPagesBody: 'Adds the try-on button under your product details. Press Save in the theme editor.',
    addToProductPage: 'Add to product page',
    catalogPagesBody: 'Adds a Try on pill to every product card in your collection grids.',
    enableCatalog: 'Enable catalog try-on',
  },
  ar: {
    loading: 'جارٍ تحميل الإعدادات',
    loadFailed: 'تعذّر تحميل الإعدادات. افتح هذه الصفحة من لوحة تحكم Shopify.',
    productPagesBody: 'يضيف زر التجربة تحت تفاصيل المنتج. اضغط على حفظ في محرر القالب.',
    addToProductPage: 'أضفه إلى صفحة المنتج',
    catalogPagesBody: 'يضيف زر «جرّب» على كل بطاقة منتج في شبكات المجموعات.',
    enableCatalog: 'فعّل التجربة في الكتالوج',
  },
} as const;

function ShopLinkCard({
  initiallyLinked,
  linkedAccount,
  c,
}: {
  initiallyLinked: boolean;
  linkedAccount: string | null;
  c: ReturnType<typeof getSettingsFormCopy>;
}) {
  const [linked, setLinked] = useState(initiallyLinked);
  // A linked store can still be moved to another dashboard account by its admin.
  const [relinking, setRelinking] = useState(false);
  const [linkCode, setLinkCode] = useState('');
  const [status, setStatus] = useState<
    'idle' | 'submitting' | ConsumeShopLinkResult | 'error'
  >('idle');
  const hasError =
    status === 'invalid' ||
    status === 'expired' ||
    status === 'already_owned' ||
    status === 'error';

  const linkShop = useCallback(async () => {
    setStatus('submitting');
    try {
      const token = await getShopifySessionToken();
      const res = await fetch('/api/shopify/admin/link', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: linkCode, replace: relinking }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = (await res.json()) as { outcome?: unknown };
      if (
        data.outcome !== 'linked' &&
        data.outcome !== 'invalid' &&
        data.outcome !== 'expired' &&
        data.outcome !== 'already_owned'
      ) {
        throw new Error('Unexpected link outcome');
      }

      setStatus(data.outcome);
      if (data.outcome === 'linked') {
        setLinked(true);
        setRelinking(false);
      }
    } catch {
      setStatus('error');
    }
  }, [linkCode, relinking]);

  return (
    <Paper withBorder radius="card" p="lg">
      <Stack gap="md" align="flex-start">
        <Stack gap={4}>
          <Title order={2} size="h4">{c.shopLinkTitle}</Title>
          <Text size="sm" c="dimmed">{c.shopLinkDescription}</Text>
        </Stack>
        {linked && !relinking ? (
          <Stack gap="sm" align="flex-start">
            <Text size="sm" role="status">
              {status === 'linked'
                ? c.shopLinkSuccess
                : linkedAccount
                  ? c.shopLinkedTo(linkedAccount)
                  : c.shopLinked}
            </Text>
            <Button
              type="button"
              variant="default"
              radius="pill"
              mih={44}
              onClick={() => {
                setRelinking(true);
                setLinkCode('');
                setStatus('idle');
              }}
            >
              {c.relinkShop}
            </Button>
          </Stack>
        ) : (
          <form
            style={{ width: '100%' }}
            onSubmit={(event) => {
              event.preventDefault();
              void linkShop();
            }}
          >
            <Group gap="sm" align="flex-end" wrap="wrap">
              <TextInput
                style={{ flex: '1 1 14rem', minWidth: 0 }}
                id="shop-link-code"
                label={c.shopLinkCodeLabel}
                value={linkCode}
                onChange={(event) => {
                  setLinkCode(event.currentTarget.value);
                  if (status !== 'submitting') setStatus('idle');
                }}
                placeholder={c.shopLinkCodePlaceholder}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                dir="ltr"
                required
                withAsterisk={false}
                size="md"
                error={hasError}
                aria-describedby={hasError ? 'shop-link-status' : undefined}
              />
              <Button type="submit" radius="pill" h={44} loading={status === 'submitting'}>
                {status === 'submitting' ? c.linkingShop : c.linkShop}
              </Button>
            </Group>
            {relinking && (
              <Text size="sm" c="dimmed" mt="sm">{c.relinkHint}</Text>
            )}
            {hasError && (
              <Text id="shop-link-status" size="sm" c="danger" mt="sm" role="alert">
                {status === 'invalid'
                  ? c.shopLinkInvalid
                  : status === 'expired'
                    ? c.shopLinkExpired
                    : status === 'already_owned'
                      ? c.shopLinkAlreadyOwned
                      : c.shopLinkFailed}
              </Text>
            )}
          </form>
        )}
      </Stack>
    </Paper>
  );
}

export function ShopifyAdminSettings({ locale = 'en' }: { locale?: TryOnLocale }) {
  const c = getSettingsFormCopy(locale);
  const t = COPY[locale === 'ar' ? 'ar' : 'en'];
  const [shop, setShop] = useState('');
  const [s, setS] = useState<TryOnWidgetSettings | null>(null);
  const [linked, setLinked] = useState(false);
  const [linkedAccount, setLinkedAccount] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getShopifySessionToken();
        const res = await fetch('/api/shopify/admin/settings', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          shop: string;
          settings: TryOnWidgetSettings;
          linked: boolean;
          linkedAccount?: string | null;
        };
        if (cancelled) return;
        setShop(data.shop);
        setS(data.settings);
        setLinked(data.linked);
        setLinkedAccount(data.linkedAccount ?? null);
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback<SaveTryOnSettings>(async (form) => {
    try {
      const token = await getShopifySessionToken();
      const res = await fetch('/api/shopify/admin/settings', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsBodyFromForm(form)),
      });
      if (!res.ok) return failureFromResponse(res);
      const body = (await res.json()) as { ok?: boolean };
      return body.ok === false ? failureFromResponse({ status: 500, headers: res.headers }) : { ok: true };
    } catch {
      return failureFromResponse({ status: 503, headers: new Headers() });
    }
  }, []);

  if (status === 'loading') {
    return (
      <Stack role="status" align="center" gap="xs" p="xl">
        <Loader size="sm" aria-hidden />
        <Text size="sm" c="dimmed">{t.loading}</Text>
      </Stack>
    );
  }

  if (!s) {
    return (
      <Text role="alert" size="sm" c="danger" p="xl">
        {t.loadFailed}
      </Text>
    );
  }

  const deepLink = shop ? productBlockAddUrl(shop, 'tryon') : '#';
  const catalogLink = shop ? appEmbedActivationUrl(shop, 'tryon-catalog') : '#';

  return (
    <Stack gap="md" style={{ minWidth: 0 }}>
      <ShopLinkCard initiallyLinked={linked} linkedAccount={linkedAccount} c={c} />

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        <Paper withBorder radius="card" p="lg">
          <Stack gap="md" align="flex-start" h="100%">
            <Stack gap={4}>
              <Title order={2} size="h4">{c.productPages}</Title>
              <Text size="sm" c="dimmed">{t.productPagesBody}</Text>
            </Stack>
            <Button component="a" href={deepLink} target="_blank" rel="noopener noreferrer" radius="pill" h={44} mt="auto">
              {t.addToProductPage}
            </Button>
          </Stack>
        </Paper>
        <Paper withBorder radius="card" p="lg">
          <Stack gap="md" align="flex-start" h="100%">
            <Stack gap={4}>
              <Title order={2} size="h4">{c.catalogPages}</Title>
              <Text size="sm" c="dimmed">{t.catalogPagesBody}</Text>
            </Stack>
            <Button component="a" href={catalogLink} target="_blank" rel="noopener noreferrer" variant="default" radius="pill" h={44} mt="auto">
              {t.enableCatalog}
            </Button>
          </Stack>
        </Paper>
      </SimpleGrid>

      <V16TryOnStudio locale={locale} shop={shop} settings={s} saveSettings={save} />
    </Stack>
  );
}
