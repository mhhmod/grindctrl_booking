import type { Metadata } from 'next';
import { LandingLocaleProvider } from '@/components/landing/landing-locale';
import { IntegrationsPageContent } from '@/components/integrations/integrations-page-content';
import { getRequestLocale } from '@/lib/auth/locale';

export const metadata: Metadata = {
  title: 'GrindCTRL Integrations',
  description:
    "See exactly which integrations are live, which need setup, and which are on the roadmap, checked against the code that ships them.",
};

export default async function IntegrationsPage() {
  const initialLocale = await getRequestLocale();

  return (
    <LandingLocaleProvider
      initialLocale={initialLocale}
      className="gc-landing-root gc-animated min-h-dvh overflow-x-hidden bg-background text-foreground"
    >
      <IntegrationsPageContent />
    </LandingLocaleProvider>
  );
}
