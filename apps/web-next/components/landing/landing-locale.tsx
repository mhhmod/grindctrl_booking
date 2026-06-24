'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  DEFAULT_SITE_LOCALE,
  getDir,
  getLandingDictionary,
  SITE_LOCALE_COOKIE,
  type LandingTranslator,
  type SiteLocale,
} from '@/lib/landing/landing-i18n';

interface LandingLocaleContextValue {
  locale: SiteLocale;
  dir: 'rtl' | 'ltr';
  t: LandingTranslator;
  toggleLocale: () => void;
}

const LandingLocaleContext = createContext<LandingLocaleContextValue | null>(null);

function persistLocale(locale: SiteLocale) {
  if (typeof document === 'undefined') return;
  document.cookie = `${SITE_LOCALE_COOKIE}=${locale};path=/;max-age=31536000;samesite=lax`;
}

export function LandingLocaleProvider({
  initialLocale = DEFAULT_SITE_LOCALE,
  className,
  children,
}: {
  initialLocale?: SiteLocale;
  className?: string;
  children: React.ReactNode;
}) {
  const [locale, setLocale] = useState<SiteLocale>(initialLocale);

  const toggleLocale = useCallback(() => {
    setLocale((prev) => {
      const next: SiteLocale = prev === 'ar' ? 'en' : 'ar';
      persistLocale(next);
      return next;
    });
  }, []);

  const value = useMemo<LandingLocaleContextValue>(
    () => ({ locale, dir: getDir(locale), t: getLandingDictionary(locale), toggleLocale }),
    [locale, toggleLocale],
  );

  return (
    <LandingLocaleContext.Provider value={value}>
      <div dir={value.dir} lang={locale} className={className}>
        {children}
      </div>
    </LandingLocaleContext.Provider>
  );
}

export function useLandingLocale(): LandingLocaleContextValue {
  const ctx = useContext(LandingLocaleContext);
  if (!ctx) {
    throw new Error('useLandingLocale must be used within a LandingLocaleProvider');
  }
  return ctx;
}

export function LandingLocaleToggle({ className }: { className?: string }) {
  const { t, toggleLocale } = useLandingLocale();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={t.langToggleLabel}
      onClick={toggleLocale}
      id="landing-locale-toggle"
      className={cn(
        'h-9 rounded-full border border-border bg-card/70 px-3 text-xs font-semibold backdrop-blur transition-colors hover:bg-muted',
        className,
      )}
    >
      <Languages className="size-4" aria-hidden="true" />
      <span>{t.langSwitchTo}</span>
    </Button>
  );
}
