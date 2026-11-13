import { notFound } from 'next/navigation';
import { SiteViewerProvider } from '@/components/auth/site-viewer';
import { LandingLocaleProvider } from '@/components/landing/landing-locale';
import { MarketingChrome } from '@/components/site/marketing-chrome';
import { getRequestLocale } from '@/lib/auth/locale';
import type { SiteViewer } from '@/lib/auth/site-viewer';

/* Dev-only preview of the marketing header as a signed-in or signed-out
   visitor sees it, drawn from the real components without a Clerk session
   (e2e/site-header-account.spec.ts). The viewer is a fixture; in the app it
   comes from the session in app/layout.tsx.

   ?viewer= signed-out | signed-in */

const VIEWERS: Record<string, SiteViewer> = {
  'signed-out': { signedIn: false },
  'signed-in': { signedIn: true, initials: 'MS', imageUrl: null },
};

export default async function HeaderCheckPage({ searchParams }: { searchParams: Promise<{ viewer?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const viewer = VIEWERS[(await searchParams).viewer ?? ''] ?? VIEWERS['signed-out'];
  const locale = await getRequestLocale();
  return (
    <SiteViewerProvider viewer={viewer} clerk={false}>
      <LandingLocaleProvider
        initialLocale={locale}
        className="gc-landing-root gc-animated min-h-dvh overflow-x-hidden bg-background text-foreground"
      >
        <MarketingChrome>
          <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold">Header check</h1>
          </div>
        </MarketingChrome>
      </LandingLocaleProvider>
    </SiteViewerProvider>
  );
}
