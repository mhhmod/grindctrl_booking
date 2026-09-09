'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  DEFAULT_SITE_LOCALE,
  getDir,
  getLandingDictionary,
  type LandingTranslator,
  type SiteLocale,
} from '@/lib/landing/landing-i18n';
import { persistSiteLocale } from '@/lib/landing/site-locale-store';

interface LandingLocaleContextValue {
  locale: SiteLocale;
  dir: 'rtl' | 'ltr';
  t: LandingTranslator;
  toggleLocale: () => void;
}

const LandingLocaleContext = createContext<LandingLocaleContextValue | null>(null);

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
    const next: SiteLocale = locale === 'ar' ? 'en' : 'ar';
    setLocale(next);
    // Notify sibling consumers outside the state updater/render phase.
    persistSiteLocale(next);
  }, [locale]);

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
        'gc-tap h-9 rounded-full border border-border bg-card/70 px-2.5 text-xs font-semibold backdrop-blur transition-colors hover:bg-muted sm:px-3',
        className,
      )}
    >
      <Languages className="size-4" aria-hidden="true" />
      <span className="hidden sm:inline">{t.langSwitchTo}</span>
    </Button>
  );
}
