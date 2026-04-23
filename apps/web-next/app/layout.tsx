import type {Metadata} from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'GRINDCTRL Dashboard',
  description: 'Manage your GRINDCTRL widget sites, install snippets, settings, domains, intents, and leads.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  return (
    <html lang="en">
      <body suppressHydrationWarning>
        {clerkConfigured ? <ClerkProvider>{children}</ClerkProvider> : children}
      </body>
    </html>
  );
}
