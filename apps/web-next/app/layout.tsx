import type {Metadata} from 'next';
// Self-hosted fonts (no build-time Google Fonts dependency).
import '@fontsource-variable/manrope';
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/500.css';
import '@fontsource/ibm-plex-sans-arabic/600.css';
import '@fontsource/ibm-plex-sans-arabic/700.css';
import { ClerkProvider } from '@clerk/nextjs';
import { arSA, enUS } from '@clerk/localizations';
import './globals.css';
import { cn } from "@/lib/utils";
import { ThemeProvider } from '@/components/theme-provider';
import { GcSpotlight, PostHogUserIdentification } from '@/components/gc-spotlight';
import { getRequestLocale } from '@/lib/auth/locale';

export const metadata: Metadata = {
  title: 'GRINDCTRL — AI Implementation & Automation',
  description:
    'GrindCTRL helps businesses integrate AI into operations across text, voice, images, video, files, CRMs, Google tools, cloud systems, and dashboards.',
};

export default async function RootLayout({children}: {children: React.ReactNode}) {
  const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  /* Clerk renders its own form copy, so it needs the same language the rest
     of the site resolved from the shared locale cookie. It only accepts this
     at the provider, not per component. */
  const locale = await getRequestLocale();

  return (
    <html lang="en" className={cn("font-sans")} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeProvider>
          <GcSpotlight />
          {clerkConfigured ? (
            <ClerkProvider localization={locale === 'ar' ? arSA : enUS}>
              <PostHogUserIdentification />
              {children}
            </ClerkProvider>
          ) : (
            children
          )}
        </ThemeProvider>
      </body>
    </html>
  );
}
