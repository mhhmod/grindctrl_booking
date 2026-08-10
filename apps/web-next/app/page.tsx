import type { Metadata } from 'next';
import { LandingLocaleProvider } from '@/components/landing/landing-locale';
import { SiteLanding } from '@/components/landing/site-landing';
import { getRequestLocale } from '@/lib/auth/locale';

export const metadata: Metadata = {
  title: 'GRINDCTRL | AI systems for online stores',
  description:
    'Managed AI for online stores, starting with virtual try-on for Shopify and extending to support, lead capture, and operations automation, in English and Arabic.',
};

export default async function LandingPage() {
  /* Resolved centrally so this page adapts to the browser's language on a
     first visit, rather than defaulting every new visitor to English.

     No catalog fetch: the landing page no longer quotes prices, so it has no
     reason to hit the plan tables on every request. */
  const initialLocale = await getRequestLocale();

  return (
    <LandingLocaleProvider
      initialLocale={initialLocale}
      className="gc-landing-root gc-animated min-h-dvh overflow-x-hidden bg-background text-foreground"
    >
      <SiteLanding />
    </LandingLocaleProvider>
  );
}
