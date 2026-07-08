'use client';

import React from 'react';
import { SignIn, SignUp } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import { useTheme } from 'next-themes';

/* Clerk variables need concrete parseable colors (it derives shades),
   so brand hex values are used instead of CSS custom properties. */
const WARM_CREAM = '#f0ede9';
const WARM_CHARCOAL = '#2a2826';
const WARM_DARK_CARD = '#1d1a17';
const WARM_NEAR_BLACK = '#141210';

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
      variables: {
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
    variables: {
      colorPrimary: WARM_CHARCOAL,
      colorBackground: '#f7f5f2',
      colorInput: '#ffffff',
      colorText: WARM_CHARCOAL,
      colorNeutral: WARM_CHARCOAL,
    },
  };
}

export function AuthSignIn() {
  const appearance = useClerkAppearance();
  return (
    <SignIn
      path="/sign-in"
      routing="path"
      signUpUrl="/sign-up"
      fallbackRedirectUrl="/dashboard/overview"
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
      fallbackRedirectUrl="/dashboard/overview"
      appearance={appearance}
    />
  );
}
