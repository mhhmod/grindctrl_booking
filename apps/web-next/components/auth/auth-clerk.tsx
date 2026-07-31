'use client';

import React from 'react';
import { SignIn, SignUp } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import { POST_SIGN_UP_PATH } from '@/lib/auth/redirect';
import { useTheme } from 'next-themes';

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

function useClerkAppearance() {
  const { resolvedTheme } = useTheme();
  /* Before hydration resolvedTheme is undefined; the app defaults to dark. */
  const isDark = resolvedTheme !== 'light';

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

export function AuthSignIn({ redirectTo }: { redirectTo: string }) {
  const appearance = useClerkAppearance();
  return (
    <SignIn
      path="/sign-in"
      routing="path"
      signUpUrl="/sign-up"
      /* force, not fallback: fallbackRedirectUrl only applies when the flow
         carries no redirect_url of its own and otherwise defaults to "/", so
         an OAuth callback dropped users on the marketing page. The caller has
         already resolved and validated the destination. */
      forceRedirectUrl={redirectTo}
      appearance={appearance}
    />
  );
}

export function AuthSignUp() {
  const appearance = useClerkAppearance();
  return (
    <SignUp
      path="/sign-up"
      routing="path"
      signInUrl="/sign-in"
      /* New accounts land on onboarding; the onboarding page forwards anyone
         who has already finished it. Forced for the same reason as sign-in:
         a fallback loses the OAuth callback. */
      forceRedirectUrl={POST_SIGN_UP_PATH}
      appearance={appearance}
    />
  );
}
