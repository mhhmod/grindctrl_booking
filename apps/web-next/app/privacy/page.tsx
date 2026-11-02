import type { Metadata } from 'next';
import { LandingLocaleProvider } from '@/components/landing/landing-locale';
import { LegalPageContent } from '@/components/marketing/legal-page-content';
import { getRequestLocale } from '@/lib/auth/locale';

export const metadata: Metadata = {
  title: 'GrindCTRL Privacy Policy',
  description: 'How Grind CTRL handles merchant and shopper data, privacy requests, retention, and account deletion.',
};

export default async function PrivacyPage() {
  const initialLocale = await getRequestLocale();
  return (
    <LandingLocaleProvider
      initialLocale={initialLocale}
      className="gc-landing-root gc-animated min-h-dvh overflow-x-hidden bg-background text-foreground"
    >
      <LegalPageContent page="privacy" />
    </LandingLocaleProvider>
  );
}
