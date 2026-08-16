'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { DEFAULT_SITE_LOCALE, SITE_LOCALE_COOKIE, type SiteLocale } from '@/lib/landing/landing-i18n';
import { getAssistantDictionary, getDir, type AssistantTranslator } from '@/lib/assistant/i18n';

interface AssistantLocaleContextValue {
  locale: SiteLocale;
  dir: 'rtl' | 'ltr';
  t: AssistantTranslator;
}

const AssistantLocaleContext = createContext<AssistantLocaleContextValue | null>(null);

function readSiteLocaleCookie(): SiteLocale {
  if (typeof document === 'undefined') return DEFAULT_SITE_LOCALE;
  const match = document.cookie.match(new RegExp(`(?:^|; )${SITE_LOCALE_COOKIE}=([^;]*)`));
  return match?.[1] === 'ar' ? 'ar' : DEFAULT_SITE_LOCALE;
}

/** Reads the site-wide locale cookie once on mount — the assistant follows
 *  whichever language the visitor already picked elsewhere on the site
 *  rather than tracking its own preference. */
export function AssistantLocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale?: SiteLocale;
  children: React.ReactNode;
}) {
  const locale = initialLocale ?? readSiteLocaleCookie();

  const value = useMemo<AssistantLocaleContextValue>(
    () => ({ locale, dir: getDir(locale), t: getAssistantDictionary(locale) }),
    [locale],
  );

  return (
    <AssistantLocaleContext.Provider value={value}>
      <div dir={value.dir} lang={locale}>
        {children}
      </div>
    </AssistantLocaleContext.Provider>
  );
}

export function useAssistantLocale(): AssistantLocaleContextValue {
  const ctx = useContext(AssistantLocaleContext);
  if (!ctx) {
    throw new Error('useAssistantLocale must be used within an AssistantLocaleProvider');
  }
  return ctx;
}
