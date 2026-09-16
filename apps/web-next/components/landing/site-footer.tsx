'use client';

import React from 'react';
import Link from 'next/link';
import { BrandLogo } from '@/components/brand-logo';
import { ThemeToggle } from '@/components/dashboard/theme-toggle';
import { AnalyticsConsentControl } from '@/components/landing/analytics-consent-control';
import { LandingLocaleToggle, useLandingLocale } from '@/components/landing/landing-locale';
import { cn } from '@/lib/utils';

const DEMO_URL = '/try-on';

/* The one footer for every public marketing page. Full-site discovery is the
   header's and app/sitemap.ts's job — this keeps the same minimal link set
   everywhere rather than growing into a second sitemap per page. */
export function SiteFooter({
  withConsentControl = false,
  withLauncherSpacing = false,
}: {
  withConsentControl?: boolean;
  withLauncherSpacing?: boolean;
}) {
  const { locale, t } = useLandingLocale();

  return (
    <footer
      className={cn(
        'px-4 text-sm text-muted-foreground sm:px-6 lg:px-8',
        // Reserves the floating chat launcher's footprint plus a small gap so
        // locale/theme controls stay reachable underneath it (homepage only).
        withLauncherSpacing ? 'pb-24 pt-10' : 'py-10',
      )}
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        {withConsentControl ? <AnalyticsConsentControl /> : null}
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <BrandLogo size="sm" textClassName="text-xs" />
          <p className="text-xs">{t.footerTagline}</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
            <Link href="/" className="gc-tap transition-colors hover:text-foreground">
              {t.footerHome}
            </Link>
            <Link href={DEMO_URL} className="gc-tap transition-colors hover:text-foreground">
              {t.footerDemo}
            </Link>
            <Link href="/pricing" className="gc-tap transition-colors hover:text-foreground">
              {t.footerPricing}
            </Link>
            <Link href="/roi" className="gc-tap transition-colors hover:text-foreground">
              {t.footerRoi}
            </Link>
            <Link href="/security" className="gc-tap transition-colors hover:text-foreground">
              {t.footerSecurity}
            </Link>
          </div>
          {/* Second route to language/theme, same as the homepage — the
              header's controls live inside the mobile sheet only. */}
          <div className="flex items-center gap-2">
            <LandingLocaleToggle />
            <ThemeToggle locale={locale} />
          </div>
        </div>
      </div>
    </footer>
  );
}
