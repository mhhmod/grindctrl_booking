'use client';

import React from 'react';
import { useClerk } from '@clerk/nextjs';
import { Button } from '@mantine/core';
import { authPageHref } from '@/lib/auth/redirect';
import { beginSignOut, cancelSignOut } from '@/lib/auth/session-ended';

/* Signs out of the account that does not match, then opens sign-in with the
   same claim link as its destination, so the right account picks up exactly
   where this one stopped. */
export function SwitchAccountButton({ label, returnTo }: { label: string; returnTo: string }) {
  const clerk = useClerk();
  const [pending, setPending] = React.useState(false);

  function switchAccount() {
    if (pending) return;
    setPending(true);
    beginSignOut();
    clerk.signOut({ redirectUrl: authPageHref('/sign-in', returnTo) }).catch(() => {
      cancelSignOut();
      setPending(false);
    });
  }

  return (
    <Button type="button" radius="pill" h={44} loading={pending} onClick={switchAccount}>
      {label}
    </Button>
  );
}
