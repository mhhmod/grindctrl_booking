'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { SIGNED_OUT_VIEWER, type SiteViewer } from '@/lib/auth/site-viewer';

type SiteViewerContextValue = { viewer: SiteViewer; clerk: boolean };

const SiteViewerContext = React.createContext<SiteViewerContextValue>({ viewer: SIGNED_OUT_VIEWER, clerk: false });

/** The viewer the server resolved for this page load (app/layout.tsx).
 *  Without a provider, as outside the app, everyone is signed out. */
export function SiteViewerProvider({
  viewer,
  clerk,
  children,
}: {
  viewer: SiteViewer;
  /** Whether a ClerkProvider is above, so the session can be followed. */
  clerk: boolean;
  children: React.ReactNode;
}) {
  const value = React.useMemo(() => ({ viewer, clerk }), [viewer, clerk]);
  return <SiteViewerContext.Provider value={value}>{children}</SiteViewerContext.Provider>;
}

export function useSiteViewer(): SiteViewerContextValue {
  return React.useContext(SiteViewerContext);
}

/* The root layout is not drawn again when the person moves between pages in
   the app, so its viewer can go stale: signing out from the dashboard, then
   following a link to the home page, would still say "Open dashboard".
   When Clerk's own session disagrees with the server's answer, ask the
   server again, once per disagreement. Only marketing headers mount this:
   on the dashboard, a session that ends is SessionGuard's job, and a refresh
   there would throw away unsent work. */
export function SiteViewerSync({ signedIn }: { signedIn: boolean }) {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const askedFor = React.useRef<boolean | null>(null);

  React.useEffect(() => {
    if (!isLoaded) return;
    const clientSignedIn = Boolean(isSignedIn);
    if (clientSignedIn === signedIn) {
      askedFor.current = null;
      return;
    }
    if (askedFor.current === clientSignedIn) return;
    askedFor.current = clientSignedIn;
    router.refresh();
  }, [isLoaded, isSignedIn, signedIn, router]);

  return null;
}
