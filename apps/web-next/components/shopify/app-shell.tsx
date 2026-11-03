'use client';

import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { ActionIcon, Button, Group, Stack, Tabs, Text, useDirection } from '@mantine/core';
import { BrandLogo } from '@/components/brand-logo';
import { ShopifyAdminSettings } from '@/components/shopify/admin-settings';
import { AutoClaim, startShopifyClaim } from '@/components/shopify/auto-claim';
import { ensureShopToken } from '@/components/shopify/ensure-shop-token';
import { StoreChatEmbedded } from '@/components/shopify/store-chat-embedded';
import { ShopifyPlans } from '@/components/shopify/plans';
import type { ShopifyAppPricingPresentation } from '@/lib/shopify/app-pricing';
import { getDir, type TryOnLocale } from '@/lib/try-on/i18n';

const COPY = {
  en: {
    tryOn: 'Try-On',
    storeChat: 'Store Chat',
    plans: 'Plans',
    sections: 'GRINDCTRL sections',
    themeToggle: 'Switch between light and dark',
    claimStore: 'Claim this store',
    claimExplanation: 'Opens {host} to sign in and manage full settings in your dashboard; Store Chat keeps working in Shopify admin either way.',
    claimAlreadyConnected: 'Already connected',
    claimError: 'Could not connect. Try again',
  },
  ar: {
    tryOn: 'التجربة الافتراضية',
    storeChat: 'دردشة المتجر',
    plans: 'الباقات',
    sections: 'أقسام GRINDCTRL',
    themeToggle: 'التبديل بين الوضع الفاتح والداكن',
    claimStore: 'المطالبة بهذا المتجر',
    claimExplanation: 'يفتح {host} لتسجيل الدخول وإدارة الإعدادات الكاملة من لوحة تحكمك؛ وتستمر دردشة المتجر بالعمل داخل Shopify في كل الأحوال.',
    claimAlreadyConnected: 'متصل بالفعل',
    claimError: 'تعذّر الاتصال. حاول مجدداً',
  },
} as const;

type ClaimButtonState = 'idle' | 'loading' | 'already-connected' | 'error';

type ShellTab = 'try-on' | 'store-chat' | 'plans';
const SHELL_TABS: readonly ShellTab[] = ['try-on', 'store-chat', 'plans'];

function publicAppHost() {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://grindctrl.cloud').host || 'grindctrl.cloud';
  } catch {
    return 'grindctrl.cloud';
  }
}

/* The shell is rendered inside MantineUiProvider (app/shopify/app page), so
   every tab, not only Plans, has the brand's colours, font and direction. */
export function ShopifyAppShell({ locale }: { locale: TryOnLocale }) {
  const [tab, setTab] = useState<ShellTab>('try-on');
  const [claimState, setClaimState] = useState<ClaimButtonState>('idle');
  /* AutoClaim's automatic redirect must not race EnsureShopToken's OAuth
     token-exchange write: on a brand-new install, ownership verification
     (app/claim/page.tsx) needs that token, and firing the redirect before
     it finishes stored a plausible false "not you" for the merchant's very
     first, legitimate attempt. Gating AutoClaim's mount on this settling
     first (success or failure -- either way it's had its chance) removes
     the race instead of hoping the timing works out. */
  const [tokenBootstrapped, setTokenBootstrapped] = useState(false);
  const [appPricing, setAppPricing] = useState<ShopifyAppPricingPresentation | null>(null);
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);
  const t = COPY[locale === 'ar' ? 'ar' : 'en'];
  const { resolvedTheme, setTheme } = useTheme();
  const { setDirection } = useDirection();

  /* The merchant's admin language, not the site's cookie, decides this page's
     direction (page.tsx sets it on <main>). Mantine reads <html dir> for
     keyboard navigation and popover placement, so keep that in step. */
  useEffect(() => {
    setDirection(getDir(locale));
  }, [locale, setDirection]);

  useEffect(() => {
    let cancelled = false;
    void ensureShopToken()
      .then((result) => { if (!cancelled) setAppPricing(result?.appPricing ?? null); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setTokenBootstrapped(true); });
    return () => { cancelled = true; };
  }, [bootstrapAttempt]);

  const claim = () => {
    setClaimState('loading');
    void startShopifyClaim()
      .then((outcome) => {
        setClaimState(outcome === 'already-linked' ? 'already-connected' : 'idle');
      })
      .catch(() => setClaimState('error'));
  };

  return (
    <Stack gap="md" maw={1152} mx="auto" w="100%" p={{ base: 'md', sm: 'lg' }} style={{ minWidth: 0 }}>
      {tokenBootstrapped && <AutoClaim locale={locale} />}
      <Group component="header" justify="space-between" gap="sm" wrap="wrap" px={4} pt={4}>
        <BrandLogo size="sm" />
        <Group gap="xs" wrap="wrap" style={{ minWidth: 0 }}>
          <Button
            type="button"
            variant="subtle"
            radius="pill"
            mih={44}
            loading={claimState === 'loading'}
            onClick={claim}
          >
            {t.claimStore}
          </Button>
          {claimState === 'already-connected' && (
            <Text role="status" size="xs" c="dimmed">
              {t.claimAlreadyConnected}
            </Text>
          )}
          {claimState === 'error' && (
            <Text role="alert" size="xs" c="danger">
              {t.claimError}
            </Text>
          )}
          <ActionIcon
            type="button"
            variant="subtle"
            size={44}
            radius="pill"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            aria-label={t.themeToggle}
            title={t.themeToggle}
          >
            <Sun className="hidden size-4 dark:block" />
            <Moon className="size-4 dark:hidden" />
          </ActionIcon>
        </Group>
        {claimState === 'idle' && (
          <Text size="xs" w="100%" style={{ overflowWrap: 'anywhere' }}>
            {t.claimExplanation.replace('{host}', publicAppHost())}
          </Text>
        )}
      </Group>

      <Tabs value={tab} onChange={(next) => next && setTab(next as ShellTab)} keepMounted={false} style={{ minWidth: 0 }}>
        <Tabs.List aria-label={t.sections}>
          {SHELL_TABS.map((id) => (
            <Tabs.Tab key={id} value={id} mih={44}>
              {id === 'try-on' ? t.tryOn : id === 'store-chat' ? t.storeChat : t.plans}
            </Tabs.Tab>
          ))}
        </Tabs.List>

        <Tabs.Panel value="try-on" pt="md">
          {tokenBootstrapped && <ShopifyAdminSettings locale={locale} />}
        </Tabs.Panel>
        <Tabs.Panel value="store-chat" pt="md">
          {tokenBootstrapped && <StoreChatEmbedded locale={locale === 'ar' ? 'ar' : 'en'} />}
        </Tabs.Panel>
        <Tabs.Panel value="plans" pt="md">
          {tokenBootstrapped && (
            <ShopifyPlans
              locale={locale === 'ar' ? 'ar' : 'en'}
              appPricing={appPricing}
              onRetry={() => {
                setTokenBootstrapped(false);
                setAppPricing(null);
                setBootstrapAttempt((attempt) => attempt + 1);
              }}
            />
          )}
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
