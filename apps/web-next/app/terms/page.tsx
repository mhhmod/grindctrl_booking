import type { Metadata } from 'next';
import { LandingLocaleProvider } from '@/components/landing/landing-locale';
import { LegalPageContent } from '@/components/marketing/legal-page-content';
import { getRequestLocale } from '@/lib/auth/locale';

export const metadata: Metadata = {
  title: 'GrindCTRL Terms of Service',
  description: 'Terms for using Grind CTRL virtual try-on, Store Chat, and the merchant dashboard.',
};

export default async function TermsPage() {
  const initialLocale = await getRequestLocale();
  return (
    <LandingLocaleProvider
      initialLocale={initialLocale}
      className="gc-landing-root gc-animated min-h-dvh overflow-x-hidden bg-background text-foreground"
    >
      <LegalPageContent page="terms" />
    </LandingLocaleProvider>
  );
}
