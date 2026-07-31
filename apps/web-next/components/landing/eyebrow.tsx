import React from 'react';
import { cn } from '@/lib/utils';
import type { SiteLocale } from '@/lib/landing/landing-i18n';

/* The small label above a section heading. Centralised because the inline
   version was repeated ~12 times across 5 files, and the Arabic case needs
   different typography rather than the same classes with a different string. */
export function Eyebrow({
  locale,
  className,
  children,
}: {
  locale: SiteLocale;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p
      className={cn(
        'text-[11px] font-semibold text-muted-foreground',
        /* Tracking reduced from 0.22em to 0.16em even in English: the original
           value overflowed at 320px on the longest labels.
           Arabic: drops uppercase/tracking (see class comment above) AND
           deliberately bumps size to text-xs (12px), overriding the base
           text-[11px] via twMerge — slightly larger type reads better without
           the crutch of letter-spacing on Arabic script. */
        locale === 'ar' ? 'text-xs' : 'uppercase tracking-[0.16em]',
        className,
      )}
    >
      {children}
    </p>
  );
}
