import type { Metadata } from 'next';
import { LandingLocaleProvider } from '@/components/landing/landing-locale';
import { ShoppingPageContent } from '@/components/shopping/shopping-page-content';
import { getRequestLocale } from '@/lib/auth/locale';

export const metadata: Metadata = {
  title: 'GrindCTRL AI Shopping',
  description:
    'Let shoppers preview your products on themselves with AI-generated try-on, right on the product page. Bilingual, privacy-aware, and built for your catalog.',
};

export default async function ShoppingPage() {
  const initialLocale = await getRequestLocale();

  return (
    <LandingLocaleProvider
      initialLocale={initialLocale}
      className="gc-landing-root gc-animated min-h-dvh overflow-x-hidden bg-background text-foreground"
    >
      <ShoppingPageContent />
    </LandingLocaleProvider>
  );
}
