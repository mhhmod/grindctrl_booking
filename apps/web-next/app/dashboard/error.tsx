'use client';

import { useEffect, useState } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@mantine/core';
import { V16Notice, V16NoticeNote } from '@/components/dashboard/v16/notice';
import { getStatesCopy } from '@/lib/dashboard/states-copy';
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

  const t = getStatesCopy(locale).error;

  return (
    <V16Notice title={t.title} body={t.body}>
      <Button radius="pill" h={44} onClick={reset}>
        {t.retry}
      </Button>
      {/* The digest is the only handle connecting what the merchant saw to
          the server log line, since production omits the real message. */}
      {error.digest && (
        <V16NoticeNote>
          {t.reference}: <code>{error.digest}</code>
        </V16NoticeNote>
      )}
    </V16Notice>
  );
}
