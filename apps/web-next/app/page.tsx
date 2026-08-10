import type { Metadata } from 'next';
import { LandingLocaleProvider } from '@/components/landing/landing-locale';
import { SiteLanding } from '@/components/landing/site-landing';
import { getRequestLocale } from '@/lib/auth/locale';
import { listPublicPlanCatalog } from '@/lib/try-on/public-catalog';

export const metadata: Metadata = {
  title: 'GRINDCTRL | AI systems for online stores',
  description:
    'Managed AI for online stores, starting with virtual try-on for Shopify and extending to support, lead capture, and operations automation, in English and Arabic.',
};

export default async function LandingPage() {
  /* Resolved centrally so this page adapts to the browser's language on a
     first visit, rather than defaulting every new visitor to English. */
  const [initialLocale, catalog] = await Promise.all([
    getRequestLocale(),
    listPublicPlanCatalog(),
  ]);

  return (
    <LandingLocaleProvider
      initialLocale={initialLocale}
      className="gc-landing-root gc-animated min-h-dvh overflow-x-hidden bg-background text-foreground"
    >
      <SiteLanding plans={catalog.plans} />
    </LandingLocaleProvider>
  );
}
