'use client';

import { useEffect, useState } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/button';
import { SITE_LOCALE_COOKIE, isSiteLocale, type SiteLocale } from '@/lib/landing/landing-i18n';

/* Segment error boundary for /claim — see app/dashboard/error.tsx, which this
 * is modelled on, for why one is needed at all: without it, a throw here
 * (redeeming ensureMessengerSite, a Supabase hiccup mid-adoption) escapes to
 * app/global-error.tsx's bare "Application error: a client-side exception
 * has occurred". A merchant who just tapped "claim this store" deserves
 * better than that, especially since their token is still good for up to
 * four more minutes — reset() re-renders the segment server-side and simply
 * re-verifies it, no new link needed for a transient failure.
 *
 * Unlike the dashboard boundary, retrying isn't always the answer: an
 * expired token can't be revived by reset(), so the copy also names the
 * fallback — reopening the app from Shopify admin mints a fresh one. */

const COPY = {
  en: {
    title: 'This did not go through',
    body: 'Something went wrong on our side. Trying again usually works — the problem is often momentary.',
    retry: 'Try again',
    fallback: "If retrying doesn't help, reopen GRINDCTRL from your Shopify admin for a fresh link.",
    reference: 'Reference',
  },
  ar: {
    title: 'لم تكتمل هذه العملية',
    body: 'حدث خطأ من جانبنا. إعادة المحاولة تنجح عادةً — فالمشكلة غالباً مؤقتة.',
    retry: 'إعادة المحاولة',
    fallback: 'إذا لم تنجح إعادة المحاولة، أعد فتح GRINDCTRL من لوحة تحكم Shopify للحصول على رابط جديد.',
    reference: 'الرقم المرجعي',
  },
} as const;

function readLocale(): SiteLocale {
  if (typeof document === 'undefined') return 'en';
  const match = document.cookie.match(new RegExp(`(?:^|; )${SITE_LOCALE_COOKIE}=([^;]*)`));
  const value = match?.[1] && decodeURIComponent(match[1]);
  return isSiteLocale(value) ? value : 'en';
}

export default function ClaimError({
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
        <p className="mt-1 text-xs text-muted-foreground">{t.fallback}</p>
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
