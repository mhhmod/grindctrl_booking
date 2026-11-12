'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@mantine/core';
import { V16Notice } from '@/components/dashboard/v16/notice';
import { SwitchAccountButton } from './switch-account-button';

type ClaimAction = { label: string; href: string };

/* The notice and its buttons, with the account switch passed in, so it can
   be drawn without a Clerk session (app/dev/auth-check). */
export function ClaimMessageView({
  locale,
  title,
  body,
  actions,
  primary,
}: {
  locale: 'en' | 'ar';
  title: string;
  body: string;
  actions?: ClaimAction[];
  /** Shown first, as the main action, before the links. */
  primary?: React.ReactNode;
}) {
  return (
    <section dir={locale === 'ar' ? 'rtl' : 'ltr'} lang={locale} className="grid min-w-0 place-items-center px-4 py-16">
      <V16Notice title={title} body={body}>
        {primary}
        {actions?.map((action, index) => (
          <Button
            key={action.href}
            component={Link}
            href={action.href}
            radius="pill"
            h={44}
            variant={index === 0 && !primary ? 'filled' : 'subtle'}
          >
            {action.label}
          </Button>
        ))}
      </V16Notice>
    </section>
  );
}

/* The /claim outcome page: one message, and the real next steps for it. */
export function ClaimMessage({
  switchAccount,
  ...view
}: {
  locale: 'en' | 'ar';
  title: string;
  body: string;
  /** Real, working next steps, never a fabricated contact link. */
  actions?: ClaimAction[];
  /** Signed in with an account that cannot claim this store: sign out and
   *  come back to the same claim link with another one. Shown first. */
  switchAccount?: { label: string; returnTo: string };
}) {
  return (
    <ClaimMessageView
      {...view}
      primary={switchAccount ? <SwitchAccountButton label={switchAccount.label} returnTo={switchAccount.returnTo} /> : undefined}
    />
  );
}
