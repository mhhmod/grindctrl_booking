import React from 'react';
import Link from 'next/link';
import type { SiteLocale } from '@/lib/landing/landing-i18n';

/** Public legal pages, reachable before sign-up and from the dashboard. */
export function LegalLinks({ locale }: { locale: SiteLocale }) {
  return (
    <nav aria-label={locale === 'ar' ? 'روابط قانونية' : 'Legal'} className="flex min-w-0 flex-wrap gap-x-4 text-sm text-muted-foreground">
      <Link href="/privacy" className="inline-flex min-h-11 items-center hover:underline">
        {locale === 'ar' ? 'سياسة الخصوصية' : 'Privacy policy'}
      </Link>
      <Link href="/terms" className="inline-flex min-h-11 items-center hover:underline">
        {locale === 'ar' ? 'شروط الخدمة' : 'Terms of service'}
      </Link>
    </nav>
  );
}
