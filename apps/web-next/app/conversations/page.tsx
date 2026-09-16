import type { Metadata } from 'next';
import { LandingLocaleProvider } from '@/components/landing/landing-locale';
import { ConversationsPageContent } from '@/components/conversations/conversations-page-content';
import { getRequestLocale } from '@/lib/auth/locale';

export const metadata: Metadata = {
  title: 'GrindCTRL AI Conversations',
  description:
    'Store Chat answers storefront questions from your own store knowledge, looks up real orders safely, and hands off to your team on request.',
};

export default async function ConversationsPage() {
  /* Same central resolver as every other page (see app/roi/page.tsx). */
  const initialLocale = await getRequestLocale();

  return (
    <LandingLocaleProvider
      initialLocale={initialLocale}
      className="gc-landing-root gc-animated min-h-dvh overflow-x-hidden bg-background text-foreground"
    >
      <ConversationsPageContent />
    </LandingLocaleProvider>
  );
}
