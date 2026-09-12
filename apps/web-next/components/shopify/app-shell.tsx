'use client';

import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';
import { Button } from '@/components/ui/button';
import { ShopifyAdminSettings } from '@/components/shopify/admin-settings';
import { AutoClaim, startShopifyClaim } from '@/components/shopify/auto-claim';
import { ensureShopToken } from '@/components/shopify/ensure-shop-token';
import { StoreChatEmbedded } from '@/components/shopify/store-chat-embedded';
import type { TryOnLocale } from '@/lib/try-on/i18n';

const COPY = {
  en: {
    tryOn: 'Try-On',
    storeChat: 'Store Chat',
    sections: 'GRINDCTRL sections',
    themeToggle: 'Switch between light and dark',
    claimStore: 'Claim this store',
    claimExplanation: 'Opens grindctrl.cloud to sign in and manage full settings in your dashboard; Store Chat keeps working in Shopify admin either way.',
    claimAlreadyConnected: 'Already connected',
    claimError: 'Could not connect — try again',
  },
  ar: {
    tryOn: 'التجربة الافتراضية',
    storeChat: 'دردشة المتجر',
    sections: 'أقسام GRINDCTRL',
    themeToggle: 'التبديل بين الوضع الفاتح والداكن',
    claimStore: 'المطالبة بهذا المتجر',
    claimExplanation: 'يفتح grindctrl.cloud لتسجيل الدخول وإدارة الإعدادات الكاملة من لوحة تحكمك؛ وتستمر دردشة المتجر بالعمل داخل Shopify في كل الأحوال.',
    claimAlreadyConnected: 'متصل بالفعل',
    claimError: 'تعذّر الاتصال — حاول مجدداً',
  },
} as const;

type ClaimButtonState = 'idle' | 'loading' | 'already-connected' | 'error';

type ShellTab = 'try-on' | 'store-chat';
const SHELL_TABS: readonly ShellTab[] = ['try-on', 'store-chat'];

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
  const t = COPY[locale === 'ar' ? 'ar' : 'en'];
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    void ensureShopToken()
      .catch(() => {})
      .finally(() => setTokenBootstrapped(true));
  }, []);

  return (
    <div className="mx-auto grid w-full min-w-0 max-w-6xl gap-4 p-4 sm:p-6">
      {tokenBootstrapped && <AutoClaim locale={locale} />}
      <header className="flex min-w-0 flex-wrap items-center justify-between gap-3 px-1 pt-1">
        <BrandLogo size="sm" />
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-xs text-muted-foreground"
              disabled={claimState === 'loading'}
              onClick={() => {
                setClaimState('loading');
                void startShopifyClaim()
                  .then((outcome) => {
                    setClaimState(outcome === 'already-linked' ? 'already-connected' : 'idle');
                  })
                  .catch(() => setClaimState('error'));
              }}
            >
              {t.claimStore}
            </Button>
            {claimState === 'already-connected' && (
              <span role="status" className="text-xs text-muted-foreground">
                {t.claimAlreadyConnected}
              </span>
            )}
            {claimState === 'error' && (
              <span role="alert" className="text-xs text-destructive">
                {t.claimError}
              </span>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            aria-label={t.themeToggle}
            title={t.themeToggle}
          >
            <Sun className="hidden size-4 dark:block" />
            <Moon className="size-4 dark:hidden" />
          </Button>
        </div>
        {claimState === 'idle' && (
          <span className="min-w-0 basis-full text-xs leading-relaxed text-foreground">
            {t.claimExplanation}
          </span>
        )}
      </header>

      <nav aria-label={t.sections} className="min-w-0">
        <ul className="flex flex-wrap gap-1 border-b border-border pb-px">
          {SHELL_TABS.map((id) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => setTab(id)}
                aria-current={tab === id ? 'page' : undefined}
                className={`inline-flex rounded-t-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 ${
                  tab === id
                    ? 'border-b-2 border-primary font-semibold text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {id === 'try-on' ? t.tryOn : t.storeChat}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {tab === 'try-on' ? <ShopifyAdminSettings locale={locale} /> : <StoreChatEmbedded locale={locale === 'ar' ? 'ar' : 'en'} />}
    </div>
  );
}
