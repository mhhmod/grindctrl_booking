'use client';

import React, { useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';
import { Button } from '@/components/ui/button';
import { ShopifyAdminSettings } from '@/components/shopify/admin-settings';
import { StoreChatEmbedded } from '@/components/shopify/store-chat-embedded';
import type { TryOnLocale } from '@/lib/try-on/i18n';

const COPY = {
  en: { tryOn: 'Try-On', storeChat: 'Store Chat', sections: 'GRINDCTRL sections', themeToggle: 'Switch between light and dark' },
  ar: { tryOn: 'التجربة الافتراضية', storeChat: 'دردشة المتجر', sections: 'أقسام GRINDCTRL', themeToggle: 'التبديل بين الوضع الفاتح والداكن' },
} as const;

type ShellTab = 'try-on' | 'store-chat';
const SHELL_TABS: readonly ShellTab[] = ['try-on', 'store-chat'];

export function ShopifyAppShell({ locale }: { locale: TryOnLocale }) {
  const [tab, setTab] = useState<ShellTab>('try-on');
  const t = COPY[locale === 'ar' ? 'ar' : 'en'];
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <div className="mx-auto grid w-full min-w-0 max-w-6xl gap-4 p-4 sm:p-6">
      <header className="flex items-center justify-between gap-3 px-1 pt-1">
        <BrandLogo size="sm" />
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
