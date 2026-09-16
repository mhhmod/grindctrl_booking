import type { Metadata } from 'next';
import { LandingLocaleProvider } from '@/components/landing/landing-locale';
import { OperationsPageContent } from '@/components/operations/operations-page-content';
import { getRequestLocale } from '@/lib/auth/locale';

export const metadata: Metadata = {
  title: 'GrindCTRL Commerce Operations',
  description:
    'Order status inside chat, team takeover with an audit trail, and real visibility into conversation activity and try-on usage, honestly scoped to what is live today.',
};

export default async function OperationsPage() {
  const initialLocale = await getRequestLocale();

  return (
    <LandingLocaleProvider
      initialLocale={initialLocale}
      className="gc-landing-root gc-animated min-h-dvh overflow-x-hidden bg-background text-foreground"
    >
      <OperationsPageContent />
    </LandingLocaleProvider>
  );
}
