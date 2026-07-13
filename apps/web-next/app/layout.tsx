import type {Metadata} from 'next';
// Self-hosted fonts (no build-time Google Fonts dependency).
import '@fontsource-variable/manrope';
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/500.css';
import '@fontsource/ibm-plex-sans-arabic/600.css';
import '@fontsource/ibm-plex-sans-arabic/700.css';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';
import { cn } from "@/lib/utils";
import { ThemeProvider } from '@/components/theme-provider';
import { GcSpotlight } from '@/components/gc-spotlight';

export const metadata: Metadata = {
  title: 'GRINDCTRL — AI Implementation & Automation',
  description:
    'GrindCTRL helps businesses integrate AI into operations across text, voice, images, video, files, CRMs, Google tools, cloud systems, and dashboards.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  return (
    <html lang="en" className={cn("font-sans")} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeProvider>
          <GcSpotlight />
          {clerkConfigured ? <ClerkProvider>{children}</ClerkProvider> : children}
        </ThemeProvider>
      </body>
    </html>
  );
}
