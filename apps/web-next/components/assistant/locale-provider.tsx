'use client';

import React, { createContext, useContext, useMemo, useSyncExternalStore } from 'react';
import { DEFAULT_SITE_LOCALE, type SiteLocale } from '@/lib/landing/landing-i18n';
import { readSiteLocale, subscribeSiteLocale } from '@/lib/landing/site-locale-store';
import { getAssistantDictionary, getDir, type AssistantTranslator } from '@/lib/assistant/i18n';

interface AssistantLocaleContextValue {
  locale: SiteLocale;
  dir: 'rtl' | 'ltr';
  t: AssistantTranslator;
}

const AssistantLocaleContext = createContext<AssistantLocaleContextValue | null>(null);

/** Follows the shared cookie and explicit language changes. The server
 * snapshot preserves hydration; a persistent layout must not freeze its
 * initialLocale prop after the visitor changes language elsewhere. */
export function AssistantLocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale?: SiteLocale;
  children: React.ReactNode;
}) {
  const fallback = initialLocale ?? DEFAULT_SITE_LOCALE;
  const locale = useSyncExternalStore(
    subscribeSiteLocale,
    () => readSiteLocale(fallback),
    () => fallback,
  );

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
