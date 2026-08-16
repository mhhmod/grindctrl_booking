import type {Metadata} from 'next';
// Self-hosted fonts (no build-time Google Fonts dependency).
import '@fontsource-variable/manrope';
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/500.css';
import '@fontsource/ibm-plex-sans-arabic/600.css';
import '@fontsource/ibm-plex-sans-arabic/700.css';
import { headers } from 'next/headers';
import { ClerkProvider } from '@clerk/nextjs';
import { arSA, enUS } from '@clerk/localizations';
import './globals.css';
import { cn } from "@/lib/utils";
import { ThemeProvider } from '@/components/theme-provider';
import { GcSpotlight } from '@/components/gc-spotlight';
import { AssistantLauncher } from '@/components/assistant/launcher';
import { showLauncherFor } from '@/lib/assistant/launcher-visibility';
import { getRequestLocale } from '@/lib/auth/locale';
import { getDir } from '@/lib/landing/landing-i18n';

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
  const pathname = (await headers()).get('x-pathname');
  const launcher = showLauncherFor(pathname) ? <AssistantLauncher initialLocale={locale} /> : null;

  return (
    /* lang and dir belong on <html>, not on a wrapper div. Anything rendered
       through a portal — the mobile menu, dialogs, toasts — mounts on <body>
       and escapes any wrapper, so it was inheriting English and LTR while the
       page was Arabic: the menu rendered Arabic in a Latin-only font, laid out
       left to right. Setting it here is the only place everything inherits
       from, and it also tells screen readers the truth about the page. */
    <html
      lang={locale}
      dir={getDir(locale)}
      className={cn('font-sans')}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <ThemeProvider>
          <GcSpotlight />
          {clerkConfigured ? (
            <ClerkProvider localization={locale === 'ar' ? arSA : enUS}>
              {children}
              {launcher}
            </ClerkProvider>
          ) : (
            <>
              {children}
              {launcher}
            </>
          )}
        </ThemeProvider>
      </body>
    </html>
  );
}
