import type { Metadata } from 'next';
import { LandingLocaleProvider } from '@/components/landing/landing-locale';
import { SecurityPageContent } from '@/components/security/security-page-content';
import { getRequestLocale } from '@/lib/auth/locale';
import { socialMetadata } from '@/lib/site-metadata';

const title = 'GrindCTRL Security';
const description =
  'How GrindCTRL protects store and shopper data: access control, photo retention, Shopify privacy requests, and what is not in place yet.';

export const metadata: Metadata = {
  title,
  description,
  ...socialMetadata({ title, description, path: '/security' }),
};

export default async function SecurityPage() {
  const initialLocale = await getRequestLocale();

  return (
    <LandingLocaleProvider
      initialLocale={initialLocale}
      className="gc-landing-root gc-animated min-h-dvh overflow-x-hidden bg-background text-foreground"
    >
      <SecurityPageContent />
    </LandingLocaleProvider>
  );
}
