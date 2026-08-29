'use client';

import { useEffect, useState } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/button';
import { SITE_LOCALE_COOKIE, isSiteLocale, type SiteLocale } from '@/lib/landing/landing-i18n';

/* Segment error boundary for the whole dashboard.
 *
 * Without one, a throw in any dashboard Server Component escapes all the way
 * to app/global-error.tsx, which replaces the entire document with Next's bare
 * "Application error: a client-side exception has occurred". That is what a
 * merchant saw when provisioning lost a first-visit race: no nav, no shell, no
 * indication of what broke or whether retrying would help.
 *
 * This keeps the failure inside the page area, says something true, and offers
 * the retry — which matters because most failures here are transient (a lost
 * race, a slow query, a provider blip) and reset() re-renders the segment
 * server-side rather than reloading the app. */

const COPY = {
  en: {
    title: 'This page did not load',
    body: 'Something went wrong on our side. Trying again usually works — the problem is often momentary.',
    retry: 'Try again',
    reference: 'Reference',
  },
  ar: {
    title: 'تعذّر تحميل هذه الصفحة',
    body: 'حدث خطأ من جانبنا. إعادة المحاولة تنجح عادةً — فالمشكلة غالباً مؤقتة.',
    retry: 'إعادة المحاولة',
    reference: 'الرقم المرجعي',
  },
} as const;

function readLocale(): SiteLocale {
  if (typeof document === 'undefined') return 'en';
  const match = document.cookie.match(new RegExp(`(?:^|; )${SITE_LOCALE_COOKIE}=([^;]*)`));
  const value = match?.[1] && decodeURIComponent(match[1]);
  return isSiteLocale(value) ? value : 'en';
}

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  /* Resolved after hydration: the server cannot know the cookie here (this is
     a client component with no props for it), and guessing during render
     would mismatch. */
  const [locale, setLocale] = useState<SiteLocale>('en');
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- post-hydration locale read, see above
    setLocale(readLocale());
  }, []);

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  const t = COPY[locale];

  return (
    <section
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      lang={locale}
      className="grid min-w-0 place-items-center px-4 py-16"
    >
      <div className="grid max-w-md gap-3 text-center">
        <h1 className="text-lg font-semibold">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.body}</p>
        <div className="mt-1 flex justify-center">
          <Button onClick={reset}>{t.retry}</Button>
        </div>
        {/* The digest is the only handle connecting what the merchant saw to
            the server log line, since production omits the real message. */}
        {error.digest && (
          <p className="mt-2 text-xs text-muted-foreground">
            {t.reference}: <code className="font-mono">{error.digest}</code>
          </p>
        )}
      </div>
    </section>
  );
}
