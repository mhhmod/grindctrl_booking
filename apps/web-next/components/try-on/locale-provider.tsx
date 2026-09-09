'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  DEFAULT_TRYON_LOCALE,
  getDictionary,
  getDir,
  type TryOnLocale,
  type TryOnTranslator,
} from '@/lib/try-on/i18n';
import { persistSiteLocale } from '@/lib/landing/site-locale-store';

interface TryOnLocaleContextValue {
  locale: TryOnLocale;
  dir: 'rtl' | 'ltr';
  t: TryOnTranslator;
  setLocale: (next: TryOnLocale) => void;
  toggleLocale: () => void;
}

const TryOnLocaleContext = createContext<TryOnLocaleContextValue | null>(null);

export function TryOnLocaleProvider({
  initialLocale = DEFAULT_TRYON_LOCALE,
  className,
  children,
}: {
  initialLocale?: TryOnLocale;
  className?: string;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<TryOnLocale>(initialLocale);

  const setLocale = useCallback((next: TryOnLocale) => {
    setLocaleState(next);
    persistSiteLocale(next);
  }, []);

  const toggleLocale = useCallback(() => {
    const next: TryOnLocale = locale === 'ar' ? 'en' : 'ar';
    setLocaleState(next);
    persistSiteLocale(next);
  }, [locale]);

  const value = useMemo<TryOnLocaleContextValue>(
    () => ({
      locale,
      dir: getDir(locale),
      t: getDictionary(locale),
      setLocale,
      toggleLocale,
    }),
    [locale, setLocale, toggleLocale],
  );

  return (
    <TryOnLocaleContext.Provider value={value}>
      <div dir={value.dir} lang={locale} className={className}>
        {children}
      </div>
    </TryOnLocaleContext.Provider>
  );
}

export function useTryOnLocale(): TryOnLocaleContextValue {
  const ctx = useContext(TryOnLocaleContext);
  if (!ctx) {
    throw new Error('useTryOnLocale must be used within a TryOnLocaleProvider');
  }
  return ctx;
}
