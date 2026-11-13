'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from '@/components/dashboard/theme-toggle';
import { applyDocumentLocale, LanguageSwitch } from '@/components/site/language-switch';
import { persistSiteLocale } from '@/lib/landing/site-locale-store';
import type { SiteLocale } from '@/lib/landing/landing-i18n';

/* Language and theme on the auth pages, the same controls the site header
   uses. The language lives in the shared gc-locale cookie; a refresh
   re-renders the shell and hands Clerk its new localization, while
   anything typed into the form stays put. */
export function AuthPreferences({ locale }: { locale: SiteLocale }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function switchLanguage() {
    const next: SiteLocale = locale === 'ar' ? 'en' : 'ar';
    persistSiteLocale(next);
    applyDocumentLocale(next);
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex items-center justify-end gap-2" aria-busy={pending || undefined}>
      <LanguageSwitch locale={locale} onSwitch={switchLanguage} className="min-h-11" />
      <ThemeToggle locale={locale} className="h-11 min-w-11" />
    </div>
  );
}
