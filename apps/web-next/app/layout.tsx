import type {Metadata} from 'next';
import Script from 'next/script';
// Self-hosted fonts (no build-time Google Fonts dependency).
import '@fontsource-variable/manrope';
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/500.css';
import '@fontsource/ibm-plex-sans-arabic/600.css';
import '@fontsource/ibm-plex-sans-arabic/700.css';
import { headers } from 'next/headers';
import { ClerkProvider } from '@clerk/nextjs';
import { ColorSchemeScript } from '@mantine/core';
import { auth } from '@clerk/nextjs/server';
import './globals.css';
import { cn } from "@/lib/utils";
import { ThemeProvider } from '@/components/theme-provider';
import { GcSpotlight } from '@/components/gc-spotlight';
import { AssistantLauncher } from '@/components/assistant/launcher';
import { ClientBoundary } from '@/components/client-boundary';
import { SiteViewerProvider } from '@/components/auth/site-viewer';
import { clerkLocalization } from '@/lib/auth/clerk-localization';
import { getSiteViewer } from '@/lib/auth/site-viewer-server';
import { showLauncherFor } from '@/lib/assistant/launcher-visibility';
import { getRequestLocale } from '@/lib/auth/locale';
import { SIGNED_OUT_PATH } from '@/lib/auth/redirect';
import { getDir } from '@/lib/landing/landing-i18n';
import { siteUrl } from '@/lib/site-metadata';
import { BROWSER_RESILIENCE_SCRIPT } from '@/lib/landing/browser-resilience';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: 'GRINDCTRL | AI try-on and Store Chat for fashion stores',
  description:
    'GRINDCTRL gives fashion stores AI virtual try-on and Store Chat in English and Arabic. Live on Shopify and WooCommerce today, and on your own website for Store Chat only. Salla and Zid are planned.',
};

export default async function RootLayout({children}: {children: React.ReactNode}) {
  const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  /* Clerk renders its own form copy, so it needs the same language the rest
     of the site resolved from the shared locale cookie. It only accepts this
     at the provider, not per component. */
  const locale = await getRequestLocale();
  const pathname = (await headers()).get('x-pathname');
  /* auth() throws if clerkMiddleware() didn't run for this request — and
     proxy.ts's matcher deliberately excludes /embed/* (see its own
     comment: cookie-less third-party iframe context). That exclusion is the
     exact same matcher that leaves x-pathname unset, so `pathname === null`
     is already the correct signal for "middleware did not run here" — no
     new check needed. Without this guard, auth() crashed the whole root
     layout on every /embed/* request (Server Component render error,
     surfaced to visitors as the generic Next.js error page), which broke
     the merchant-facing try-on widget in production. */
  const { userId } = clerkConfigured && pathname !== null ? await auth() : { userId: null };
  /* The marketing header's signed-in state, decided here so the first paint
     is already right. Every page under this layout is rendered per request
     (it reads cookies and the session), so this never lands in a shared
     cache. */
  const viewer = await getSiteViewer(userId);
  const launcher = showLauncherFor(pathname, Boolean(userId)) ? (
    <ClientBoundary fallback={null}>
      <AssistantLauncher initialLocale={locale} />
    </ClientBoundary>
  ) : null;

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
      data-mantine-color-scheme="light"
      suppressHydrationWarning
    >
      <head>
        <Script id="gc-browser-resilience" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: BROWSER_RESILIENCE_SCRIPT }} />
        {/* Mantine (SaaS surfaces) reads its color scheme from this attribute.
            It follows next-themes' stored value, so it is correct before
            hydration. Only here: a script rendered deeper in the tree would
            be recreated on client navigation, where scripts never run. */}
        <ColorSchemeScript localStorageKey="theme" defaultColorScheme="light" />
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider>
          <GcSpotlight />
          {clerkConfigured ? (
            /* afterSignOutUrl: a sign-out Clerk starts itself (its account
               dialog) lands where the dashboard's own sign-out does. */
            <ClerkProvider localization={clerkLocalization(locale)} afterSignOutUrl={SIGNED_OUT_PATH}>
              <SiteViewerProvider viewer={viewer} clerk>
                {children}
                {launcher}
              </SiteViewerProvider>
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
