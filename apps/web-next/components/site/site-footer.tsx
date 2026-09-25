'use client';

/* The v15 footer: the mark, the page's own links and the language pair, with
   the analytics consent control and the theme toggle kept from the previous
   footer. It takes its locale and links as props because the try-on page
   runs under TryOnLocaleProvider, not LandingLocaleProvider. */

import * as React from 'react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/dashboard/theme-toggle';
import { AnalyticsConsentControl } from '@/components/landing/analytics-consent-control';
import type { SiteLocale } from '@/lib/landing/landing-i18n';
import { cn } from '@/lib/utils';
import { LanguageSwitch } from './language-switch';
import { GrindctrlMark } from './marks';

export type SiteFooterLink = {
  id: string;
  label: string;
  href: string;
  onSelect?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
};

export function SiteFooter({
  locale,
  links,
  onSwitchLocale,
  onBrandClick,
  copy,
  withConsentControl = true,
  withLauncherSpacing = false,
  className,
}: {
  locale: SiteLocale;
  links: SiteFooterLink[];
  onSwitchLocale: () => void;
  onBrandClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  copy: { brandHome: string; footerNav: string; copyright: string; copyrightShort?: string };
  withConsentControl?: boolean;
  /** Reserves the floating assistant launcher's footprint so the footer controls stay reachable. */
  withLauncherSpacing?: boolean;
  className?: string;
}) {
  const currentName = locale === 'ar' ? 'العربية' : 'English';

  return (
    <footer
      className={cn('relative', withLauncherSpacing ? 'pb-24 pt-8' : 'pb-10 pt-8', className)}
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 sm:px-6 lg:px-8">
        {withConsentControl ? <AnalyticsConsentControl locale={locale} /> : null}
        <div className="flex flex-col items-center gap-4 border-t border-border pt-7 text-center lg:flex-row lg:justify-between lg:gap-6 lg:text-start">
          <Link
            href="/"
            onClick={onBrandClick}
            aria-label={copy.brandHome}
            className="flex items-center gap-2.5 rounded-full text-foreground"
          >
            <GrindctrlMark className="h-5 w-[30px] lg:h-6 lg:w-9" />
            <span lang="en" className="text-[13px] font-extrabold tracking-[0.1em] lg:text-[15px]">
              GRINDCTRL
            </span>
          </Link>
          <nav aria-label={copy.footerNav}>
            <ul className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-sm lg:gap-x-6">
              {links.map((link) => (
                <li key={link.id}>
                  <Link
                    href={link.href}
                    onClick={link.onSelect}
                    className="inline-flex min-h-11 items-center text-gc-text-2 hover:text-foreground hover:underline focus-visible:underline"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-sm">
              <span aria-current="true" className="font-bold">
                {currentName}
              </span>
              <span aria-hidden="true" className="text-gc-inactive">
                ·
              </span>
              <LanguageSwitch locale={locale} onSwitch={onSwitchLocale} className="h-11 px-2.5" />
            </span>
            <ThemeToggle locale={locale} className="h-11 min-w-11" />
          </div>
        </div>
        <p className="text-center text-xs text-gc-text-2 lg:text-[13px]">
          <span className="lg:hidden">{copy.copyrightShort ?? copy.copyright}</span>
          <span className="hidden lg:inline">{copy.copyright}</span>
        </p>
      </div>
    </footer>
  );
}
