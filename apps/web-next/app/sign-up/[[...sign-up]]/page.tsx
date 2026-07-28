import React from 'react';
import { AuthSignUp } from '@/components/auth/auth-clerk';
import { AuthShell } from '@/components/auth/auth-shell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getAuthCopy } from '@/lib/auth/auth-i18n';
import { getRequestLocale } from '@/lib/auth/locale';

export default async function SignUpPage() {
  const locale = await getRequestLocale();
  const copy = getAuthCopy(locale);

  const shellProps = {
    locale,
    copy,
    title: copy.signUpTitle,
    subtitle: copy.signUpSubtitle,
    footerPrompt: copy.signUpFooterPrompt,
    footerCtaLabel: copy.signUpFooterCta,
    footerCtaHref: '/sign-in',
  };

  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <AuthShell {...shellProps}>
        <Alert>
          <AlertTitle>Clerk environment variables are missing</AlertTitle>
          <AlertDescription>
            Add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` in `.env.local` to render the sign-up flow.
          </AlertDescription>
        </Alert>
      </AuthShell>
    );
  }

  return (
    <AuthShell {...shellProps}>
      <AuthSignUp />
    </AuthShell>
  );
}
