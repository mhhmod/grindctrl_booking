import React from 'react';
import { AuthSignUp } from '@/components/auth/auth-clerk';
import { AuthUnavailable } from '@/components/auth/auth-form-states';
import { AuthShell } from '@/components/auth/auth-shell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { authFormStateCopy, getAuthCopy } from '@/lib/auth/auth-i18n';
import { getRequestLocale } from '@/lib/auth/locale';
import { authPageHref, resolveSignInDestination, resolveSignUpDestination } from '@/lib/auth/redirect';

export default async function SignUpPage({
  searchParams,
}: {
  searchParams?: Promise<{ redirect_url?: string }>;
} = {}) {
  const params = (await searchParams) ?? {};
  /* A new account goes through onboarding, then on to the page it was on its
     way to: a Shopify claim link, an invite, a dashboard deep link. Clerk
     keeps the forced destination through email verification. */
  const redirectTo = resolveSignUpDestination(params.redirect_url);
  const signInHref = authPageHref('/sign-in', params.redirect_url);
  const locale = await getRequestLocale();
  const copy = getAuthCopy(locale);

  const shellProps = {
    locale,
    copy,
    title: copy.signUpTitle,
    subtitle: copy.signUpSubtitle,
    footerPrompt: copy.signUpFooterPrompt,
    footerCtaLabel: copy.signUpFooterCta,
    footerCtaHref: signInHref,
  };

  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <AuthShell {...shellProps}>
        {process.env.NODE_ENV === 'production' ? (
          <AuthUnavailable title={copy.unavailableTitle} body={copy.unavailableBody} contactLabel={copy.contactSupport} />
        ) : (
          <Alert>
            <AlertTitle>Clerk environment variables are missing</AlertTitle>
            <AlertDescription>
              Add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` in `.env.local` to render the sign-up flow.
            </AlertDescription>
          </Alert>
        )}
      </AuthShell>
    );
  }

  return (
    <AuthShell {...shellProps}>
      <AuthSignUp
        redirectTo={redirectTo}
        signInUrl={signInHref}
        signInRedirectTo={resolveSignInDestination(params.redirect_url)}
        copy={authFormStateCopy(copy)}
      />
    </AuthShell>
  );
}
