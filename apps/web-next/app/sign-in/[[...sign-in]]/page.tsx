import React from 'react';
import { AuthSignIn } from '@/components/auth/auth-clerk';
import { AuthUnavailable } from '@/components/auth/auth-form-states';
import { AuthShell } from '@/components/auth/auth-shell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { authFormStateCopy, getAuthCopy } from '@/lib/auth/auth-i18n';
import { getRequestLocale } from '@/lib/auth/locale';
import { authPageHref, resolveSignInDestination, resolveSignUpDestination } from '@/lib/auth/redirect';

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string; signed_out?: string }>;
}) {
  const params = await searchParams;
  /* The middleware puts the page the visitor wanted into redirect_url when it
     bounces them here. Honour it when it is a safe same-site path, and carry
     it to sign-up so a new account still gets there after onboarding. */
  const redirectTo = resolveSignInDestination(params.redirect_url);
  const signUpHref = authPageHref('/sign-up', params.redirect_url);
  const locale = await getRequestLocale();
  const copy = getAuthCopy(locale);
  // A merchant bounced here mid-claim from Shopify may never have had an
  // account — "Welcome back" is the wrong tone regardless of locale.
  const fromClaim = redirectTo.startsWith('/claim');

  const shellProps = {
    locale,
    copy,
    title: fromClaim ? copy.claimSignInTitle : copy.signInTitle,
    subtitle: fromClaim ? copy.claimSignInSubtitle : copy.signInSubtitle,
    footerPrompt: copy.signInFooterPrompt,
    footerCtaLabel: copy.signInFooterCta,
    footerCtaHref: signUpHref,
    // Signing out lands here (components/dashboard/v16/v16-shell.tsx).
    notice: params.signed_out === '1' ? copy.signedOutNotice : undefined,
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
              Add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` in `.env.local` to render the sign-in flow.
            </AlertDescription>
          </Alert>
        )}
      </AuthShell>
    );
  }

  return (
    <AuthShell {...shellProps}>
      <AuthSignIn
        redirectTo={redirectTo}
        signUpUrl={signUpHref}
        signUpRedirectTo={resolveSignUpDestination(params.redirect_url)}
        copy={authFormStateCopy(copy)}
      />
    </AuthShell>
  );
}
