import React from 'react';
import { AuthSignIn } from '@/components/auth/auth-clerk';
import { AuthShell } from '@/components/auth/auth-shell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getAuthCopy } from '@/lib/auth/auth-i18n';
import { getRequestLocale } from '@/lib/auth/locale';
import { resolveSignInDestination } from '@/lib/auth/redirect';

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const params = await searchParams;
  /* The middleware puts the page the visitor wanted into redirect_url when it
     bounces them here. Honour it when it is a safe same-site path. */
  const redirectTo = resolveSignInDestination(params.redirect_url);
  const locale = await getRequestLocale();
  const copy = getAuthCopy(locale);

  const shellProps = {
    locale,
    copy,
    title: copy.signInTitle,
    subtitle: copy.signInSubtitle,
    footerPrompt: copy.signInFooterPrompt,
    footerCtaLabel: copy.signInFooterCta,
    footerCtaHref: '/sign-up',
  };

  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <AuthShell {...shellProps}>
        <Alert>
          <AlertTitle>Clerk environment variables are missing</AlertTitle>
          <AlertDescription>
            Add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` in `.env.local` to render the sign-in flow.
          </AlertDescription>
        </Alert>
      </AuthShell>
    );
  }

  return (
    <AuthShell {...shellProps}>
      <AuthSignIn redirectTo={redirectTo} />
    </AuthShell>
  );
}
