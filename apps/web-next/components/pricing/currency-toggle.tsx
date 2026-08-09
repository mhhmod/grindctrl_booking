'use client';

import React, { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useLandingLocale } from '@/components/landing/landing-locale';
import { CURRENCY_COOKIE, type Currency } from '@/lib/pricing/currency';

/* Always visible, not only when detection gets it wrong.

   IP lookup is wrong for VPN users, travellers and expats by nature, and a
   pricing page is the worst place to leave someone doubting what they are
   reading. One visible control costs less than a support conversation.

   Follows DashboardLocaleToggle: the price is resolved server-side, so setting
   the cookie has to be followed by router.refresh() to re-render. Local state
   would change the label and nothing else. */
export function CurrencyToggle({ currency }: { currency: Currency }) {
  const { locale } = useLandingLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const next: Currency = currency === 'EGP' ? 'USD' : 'EGP';
  const label =
    locale === 'ar' ? `اعرض الأسعار بـ ${next}` : `Show prices in ${next}`;

  function toggle() {
    document.cookie = `${CURRENCY_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={toggle}
      disabled={isPending}
      className="min-h-11 rounded-full border border-border px-4 text-xs font-semibold"
    >
      {label}
    </Button>
  );
}
