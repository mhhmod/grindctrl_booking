'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  DEFAULT_TRYON_LOCALE,
  getDictionary,
  getDir,
  TRYON_LOCALE_COOKIE,
  type TryOnLocale,
  type TryOnTranslator,
} from '@/lib/try-on/i18n';

interface TryOnLocaleContextValue {
  locale: TryOnLocale;
  dir: 'rtl' | 'ltr';
  t: TryOnTranslator;
  setLocale: (next: TryOnLocale) => void;
  toggleLocale: () => void;
}

const TryOnLocaleContext = createContext<TryOnLocaleContextValue | null>(null);

function persistLocale(locale: TryOnLocale) {
  if (typeof document === 'undefined') return;
  // 1 year, root path so the standalone page and future surfaces share it.
  document.cookie = `${TRYON_LOCALE_COOKIE}=${locale};path=/;max-age=31536000;samesite=lax`;
}

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
    persistLocale(next);
  }, []);

  const toggleLocale = useCallback(() => {
    setLocaleState((prev) => {
      const next: TryOnLocale = prev === 'ar' ? 'en' : 'ar';
      persistLocale(next);
      return next;
    });
  }, []);

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
