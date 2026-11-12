'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ClerkFailed, ClerkLoaded, ClerkLoading, SignIn, SignUp, useAuth } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import { useTheme } from 'next-themes';
import { AuthFormPlaceholder, AuthFormProblem } from '@/components/auth/auth-form-states';
import type { AuthFormStateCopy } from '@/lib/auth/auth-i18n';

/* Clerk variables need concrete parseable colors (it derives shades),
   so brand hex values are used instead of CSS custom properties. */
const WARM_CREAM = '#f0ede9';
const WARM_CHARCOAL = '#2a2826';
const WARM_DARK_CARD = '#1d1a17';
const WARM_NEAR_BLACK = '#141210';

/* Clerk's own defaults render fields and buttons at 13px, which is two
   separate mobile bugs: iOS force-zooms any focused input under 16px, and a
   30px control is well under the 44px minimum touch target. Both are fixed
   here rather than with CSS overrides so Clerk keeps deriving its internal
   spacing from a sane base. */
const TOUCH_SAFE_ELEMENTS = {
  formFieldInput: { fontSize: '16px', minHeight: '44px' },
  formButtonPrimary: { fontSize: '16px', minHeight: '44px' },
  socialButtonsBlockButton: { fontSize: '16px', minHeight: '44px' },
  formFieldInputShowPasswordButton: { minWidth: '44px', minHeight: '44px' },
} as const;

/* next-themes' script puts the stored theme on <html> before the page
   paints, while resolvedTheme stays undefined until hydration. Reading the
   class keeps a dark-mode visitor's form dark from its first frame. */
function documentIsDark(): boolean {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
}

export function useClerkAppearance() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === undefined ? documentIsDark() : resolvedTheme !== 'light';

  /* The AuthShell brand pane already shows the logo; Clerk's in-card logo
     image has a baked-in white background that clashes in dark mode. */
  const layout = { logoPlacement: 'none' as const };

  if (isDark) {
    return {
      baseTheme: dark,
      layout,
      elements: TOUCH_SAFE_ELEMENTS,
      variables: {
        fontSize: '16px',
        colorPrimary: WARM_CREAM,
        colorBackground: WARM_DARK_CARD,
        colorInput: WARM_NEAR_BLACK,
        colorText: WARM_CREAM,
        colorNeutral: WARM_CREAM,
      },
    };
  }

  return {
    layout,
    elements: TOUCH_SAFE_ELEMENTS,
    variables: {
      fontSize: '16px',
      colorPrimary: WARM_CHARCOAL,
      colorBackground: '#f7f5f2',
      colorInput: '#ffffff',
      colorText: WARM_CHARCOAL,
      colorNeutral: WARM_CHARCOAL,
    },
  };
}

/* Long enough for Clerk's own redirect to win after a sign-in in this tab;
   this only has to move a tab that nobody is typing in. */
export const CONTINUE_AFTER_SIGN_IN_MS = 1500;

/* Someone signed in from another tab while this sign-in or sign-up page
   stayed open: Clerk shares the session, but the open form just sits there.
   Continue to where this page was going. Only a change from signed out to
   signed in counts, so a visitor who arrives already signed in gets Clerk's
   own behaviour, unchanged. */
export function useContinueWhenSignedIn(destination: string) {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const sawSignedOut = React.useRef(false);

  React.useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      sawSignedOut.current = true;
      return;
    }
    if (!sawSignedOut.current) return;
    const timer = window.setTimeout(() => router.replace(destination), CONTINUE_AFTER_SIGN_IN_MS);
    return () => window.clearTimeout(timer);
  }, [isLoaded, isSignedIn, destination, router]);
}

function ContinueWhenSignedIn({ destination }: { destination: string }) {
  useContinueWhenSignedIn(destination);
  return null;
}

function AuthFormFrame({ copy, children }: { copy: AuthFormStateCopy; children: React.ReactNode }) {
  return (
    <>
      <ClerkLoading>
        <AuthFormPlaceholder copy={copy} />
      </ClerkLoading>
      <ClerkFailed>
        <AuthFormProblem copy={copy} kind="failed" />
      </ClerkFailed>
      <ClerkLoaded>{children}</ClerkLoaded>
    </>
  );
}

export function AuthSignIn({
  redirectTo,
  signUpUrl,
  signUpRedirectTo,
  copy,
}: {
  /** Already resolved and validated by the page. */
  redirectTo: string;
  /** The sign-up page, carrying this page's destination. */
  signUpUrl: string;
  /** Where a sign-in that turns into a new account goes (onboarding first). */
  signUpRedirectTo: string;
  copy: AuthFormStateCopy;
}) {
  const appearance = useClerkAppearance();
  return (
    <AuthFormFrame copy={copy}>
      <ContinueWhenSignedIn destination={redirectTo} />
      <SignIn
        path="/sign-in"
        routing="path"
        signUpUrl={signUpUrl}
        /* force, not fallback: fallbackRedirectUrl only applies when the
           flow carries no redirect_url of its own and otherwise defaults
           to "/", so an OAuth callback dropped users on the marketing
           page. The caller has already resolved and validated the
           destination. */
        forceRedirectUrl={redirectTo}
        signUpForceRedirectUrl={signUpRedirectTo}
        appearance={appearance}
      />
    </AuthFormFrame>
  );
}

export function AuthSignUp({
  redirectTo,
  signInUrl,
  signInRedirectTo,
  copy,
}: {
  /** Onboarding, carrying the page this new account was on its way to. */
  redirectTo: string;
  /** The sign-in page, carrying this page's destination. */
  signInUrl: string;
  /** Where a sign-up that turns out to be an existing account goes. */
  signInRedirectTo: string;
  copy: AuthFormStateCopy;
}) {
  const appearance = useClerkAppearance();
  return (
    <AuthFormFrame copy={copy}>
      <ContinueWhenSignedIn destination={redirectTo} />
      <SignUp
        path="/sign-up"
        routing="path"
        signInUrl={signInUrl}
        /* New accounts land on onboarding; the onboarding page forwards
           anyone who has already finished it, and onward to the page they
           were going to. Forced for the same reason as sign-in: a fallback
           loses the OAuth callback. */
        forceRedirectUrl={redirectTo}
        signInForceRedirectUrl={signInRedirectTo}
        appearance={appearance}
      />
    </AuthFormFrame>
  );
}
