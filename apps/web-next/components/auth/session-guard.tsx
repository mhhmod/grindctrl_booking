'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useClerk } from '@clerk/nextjs';
import { Button, Modal, Text } from '@mantine/core';
import { isSigningOutHere, SESSION_ENDED_EVENT, signInAgainHref } from '@/lib/auth/session-ended';
import { getStatesCopy } from '@/lib/dashboard/states-copy';
import type { SiteLocale } from '@/lib/landing/landing-i18n';

/* Keeps a dashboard tab honest about its session.

   The session can end while a page stays open: it expires, or the person
   signs out in another tab (Clerk shares that across tabs). Without this
   the page kept working until its next request, which then failed as a
   generic error or bounced away mid-reply. Now the tab says so, offers a
   sign-in that returns to the same page, and clears itself if the person
   signs in again in another tab.

   Two signals end it: Clerk's own session state going from a session to
   none, and a server action answering "signed out" (announceSessionEnded,
   lib/auth/session-ended.ts). Signing out on purpose from this tab is not
   an ending to report (beginSignOut). */

const SessionEndedContext = React.createContext(false);

/** True once this tab knows its session ended. */
export function useSessionEnded(): boolean {
  return React.useContext(SessionEndedContext);
}

function currentPage(): string {
  return `${window.location.pathname}${window.location.search}`;
}

/** The prompt itself, without the session wiring (also used by the dev preview). */
export function SessionEndedPrompt({ locale, opened, href }: { locale: SiteLocale; opened: boolean; href: string }) {
  const copy = getStatesCopy(locale).sessionEnded;
  return (
    <Modal
      opened={opened}
      onClose={() => {}}
      title={copy.title}
      centered
      withCloseButton={false}
      closeOnClickOutside={false}
      closeOnEscape={false}
      radius="lg"
    >
      <Text size="sm" c="dimmed" mb="lg">
        {copy.body}
      </Text>
      <Button component="a" href={href} radius="pill" h={44} fullWidth data-autofocus>
        {copy.action}
      </Button>
    </Modal>
  );
}

export function SessionGuard({ locale, children }: { locale: SiteLocale; children: React.ReactNode }) {
  const clerk = useClerk();
  const router = useRouter();
  const [ended, setEnded] = React.useState(false);
  /* The subscription below must live as long as Clerk does: re-subscribing
     would forget that this tab had a session. The router is read at the
     moment it is needed instead of being a dependency. */
  const routerRef = React.useRef(router);
  React.useEffect(() => {
    routerRef.current = router;
  }, [router]);

  React.useEffect(() => {
    let hadSession = false;
    let shown = false;
    const show = () => {
      if (isSigningOutHere() || shown) return;
      shown = true;
      setEnded(true);
    };
    const unsubscribe = clerk.addListener(({ session }) => {
      if (session) {
        hadSession = true;
        // Signed in again, in this tab or another: carry on where they were.
        if (shown) {
          shown = false;
          setEnded(false);
          routerRef.current.refresh();
        }
      } else if (hadSession) {
        show();
      }
    });
    window.addEventListener(SESSION_ENDED_EVENT, show);
    return () => {
      unsubscribe();
      window.removeEventListener(SESSION_ENDED_EVENT, show);
    };
  }, [clerk]);

  return (
    <SessionEndedContext.Provider value={ended}>
      {children}
      {ended ? <SessionEndedPrompt locale={locale} opened href={signInAgainHref(currentPage())} /> : null}
    </SessionEndedContext.Provider>
  );
}
