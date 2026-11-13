import { notFound } from 'next/navigation';
import { Button } from '@mantine/core';
import { AuthFormPlaceholder, AuthFormProblem, AuthUnavailable } from '@/components/auth/auth-form-states';
import { AuthShell } from '@/components/auth/auth-shell';
import { SessionEndedPrompt } from '@/components/auth/session-guard';
import { CLAIM_COPY } from '@/components/claim/claim-copy';
import { ClaimMessageView } from '@/components/claim/claim-message';
import { MantineUiProvider } from '@/components/mantine/provider';
import { authFormStateCopy, getAuthCopy } from '@/lib/auth/auth-i18n';
import { getRequestLocale } from '@/lib/auth/locale';
import { getDir } from '@/lib/landing/landing-i18n';

/* Dev-only preview of the auth and session states, drawn from the real
   components without a Clerk session or a Clerk key, for browser checks and
   screenshots (e2e/auth-states.spec.ts). Clerk's own form is never drawn
   here: the form area shows what a visitor sees before it loads.

   ?state= sign-in | sign-up | signed-out | slow | failed | unavailable |
           session-ended | claim-mismatch
   ?slow_ms= how long the placeholder waits before saying it is slow. */

const STATES = ['sign-in', 'sign-up', 'signed-out', 'slow', 'failed', 'unavailable', 'session-ended', 'claim-mismatch'] as const;
type State = (typeof STATES)[number];

export default async function AuthCheckPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; slow_ms?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const params = await searchParams;
  const state: State = STATES.find((value) => value === params.state) ?? 'sign-in';
  const slowAfterMs = Number(params.slow_ms) > 0 ? Number(params.slow_ms) : undefined;
  const locale = await getRequestLocale();
  const copy = getAuthCopy(locale);
  const formCopy = authFormStateCopy(copy);

  if (state === 'session-ended') {
    return (
      <MantineUiProvider dir={getDir(locale)}>
        <main dir={getDir(locale)} lang={locale} className="min-h-dvh bg-background" aria-label="Dashboard">
          <SessionEndedPrompt locale={locale} opened href="/sign-in?redirect_url=%2Fdashboard%2Finbox" />
        </main>
      </MantineUiProvider>
    );
  }

  if (state === 'claim-mismatch') {
    const claim = CLAIM_COPY[locale === 'ar' ? 'ar' : 'en'];
    return (
      <MantineUiProvider dir={getDir(locale)}>
        <main className="min-h-dvh bg-background">
          <ClaimMessageView
            locale={locale}
            title={claim.ownerTitle}
            body={claim.ownerBodySignedInAs('maya.store-owner@example.com')}
            primary={
              <Button type="button" radius="pill" h={44}>
                {claim.switchAccount}
              </Button>
            }
            actions={[{ label: claim.connectManually, href: '/dashboard/try-on' }]}
          />
        </main>
      </MantineUiProvider>
    );
  }

  const signUp = state === 'sign-up';
  return (
    <AuthShell
      locale={locale}
      copy={copy}
      title={signUp ? copy.signUpTitle : copy.signInTitle}
      subtitle={signUp ? copy.signUpSubtitle : copy.signInSubtitle}
      footerPrompt={signUp ? copy.signUpFooterPrompt : copy.signInFooterPrompt}
      footerCtaLabel={signUp ? copy.signUpFooterCta : copy.signInFooterCta}
      footerCtaHref={signUp ? '/sign-in' : '/sign-up'}
      notice={state === 'signed-out' ? copy.signedOutNotice : undefined}
    >
      {state === 'slow' || state === 'failed' ? (
        <AuthFormProblem copy={formCopy} kind={state} />
      ) : state === 'unavailable' ? (
        <AuthUnavailable title={copy.unavailableTitle} body={copy.unavailableBody} contactLabel={copy.contactSupport} />
      ) : (
        <AuthFormPlaceholder copy={formCopy} slowAfterMs={slowAfterMs} />
      )}
    </AuthShell>
  );
}
