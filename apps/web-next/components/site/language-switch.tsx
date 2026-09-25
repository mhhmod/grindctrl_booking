'use client';

import * as React from 'react';
import { getDir, type SiteLocale } from '@/lib/landing/landing-i18n';
import { cn } from '@/lib/utils';

/* The switch always speaks the language it switches to: its label and its
   accessible name are written in that language, and lang says so, so a
   screen reader pronounces them correctly on either page. */
const TARGET: Record<SiteLocale, { label: string; ariaLabel: string; lang: SiteLocale }> = {
  en: { label: 'العربية', ariaLabel: 'التبديل إلى العربية', lang: 'ar' },
  ar: { label: 'English', ariaLabel: 'Switch to English', lang: 'en' },
};

export function languageSwitchTarget(current: SiteLocale) {
  return TARGET[current];
}

/**
 * The server renders lang and dir on <html> from the gc-locale cookie. After
 * a client-side switch they have to follow at once, because menus and
 * dialogs render in portals under <body> and would otherwise keep the old
 * direction until a reload.
 */
export function applyDocumentLocale(locale: SiteLocale): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale;
  document.documentElement.dir = getDir(locale);
}

export function LanguageSwitch({
  locale,
  onSwitch,
  className,
}: {
  /** The page's current language. */
  locale: SiteLocale;
  onSwitch: () => void;
  className?: string;
}) {
  const target = TARGET[locale];
  return (
    <button
      type="button"
      lang={target.lang}
      dir={getDir(target.lang)}
      aria-label={target.ariaLabel}
      onClick={onSwitch}
      className={cn(
        'inline-flex h-10 shrink-0 items-center justify-center rounded-full px-3 text-sm font-semibold text-gc-text-2 hover:bg-foreground/[0.07] hover:text-foreground',
        className,
      )}
    >
      {target.label}
    </button>
  );
}
