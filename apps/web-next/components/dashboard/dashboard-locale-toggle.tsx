'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SITE_LOCALE_COOKIE, type SiteLocale } from '@/lib/landing/landing-i18n';

/* Language switch for the dashboard.

   The dashboard already READ the shared gc-locale cookie, but nothing inside
   it could WRITE that cookie: the only writer was the toggle on the marketing
   site. So a merchant could land on an Arabic dashboard with no way to change
   it, or an English one they could only switch by leaving, toggling on the
   landing page, and coming back.

   The language is resolved server-side (the layout sets dir and lang, and the
   nav labels come from a server dictionary), so flipping the cookie has to be
   followed by router.refresh() to re-render the tree. Setting local state
   instead would translate nothing. */
export function DashboardLocaleToggle({
  locale,
  className,
}: {
  locale: SiteLocale;
  className?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const next: SiteLocale = locale === 'ar' ? 'en' : 'ar';
  // Label the language you would switch TO, written in that language.
  const label = next === 'ar' ? 'العربية' : 'English';

  function toggle() {
    document.cookie = `${SITE_LOCALE_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={toggle}
      disabled={isPending}
      aria-label={next === 'ar' ? 'التبديل إلى العربية' : 'Switch to English'}
      className={cn('gc-tap h-9 gap-1.5 rounded-full px-2.5 text-xs font-semibold', className)}
    >
      <Languages className="size-4" aria-hidden="true" />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}
